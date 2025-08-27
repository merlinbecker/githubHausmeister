import { databaseStorage } from "./database-storage";
import { createIssue } from "./github-rest";
import { getCopilotNodeId, addAssignee, getIssueNodeId } from "./github-graphql";

export async function startNextIfIdle(userId: string): Promise<void> {
  try {
    const appState = await databaseStorage.getUserAppState(userId);
    
    // Check if system is running and no active task
    if (!appState.systemRunning || appState.activeTask) {
      return;
    }

    // Get next queued task
    const queuedTasks = appState.queue;
    if (queuedTasks.length === 0) {
      return;
    }

    const maxTasks = Number(process.env.MAX_MONTHLY_TASKS || 50);
    if (appState.monthlyDone >= maxTasks) {
      console.log(`Monthly limit reached for user ${userId}: ${appState.monthlyDone}/${maxTasks}`);
      return;
    }

    const nextTask = queuedTasks[0];
    
    // Mark task as in progress
    await databaseStorage.updateTask(nextTask.id, {
      status: "in_progress",
    });

    console.log(`Starting task ${nextTask.id}: ${nextTask.title}`);

    // Get user's GitHub token
    const user = await databaseStorage.getUserById(userId);
    if (!user?.accessToken) {
      throw new Error("No GitHub access token found for user");
    }

    // Check for duplicate issues first
    const { checkForDuplicateIssue } = await import("./github-rest");
    const duplicateCheck = await checkForDuplicateIssue(
      user.accessToken,
      nextTask.owner,
      nextTask.repo,
      nextTask.title,
      nextTask.labels || []
    );
    
    if (duplicateCheck.isDuplicate) {
      console.log(`Duplicate issue found for task ${nextTask.id}: Issue #${duplicateCheck.existingIssue?.number}`);
      
      // Try to assign Copilot agent to existing issue
      try {
        const copilotId = await getCopilotNodeId(user.accessToken);
        const issueNodeId = await getIssueNodeId(user.accessToken, nextTask.owner, nextTask.repo, duplicateCheck.existingIssue.number);
        await addAssignee(user.accessToken, issueNodeId, copilotId);
        console.log(`Assigned Copilot agent to existing issue #${duplicateCheck.existingIssue.number}`);
      } catch (error) {
        console.warn("Failed to assign Copilot agent to existing issue:", error);
      }
      
      // Update task with existing issue info instead of creating new one
      await databaseStorage.updateTask(nextTask.id, {
        issueNumber: duplicateCheck.existingIssue.number,
        status: "in_progress"
      });
      
      console.log(`Task ${nextTask.id} linked to existing issue #${duplicateCheck.existingIssue.number}`);
      return;
    }

    // Create GitHub issue only if no duplicate found
    const issue = await createIssue(
      user.accessToken,
      nextTask.owner,
      nextTask.repo,
      nextTask.title,
      nextTask.body,
      nextTask.labels || []
    );

    // Assign Copilot agent
    try {
      const copilotId = await getCopilotNodeId(user.accessToken);
      const issueNodeId = await getIssueNodeId(user.accessToken, nextTask.owner, nextTask.repo, issue.number);
      await addAssignee(user.accessToken, issueNodeId, copilotId);
      console.log(`Successfully assigned Copilot agent to issue #${issue.number}`);
    } catch (error) {
      console.error("Failed to assign Copilot agent:", error);
      // Continue with task even if assignment fails
    }

    // Update task with issue info
    await databaseStorage.updateTask(nextTask.id, {
      issueNumber: issue.number,
    });

    console.log(`Task ${nextTask.id} started successfully`);
  } catch (error) {
    console.error("Error starting next task:", error);
  }
}

export async function markTaskCompleted(taskId: string): Promise<void> {
  try {
    const task = await databaseStorage.getTaskById(taskId);
    if (!task) {
      console.error(`Task ${taskId} not found`);
      return;
    }

    await databaseStorage.updateTask(taskId, {
      status: "completed",
    });

    // Update monthly counter
    const systemState = await databaseStorage.getUserSystemState(task.userId);
    await databaseStorage.updateUserSystemState(task.userId, {
      monthlyDone: (systemState.monthlyDone || 0) + 1,
    });

    console.log(`Task ${taskId} marked as completed`);

    // Start next task if available
    setTimeout(() => {
      startNextIfIdle(task.userId).catch(console.error);
    }, 2000);
  } catch (error) {
    console.error("Error marking task as completed:", error);
  }
}

export async function markTaskFailed(taskId: string, reason?: string): Promise<void> {
  try {
    const task = await databaseStorage.getTaskById(taskId);
    if (!task) {
      console.error(`Task ${taskId} not found`);
      return;
    }

    await databaseStorage.updateTask(taskId, {
      status: "failed",
    });

    console.log(`Task ${taskId} marked as failed: ${reason || 'Unknown error'}`);

    // Start next task if available
    setTimeout(() => {
      startNextIfIdle(task.userId).catch(console.error);
    }, 2000);
  } catch (error) {
    console.error("Error marking task as failed:", error);
  }
}
