import { storage } from "../storage";
import { createIssue } from "./github-rest";
import { getCopilotNodeId, addAssignee } from "./copilot";
import { getIssueNodeId } from "./github-graphql";

export async function startNextIfIdle() {
  const state = await storage.getSystemState();
  const activeTask = await storage.getActiveTask();
  const queue = await storage.getQueuedTasks();
  
  if (!state.systemRunning || activeTask || queue.length === 0) {
    return;
  }

  const maxTasks = Number(process.env.MAX_MONTHLY_TASKS || process.env.MAX_MONTHLY_TASKS_ENV_VAR || 50);
  if (state.monthlyDone >= maxTasks) {
    console.log(`Monthly limit reached: ${state.monthlyDone}/${maxTasks}`);
    return;
  }

  const nextTask = queue[0];
  if (!nextTask) return;

  try {
    // Mark task as active
    await storage.updateTask(nextTask.id, { status: "active" });
    
    // Create GitHub issue
    const issue = await createIssue(
      nextTask.owner, 
      nextTask.repo, 
      nextTask.title, 
      nextTask.body, 
      nextTask.labels
    );
    
    // Get Copilot agent ID and assign
    const copilotId = await getCopilotNodeId();
    const issueNodeId = await getIssueNodeId(nextTask.owner, nextTask.repo, issue.number);
    await addAssignee(issueNodeId, copilotId);
    
    // Update task with issue number
    await storage.updateTask(nextTask.id, { 
      issueNumber: issue.number,
      status: "active"
    });
    
    console.log(`Started task ${nextTask.id}: Issue #${issue.number} created and assigned to Copilot`);
    
  } catch (error) {
    console.error("Error starting next task:", error);
    await storage.updateTask(nextTask.id, { status: "failed" });
    
    // Try to start next task after a delay
    setTimeout(() => {
      startNextIfIdle().catch(console.error);
    }, 5000);
  }
}

export async function markTaskCompleted(taskId: string) {
  await storage.updateTask(taskId, { status: "completed" });
  
  // Increment monthly counter
  const state = await storage.getSystemState();
  await storage.updateSystemState({ monthlyDone: state.monthlyDone + 1 });
  
  // Start next task after a delay
  setTimeout(() => {
    startNextIfIdle().catch(console.error);
  }, 1000);
}

export async function markTaskFailed(taskId: string) {
  await storage.updateTask(taskId, { status: "failed" });
  
  // Start next task after a delay
  setTimeout(() => {
    startNextIfIdle().catch(console.error);
  }, 5000);
}
