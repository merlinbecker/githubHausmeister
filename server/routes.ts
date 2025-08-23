import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertTaskSchema, insertWebhookDeliverySchema, type TaskTemplate } from "@shared/schema";
import { verifySignature, parseWebhookPayload } from "./lib/webhook-verify";
import { startNextIfIdle, markTaskCompleted, markTaskFailed } from "./lib/queue";
import { createReviewApprove, mergePullRequest } from "./lib/github-rest";
import { isPRGreen } from "./lib/ci";
import { resetMonthlyCounterIfNeeded } from "./lib/state";

export async function registerRoutes(app: Express): Promise<Server> {
  // Initialize monthly counter reset check
  resetMonthlyCounterIfNeeded();
  
  // Get application state
  app.get("/api/status", async (req, res) => {
    try {
      const appState = await storage.getAppState();
      res.json(appState);
    } catch (error) {
      console.error("Error getting app state:", error);
      res.status(500).json({ error: "Failed to get application state" });
    }
  });

  // Create new tasks
  app.post("/api/tasks", async (req, res) => {
    try {
      const { repo, templates, count = 1 } = req.body;
      
      if (!repo || !templates || templates.length === 0) {
        return res.status(400).json({ error: "Repository and templates are required" });
      }

      const [owner, repoName] = repo.split("/");
      if (!owner || !repoName) {
        return res.status(400).json({ error: "Invalid repository format. Use owner/repo" });
      }

      const taskTemplates: Record<string, TaskTemplate> = {
        tests: {
          type: "tests",
          title: "Tests nachziehen (kritische Pfade)",
          body: "Bitte Unit Tests für Kernfunktionen ergänzen. Ziel: Abdeckung +10%. Closes after CI green.",
          labels: ["chore", "tests"]
        },
        lint: {
          type: "lint", 
          title: "Lint/Format Fehler beheben",
          body: "Bitte eslint/prettier-Probleme lösen und CI grün machen.",
          labels: ["chore", "lint"]
        },
        types: {
          type: "types",
          title: "TypeScript Typen härten",
          body: "Bitte TypeScript-Fehler reduzieren; keine suppressions. CI muss grün sein.",
          labels: ["chore", "types"]
        },
        security: {
          type: "security",
          title: "Dependencies aktualisieren (Sicherheit)",
          body: "Bitte Sicherheitsupdates für Dependencies durchführen und CI grün machen.",
          labels: ["chore", "security"]
        },
        docs: {
          type: "docs",
          title: "Dokumentation vervollständigen",
          body: "Bitte fehlende Dokumentation ergänzen und README aktualisieren.",
          labels: ["chore", "docs"]
        }
      };

      const createdTasks = [];
      for (let i = 0; i < Math.min(count, 10); i++) {
        for (const templateKey of templates) {
          const template = taskTemplates[templateKey];
          if (!template) continue;

          const taskData = insertTaskSchema.parse({
            owner,
            repo: repoName,
            title: template.title,
            body: template.body,
            labels: template.labels,
          });

          const task = await storage.createTask(taskData);
          createdTasks.push(task);
        }
      }

      // Try to start next task if system is idle
      setTimeout(() => {
        startNextIfIdle().catch(console.error);
      }, 1000);

      res.json({ 
        success: true, 
        created: createdTasks.length,
        tasks: createdTasks 
      });
    } catch (error) {
      console.error("Error creating tasks:", error);
      res.status(500).json({ error: "Failed to create tasks" });
    }
  });

  // System controls
  app.post("/api/system/pause", async (req, res) => {
    try {
      await storage.updateSystemState({ systemRunning: false });
      res.json({ success: true });
    } catch (error) {
      console.error("Error pausing system:", error);
      res.status(500).json({ error: "Failed to pause system" });
    }
  });

  app.post("/api/system/resume", async (req, res) => {
    try {
      await storage.updateSystemState({ systemRunning: true });
      // Try to start next task
      setTimeout(() => {
        startNextIfIdle().catch(console.error);
      }, 1000);
      res.json({ success: true });
    } catch (error) {
      console.error("Error resuming system:", error);
      res.status(500).json({ error: "Failed to resume system" });
    }
  });

  app.delete("/api/tasks/queue", async (req, res) => {
    try {
      const queuedTasks = await storage.getQueuedTasks();
      let deleted = 0;
      
      for (const task of queuedTasks) {
        await storage.deleteTask(task.id);
        deleted++;
      }
      
      res.json({ success: true, deleted });
    } catch (error) {
      console.error("Error clearing queue:", error);
      res.status(500).json({ error: "Failed to clear queue" });
    }
  });

  app.delete("/api/tasks/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const success = await storage.deleteTask(id);
      
      if (!success) {
        return res.status(404).json({ error: "Task not found" });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting task:", error);
      res.status(500).json({ error: "Failed to delete task" });
    }
  });

  // GitHub webhook endpoint
  app.post("/api/webhook", async (req, res) => {
    try {
      const secret = process.env.GITHUB_WEBHOOK_SECRET || process.env.GITHUB_WEBHOOK_SECRET_ENV_VAR || "default_secret";
      const sig256 = req.headers["x-hub-signature-256"] as string;
      const event = req.headers["x-github-event"] as string || "unknown";
      const delivery = req.headers["x-github-delivery"] as string || "unknown";
      const contentType = req.headers["content-type"] as string;
      
      let body: string;
      if (typeof req.body === "string") {
        body = req.body;
      } else {
        body = JSON.stringify(req.body);
      }

      // Verify webhook signature
      if (!verifySignature(secret, body, sig256)) {
        console.error("Invalid webhook signature");
        return res.status(401).json({ error: "Invalid signature" });
      }

      // Check for duplicate delivery
      const isProcessed = await storage.isDeliveryProcessed(delivery);
      if (isProcessed) {
        return res.json({ ok: true, message: "Already processed" });
      }

      // Record delivery
      await storage.recordWebhookDelivery({
        id: delivery,
        event,
        processed: true,
        createdAt: new Date(),
      });

      const payload = parseWebhookPayload(body, contentType);
      
      // Handle different webhook events
      if (event === "pull_request") {
        await handlePullRequestEvent(payload);
      } else if (event === "workflow_run" || event === "check_suite") {
        await handleCIEvent(payload);
      } else if (event === "issues") {
        await handleIssuesEvent(payload);
      }

      res.json({ ok: true, delivery, event });
    } catch (error) {
      console.error("Webhook error:", error);
      res.status(500).json({ error: "Webhook processing failed" });
    }
  });

  async function handlePullRequestEvent(payload: any) {
    const action = payload.action;
    const pr = payload.pull_request;
    const owner = payload.repository.owner.login;
    const repo = payload.repository.name;

    // Find active task that matches this PR
    const activeTask = await storage.getActiveTask();
    if (!activeTask || !activeTask.issueNumber) return;

    // Check if PR references our issue
    const issueRef = pr.body?.includes(`#${activeTask.issueNumber}`);
    if (!issueRef) return;

    if (action === "opened" || action === "ready_for_review" || action === "synchronize") {
      // Update task with PR info
      await storage.updateTask(activeTask.id, {
        pullNumber: pr.number,
        headSha: pr.head.sha,
      });

      // Check CI status if PR is ready
      if (["ready_for_review", "synchronize"].includes(action) && !pr.draft) {
        const isGreen = await isPRGreen(owner, repo, pr.head.sha);
        if (isGreen) {
          try {
            await createReviewApprove(owner, repo, pr.number, "Automatisches Review: CI grün ✔️");
            await mergePullRequest(owner, repo, pr.number, "squash");
            await markTaskCompleted(activeTask.id);
          } catch (error) {
            console.error("Error auto-merging PR:", error);
            await markTaskFailed(activeTask.id);
          }
        }
      }
    }
  }

  async function handleCIEvent(payload: any) {
    const activeTask = await storage.getActiveTask();
    if (!activeTask || !activeTask.pullNumber || !activeTask.headSha) return;

    const owner = activeTask.owner;
    const repo = activeTask.repo;
    const headSha = activeTask.headSha;

    // Check if this CI event is for our PR
    const isForOurPR = payload.check_suite?.head_sha === headSha || 
                       payload.workflow_run?.head_sha === headSha;
    
    if (!isForOurPR) return;

    // Check if CI is now green
    const isGreen = await isPRGreen(owner, repo, headSha);
    if (isGreen) {
      try {
        await createReviewApprove(owner, repo, activeTask.pullNumber, "Automatisches Review: CI grün ✔️");
        await mergePullRequest(owner, repo, activeTask.pullNumber, "squash");
        await markTaskCompleted(activeTask.id);
      } catch (error) {
        console.error("Error auto-merging PR after CI:", error);
        await markTaskFailed(activeTask.id);
      }
    }
  }

  async function handleIssuesEvent(payload: any) {
    // Could be used for additional issue-related automation
    console.log(`Issue event: ${payload.action} for issue #${payload.issue?.number}`);
  }

  const httpServer = createServer(app);

  // Start processing queue on server start
  setTimeout(() => {
    startNextIfIdle().catch(console.error);
  }, 2000);

  return httpServer;
}
