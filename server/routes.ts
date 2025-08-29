import type { Express } from 'express';
import { createServer, type Server } from 'http';
import session from 'express-session';
import connectPg from 'connect-pg-simple';
import { randomUUID } from 'crypto';
import { databaseStorage } from './lib/database-storage';
import { insertTaskSchema, type TaskTemplate } from '@shared/schema';
import { verifySignature, parseWebhookPayload } from './lib/webhook-verify';
import {
  startNextIfIdle,
  markTaskCompleted,
  markTaskFailed,
} from './lib/queue';
import {
  createReviewApprove,
  mergePullRequest,
  markPRReadyForReview,
  commentOnPR,
  getPullRequest,
} from './lib/github-rest';
import { isPRGreen } from './lib/ci';
import { GitHubOAuth } from './lib/github-oauth';
import {
  requireAuth,
  optionalAuth,
  type AuthenticatedRequest,
} from './lib/auth-middleware';

// Extend session types
declare module 'express-session' {
  interface Session {
    oauthState?: string;
    userId?: string;
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Session configuration
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: 'sessions',
  });

  app.use(
    session({
      secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
      store: sessionStore,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: sessionTtl,
      },
    })
  );

  // GitHub OAuth setup
  // Construct the correct redirect URI using Replit's environment variables
  const replitDomain =
    process.env.REPLIT_DEV_DOMAIN ||
    (process.env.REPL_SLUG && process.env.REPL_OWNER
      ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`
      : 'http://localhost:5000');

  const githubOAuth = new GitHubOAuth({
    clientId: process.env.GITHUB_CLIENT_ID || '',
    clientSecret: process.env.GITHUB_CLIENT_SECRET || '',
    redirectUri:
      process.env.GITHUB_REDIRECT_URI ||
      `${replitDomain}/api/auth/github/callback`,
  });

  console.log(
    `GitHub OAuth redirect URI: ${process.env.GITHUB_REDIRECT_URI || `${replitDomain}/api/auth/github/callback`}`
  );

  // GitHub OAuth routes
  app.get('/api/auth/github', (req, res) => {
    const state = randomUUID();
    req.session!.oauthState = state;
    const authUrl = githubOAuth.getAuthorizationUrl(state);
    res.redirect(authUrl);
  });

  app.get('/api/auth/github/callback', async (req, res) => {
    try {
      const { code, state } = req.query;
      const sessionState = req.session!.oauthState;

      if (!code || !state || state !== sessionState) {
        return res.status(400).json({ error: 'Invalid OAuth callback' });
      }

      // Exchange code for token
      const { accessToken, refreshToken } =
        await githubOAuth.exchangeCodeForToken(code as string, state as string);

      // Get user info
      const githubUser = await githubOAuth.getUserInfo(accessToken);

      // Create or update user
      const user = await databaseStorage.createOrUpdateUser({
        id: githubUser.id,
        username: githubUser.login,
        email: githubUser.email,
        avatarUrl: githubUser.avatar_url,
        accessToken,
        refreshToken,
        tokenExpiresAt: undefined, // GitHub tokens don't expire
      });

      // Set session
      req.session!.userId = user.id;
      delete req.session!.oauthState;

      res.redirect('/');
    } catch (error) {
      console.error('OAuth callback error:', error);
      res.status(500).json({ error: 'Authentication failed' });
    }
  });

  app.post('/api/auth/logout', (req, res) => {
    req.session?.destroy((err) => {
      if (err) {
        console.error('Logout error:', err);
        return res.status(500).json({ error: 'Logout failed' });
      }
      res.json({ success: true });
    });
  });

  app.get('/api/auth/user', optionalAuth, (req: AuthenticatedRequest, res) => {
    if (req.user) {
      const { accessToken, ...userWithoutToken } = req.user;
      res.json(userWithoutToken);
    } else {
      res.status(401).json({ error: 'Not authenticated' });
    }
  });

  // Get application state (user-specific)
  app.get(
    '/api/status',
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const appState = await databaseStorage.getUserAppState(req.user!.id);
        res.json(appState);
      } catch (error) {
        console.error('Error getting app state:', error);
        res.status(500).json({ error: 'Failed to get application state' });
      }
    }
  );

  // Get user repositories from GitHub
  app.get(
    '/api/repositories',
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const repositories = await githubOAuth.getUserRepositories(
          req.user!.accessToken
        );
        res.json(repositories);
      } catch (error) {
        console.error('Error getting repositories:', error);
        res.status(500).json({ error: 'Failed to get repositories' });
      }
    }
  );

  // Add repository to monitoring
  app.post(
    '/api/repositories',
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { owner, repo } = req.body;

        if (!owner || !repo) {
          return res.status(400).json({ error: 'Owner and repo are required' });
        }

        // Register webhook
        const webhookUrl = `${process.env.REPLIT_DOMAIN || req.protocol + '://' + req.get('host')}/api/webhook`;
        const webhookSecret =
          process.env.GITHUB_WEBHOOK_SECRET || 'default-secret';

        const webhook = await githubOAuth.registerWebhook(
          req.user!.accessToken,
          owner,
          repo,
          webhookUrl,
          webhookSecret
        );

        // Add to user repositories
        const repository = await databaseStorage.addUserRepository({
          userId: req.user!.id,
          owner,
          repo,
          webhookId: webhook.id,
          isActive: true,
        });

        res.json(repository);
      } catch (error) {
        console.error('Error adding repository:', error);
        res.status(500).json({ error: 'Failed to add repository' });
      }
    }
  );

  // Remove repository from monitoring
  app.delete(
    '/api/repositories/:id',
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { id } = req.params;

        // Get repository info
        const repositories = await databaseStorage.getUserRepositories(
          req.user!.id
        );
        const repository = repositories.find((r) => r.id === id);

        if (!repository) {
          return res.status(404).json({ error: 'Repository not found' });
        }

        // Delete webhook if exists
        if (repository.webhookId) {
          try {
            await githubOAuth.deleteWebhook(
              req.user!.accessToken,
              repository.owner,
              repository.repo,
              repository.webhookId
            );
          } catch (error) {
            console.warn('Failed to delete webhook:', error);
          }
        }

        // Remove from database
        await databaseStorage.removeUserRepository(id);

        res.json({ success: true });
      } catch (error) {
        console.error('Error removing repository:', error);
        res.status(500).json({ error: 'Failed to remove repository' });
      }
    }
  );

  // Create new tasks
  app.post(
    '/api/tasks',
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { repositoryId, templates, count = 1 } = req.body;

        if (!repositoryId || !templates || templates.length === 0) {
          return res
            .status(400)
            .json({ error: 'Repository ID and templates are required' });
        }

        // Get repository info
        const repositories = await databaseStorage.getUserRepositories(
          req.user!.id
        );
        const repository = repositories.find((r) => r.id === repositoryId);

        if (!repository) {
          return res.status(404).json({ error: 'Repository not found' });
        }

        const taskTemplates: Record<string, TaskTemplate> = {
          tests: {
            type: 'tests',
            title: 'Tests nachziehen (kritische Pfade)',
            body: 'Bitte Unit Tests für Kernfunktionen ergänzen. Ziel: Abdeckung +10%. Closes after CI green.',
            labels: ['chore', 'tests'],
          },
          lint: {
            type: 'lint',
            title: 'Lint/Format Fehler beheben',
            body: 'Bitte eslint/prettier-Probleme lösen und CI grün machen.',
            labels: ['chore', 'lint'],
          },
          types: {
            type: 'types',
            title: 'TypeScript Typen härten',
            body: 'Bitte TypeScript-Fehler reduzieren; keine suppressions. CI muss grün sein.',
            labels: ['chore', 'types'],
          },
          security: {
            type: 'security',
            title: 'Dependencies aktualisieren (Sicherheit)',
            body: 'Bitte Sicherheitsupdates für Dependencies durchführen und CI grün machen.',
            labels: ['chore', 'security'],
          },
          docs: {
            type: 'docs',
            title: 'Dokumentation vervollständigen',
            body: 'Bitte fehlende Dokumentation ergänzen und README aktualisieren.',
            labels: ['chore', 'docs'],
          },
        };

        const createdTasks = [];
        for (let i = 0; i < Math.min(count, 10); i++) {
          for (const templateKey of templates) {
            const template = taskTemplates[templateKey];
            if (!template) continue;

            const taskData = insertTaskSchema.parse({
              userId: req.user!.id,
              repositoryId: repository.id,
              owner: repository.owner,
              repo: repository.repo,
              title: template.title,
              body: template.body,
              labels: template.labels as string[],
            });

            const task = await databaseStorage.createTask(taskData);
            createdTasks.push(task);
          }
        }

        // Try to start next task if system is idle
        setTimeout(() => {
          startNextIfIdle(req.user!.id).catch(console.error);
        }, 1000);

        res.json({
          success: true,
          created: createdTasks.length,
          tasks: createdTasks,
        });
      } catch (error) {
        console.error('Error creating tasks:', error);
        res.status(500).json({ error: 'Failed to create tasks' });
      }
    }
  );

  // Stop active task
  app.post(
    '/api/tasks/stop',
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const activeTask = await databaseStorage.getActiveTask(req.user!.id);
        if (!activeTask) {
          return res.status(404).json({ error: 'No active task found' });
        }

        await databaseStorage.updateTask(activeTask.id, {
          status: 'failed',
        });

        console.log(`Task ${activeTask.id} stopped by user ${req.user!.id}`);

        res.json({ success: true, taskId: activeTask.id });
      } catch (error) {
        console.error('Error stopping task:', error);
        res.status(500).json({ error: 'Failed to stop task' });
      }
    }
  );

  // Export logs endpoint
  app.get(
    '/api/logs/export',
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        // Get user's tasks as a simple log export
        const tasks = await databaseStorage.getUserTasks(req.user!.id);

        const logs = tasks.map((task) => ({
          timestamp: task.createdAt,
          taskId: task.id,
          repository: `${task.owner}/${task.repo}`,
          title: task.title,
          status: task.status,
          issueNumber: task.issueNumber,
          pullNumber: task.pullNumber,
          startedAt: task.startedAt,
          completedAt: task.completedAt,
          failureReason: task.failureReason,
        }));

        // Set headers for file download
        res.setHeader('Content-Type', 'application/json');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename=github-hausmeister-logs-${new Date().toISOString().split('T')[0]}.json`
        );

        res.json({
          exportDate: new Date().toISOString(),
          user: req.user!.username,
          totalTasks: logs.length,
          logs: logs,
        });
      } catch (error) {
        console.error('Error exporting logs:', error);
        res.status(500).json({ error: 'Failed to export logs' });
      }
    }
  );

  // System controls (user-specific)
  app.post(
    '/api/system/pause',
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        await databaseStorage.updateUserSystemState(req.user!.id, {
          systemRunning: false,
        });
        res.json({ success: true });
      } catch (error) {
        console.error('Error pausing system:', error);
        res.status(500).json({ error: 'Failed to pause system' });
      }
    }
  );

  app.post(
    '/api/system/resume',
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        await databaseStorage.updateUserSystemState(req.user!.id, {
          systemRunning: true,
        });
        // Try to start next task
        setTimeout(() => {
          startNextIfIdle(req.user!.id).catch(console.error);
        }, 1000);
        res.json({ success: true });
      } catch (error) {
        console.error('Error resuming system:', error);
        res.status(500).json({ error: 'Failed to resume system' });
      }
    }
  );

  app.delete(
    '/api/tasks/queue',
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const queuedTasks = await databaseStorage.getQueuedTasks(req.user!.id);
        let deleted = 0;

        for (const task of queuedTasks) {
          await databaseStorage.deleteTask(task.id);
          deleted++;
        }

        res.json({ success: true, deleted });
      } catch (error) {
        console.error('Error clearing queue:', error);
        res.status(500).json({ error: 'Failed to clear queue' });
      }
    }
  );

  app.delete(
    '/api/tasks/:id',
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { id } = req.params;

        // Verify task belongs to user
        const userTasks = await databaseStorage.getUserTasks(req.user!.id);
        const task = userTasks.find((t) => t.id === id);

        if (!task) {
          return res.status(404).json({ error: 'Task not found' });
        }

        await databaseStorage.deleteTask(id);
        res.json({ success: true });
      } catch (error) {
        console.error('Error deleting task:', error);
        res.status(500).json({ error: 'Failed to delete task' });
      }
    }
  );

  // Get user statistics
  app.get('/api/stats', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const tasks = await databaseStorage.getUserTasks(userId);

      const totalTasks = tasks.length;
      const successfulTasks = tasks.filter(
        (t) => t.status === 'completed'
      ).length;
      const failedTasks = tasks.filter((t) => t.status === 'failed').length;
      const inProgressTasks = tasks.filter(
        (t) => t.status === 'in_progress'
      ).length;

      // Calculate success rate
      const completedTasks = successfulTasks + failedTasks;
      const successRate =
        completedTasks > 0
          ? Math.round((successfulTasks / completedTasks) * 100)
          : 0;

      // Calculate average completion time
      const completedTasksWithTimes = tasks.filter(
        (t) =>
          (t.status === 'completed' || t.status === 'failed') &&
          t.startedAt &&
          t.completedAt
      );

      let avgTimeHours = 0;
      if (completedTasksWithTimes.length > 0) {
        const totalMinutes = completedTasksWithTimes.reduce((sum, task) => {
          const startTime = new Date(task.startedAt!).getTime();
          const endTime = new Date(task.completedAt!).getTime();
          return sum + (endTime - startTime);
        }, 0);
        avgTimeHours =
          Math.round(
            (totalMinutes / completedTasksWithTimes.length / (1000 * 60 * 60)) *
              10
          ) / 10;
      }

      res.json({
        totalTasks,
        successfulTasks,
        failedTasks,
        inProgressTasks,
        successRate,
        avgTimeHours,
        maxMonthlyTasks: Number(process.env.MAX_MONTHLY_TASKS || 50),
      });
    } catch (error) {
      console.error('Error getting stats:', error);
      res.status(500).json({ error: 'Failed to get statistics' });
    }
  });

  // GitHub webhook endpoint
  app.post('/api/webhook', async (req, res) => {
    try {
      const secret =
        process.env.GITHUB_WEBHOOK_SECRET ||
        process.env.GITHUB_WEBHOOK_SECRET_ENV_VAR ||
        'default_secret';
      const sig256 = req.headers['x-hub-signature-256'] as string;
      const event = (req.headers['x-github-event'] as string) || 'unknown';
      const delivery =
        (req.headers['x-github-delivery'] as string) || 'unknown';
      const contentType = req.headers['content-type'] as string;

      let body: string;
      if (typeof req.body === 'string') {
        body = req.body;
      } else {
        body = JSON.stringify(req.body);
      }

      // Verify webhook signature
      if (!verifySignature(secret, body, sig256)) {
        console.error('Invalid webhook signature');
        return res.status(401).json({ error: 'Invalid signature' });
      }

      // Check for duplicate delivery
      const isProcessed = await databaseStorage.isDeliveryProcessed(delivery);
      if (isProcessed) {
        return res.json({ ok: true, message: 'Already processed' });
      }

      // Record delivery
      await databaseStorage.recordWebhookDelivery({
        id: delivery,
        event,
        processed: true,
        createdAt: new Date(),
      });

      const payload = parseWebhookPayload(body, contentType);

      // Handle different webhook events
      if (event === 'pull_request') {
        await handlePullRequestEvent(payload);
      } else if (
        event === 'workflow_run' ||
        event === 'check_suite' ||
        event === 'check_run'
      ) {
        await handleCIEvent(payload);
      } else if (event === 'issues') {
        await handleIssuesEvent(payload);
      }

      res.json({ ok: true, delivery, event });
    } catch (error) {
      console.error('Webhook error:', error);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  });

  async function handlePullRequestEvent(payload: any) {
    const action = payload.action;
    const pr = payload.pull_request;
    const owner = payload.repository.owner.login;
    const repo = payload.repository.name;

    // Find the user who owns this repository to get their active task
    const userRepo = await databaseStorage.getUserRepositoryByName(owner, repo);
    if (!userRepo) return;

    const activeTask = await databaseStorage.getActiveTask(userRepo.userId);
    if (!activeTask || !activeTask.issueNumber) return;

    // Check if PR references our issue
    const issueRef = pr.body?.includes(`#${activeTask.issueNumber}`);
    if (!issueRef) return;

    if (
      action === 'opened' ||
      action === 'ready_for_review' ||
      action === 'synchronize'
    ) {
      // Update task with PR info
      await databaseStorage.updateTask(activeTask.id, {
        pullNumber: pr.number,
        headSha: pr.head.sha,
      });

      const user = await databaseStorage.getUserById(userRepo.userId);
      if (!user?.accessToken) return;

      // For draft PRs that were just opened, wait for CI to complete
      if (action === 'opened' && pr.draft) {
        console.log(`📝 Draft PR #${pr.number} opened, waiting for CI...`);
        return;
      }

      // Check CI status if PR is ready or if it's a synchronize event
      if (
        ['ready_for_review', 'synchronize'].includes(action) ||
        (action === 'opened' && !pr.draft)
      ) {
        await tryAutoMergePR(
          user.accessToken,
          owner,
          repo,
          pr.number,
          pr.head.sha,
          activeTask.id,
          pr.draft
        );
      }
    }
  }

  async function tryAutoMergePR(
    token: string,
    owner: string,
    repo: string,
    pullNumber: number,
    headSha: string,
    taskId: string,
    isDraft: boolean = false
  ) {
    try {
      // If it's a draft PR, convert it to ready for review first
      if (isDraft) {
        console.log(
          `🔄 Converting draft PR #${pullNumber} to ready for review...`
        );
        await markPRReadyForReview(token, owner, repo, pullNumber);
        console.log(`✅ PR #${pullNumber} marked as ready for review`);
      }

      const isGreen = await isPRGreen(token, owner, repo, headSha);
      if (isGreen) {
        console.log(
          `🟢 CI is green for PR #${pullNumber}, proceeding with auto-merge...`
        );
        await createReviewApprove(
          token,
          owner,
          repo,
          pullNumber,
          'Automatisches Review: CI grün ✔️'
        );
        await mergePullRequest(token, owner, repo, pullNumber, 'squash');
        await markTaskCompleted(taskId);
        console.log(`✅ PR #${pullNumber} auto-merged successfully`);
      } else {
        console.log(
          `🟡 CI not yet green for PR #${pullNumber}, will retry on CI completion`
        );
      }
    } catch (error) {
      console.error(
        `❌ Error in auto-merge process for PR #${pullNumber}:`,
        error
      );
      await commentOnPR(
        token,
        owner,
        repo,
        pullNumber,
        `❌ **Auto-merge failed**: ${error instanceof Error ? error.message : 'Unknown error'}\n\n` +
          `The PR has been converted to ready for review but could not be automatically merged. ` +
          `Please check the CI status and merge manually if appropriate.`
      );
      await markTaskFailed(taskId);
    }
  }

  async function handleCIEvent(payload: any) {
    // Get repository info to find user
    const repoFullName = payload.repository?.full_name;
    if (!repoFullName) return;

    const [owner, repo] = repoFullName.split('/');
    const userRepo = await databaseStorage.getUserRepositoryByName(owner, repo);
    if (!userRepo) return;

    const activeTask = await databaseStorage.getActiveTask(userRepo.userId);
    if (!activeTask || !activeTask.pullNumber || !activeTask.headSha) return;

    const headSha = activeTask.headSha;

    // Check if this CI event is for our PR
    const isForOurPR =
      payload.check_suite?.head_sha === headSha ||
      payload.workflow_run?.head_sha === headSha ||
      payload.check_run?.head_sha === headSha;

    if (!isForOurPR) return;

    // Only proceed if CI event indicates completion
    const isCompleted =
      payload.check_suite?.status === 'completed' ||
      payload.workflow_run?.status === 'completed' ||
      payload.check_run?.status === 'completed';

    if (!isCompleted) return;

    console.log(
      `🔄 CI completed for PR #${activeTask.pullNumber}, checking if auto-merge is possible...`
    );

    const user = await databaseStorage.getUserById(userRepo.userId);
    if (!user?.accessToken) return;

    // Get current PR status to check if it's still a draft
    const pr = await getPullRequest(
      user.accessToken,
      owner,
      repo,
      activeTask.pullNumber
    );

    // Try to auto-merge, including converting from draft if necessary
    await tryAutoMergePR(
      user.accessToken,
      owner,
      repo,
      activeTask.pullNumber,
      headSha,
      activeTask.id,
      pr.draft
    );
  }

  async function handleIssuesEvent(payload: any) {
    // Could be used for additional issue-related automation
    console.log(
      `Issue event: ${payload.action} for issue #${payload.issue?.number}`
    );
  }

  const httpServer = createServer(app);

  // Note: In multi-user system, tasks are started when users make requests
  // No need to start tasks globally on server startup

  return httpServer;
}
