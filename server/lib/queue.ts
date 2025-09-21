import { databaseStorage } from './database-storage';
import { createIssue } from './github-rest';

export async function startNextIfIdle(userId: string): Promise<void> {
  try {
    const appState = await databaseStorage.getAppState(userId);

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
      console.log(
        `Monthly limit reached for user ${userId}: ${appState.monthlyDone}/${maxTasks}`
      );
      return;
    }

    const nextTask = queuedTasks[0];

    // Mark task as in progress
    await databaseStorage.updateTask(nextTask.id, {
      status: 'in_progress',
    });

    console.log(`Starting task ${nextTask.id}: ${nextTask.title}`);

    // Get user's GitHub token
    const user = await databaseStorage.getUserById(userId);
    if (!user?.accessToken) {
      throw new Error('No GitHub access token found for user');
    }

    // Check for duplicate issues first
    const { checkForDuplicateIssue } = await import('./github-rest');
    const duplicateCheck = await checkForDuplicateIssue(
      user.accessToken,
      nextTask.owner,
      nextTask.repo,
      nextTask.title,
      nextTask.labels || []
    );

    if (duplicateCheck.isDuplicate) {
      console.log(
        `Duplicate issue found for task ${nextTask.id}: Issue #${duplicateCheck.existingIssue?.number}`
      );

      // Try to assign Copilot agent to existing issue using unified service
      console.log(
        `🔄 [QUEUE] Attempting Copilot assignment to EXISTING issue #${duplicateCheck.existingIssue.number}`
      );
      const { assignCopilotToIssue } = await import('./copilot-assignment');
      const assignmentResult = await assignCopilotToIssue(
        user.accessToken,
        nextTask.owner,
        nextTask.repo,
        duplicateCheck.existingIssue.number
      );

      if (assignmentResult.success) {
        console.log(
          `✅ [QUEUE] SUCCESS: Assigned ${assignmentResult.assignedAgent} to existing issue #${duplicateCheck.existingIssue.number}`
        );
      } else {
        console.warn(
          `❌ [QUEUE] FAILED: Could not assign Copilot to existing issue #${duplicateCheck.existingIssue.number}`
        );
        console.warn(`❌ [QUEUE] Reason: ${assignmentResult.error}`);
        console.warn(
          `❌ [QUEUE] FALLBACK: Task will proceed without Copilot assignment`
        );
      }

      // Update task with existing issue info instead of creating new one
      await databaseStorage.updateTask(nextTask.id, {
        issueNumber: duplicateCheck.existingIssue.number,
        status: 'in_progress',
      });

      console.log(
        `Task ${nextTask.id} linked to existing issue #${duplicateCheck.existingIssue.number}`
      );

      // Task linked to existing issue - log status
      console.log(
        `📧 Task notification: Task ${nextTask.id} linked to existing issue #${duplicateCheck.existingIssue.number} for ${nextTask.owner}/${nextTask.repo}`
      );

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

    // Assign Copilot agent using unified service
    console.log(
      `🔄 [QUEUE] Attempting Copilot assignment to NEW issue #${issue.number}`
    );
    const { assignCopilotToIssue, verifyCopilotAssignment } = await import(
      './copilot-assignment'
    );
    const assignmentResult = await assignCopilotToIssue(
      user.accessToken,
      nextTask.owner,
      nextTask.repo,
      issue.number
    );

    if (assignmentResult.success) {
      console.log(
        `✅ [QUEUE] SUCCESS: Assigned ${assignmentResult.assignedAgent} to new issue #${issue.number}`
      );

      // Double-check assignment worked
      setTimeout(async () => {
        console.log(
          `🔍 [QUEUE] Starting delayed verification for issue #${issue.number}...`
        );
        const verification = await verifyCopilotAssignment(
          user.accessToken,
          nextTask.owner,
          nextTask.repo,
          issue.number
        );
        if (verification.isAssigned) {
          console.log(
            `✅ [QUEUE] VERIFICATION SUCCESS: ${verification.assignedCopilot} confirmed assigned to issue #${issue.number}`
          );
        } else {
          console.error(
            `❌ [QUEUE] VERIFICATION FAILED: Copilot not found in assignees for issue #${issue.number}`
          );
          console.error(
            `❌ [QUEUE] This indicates the assignment did not persist - possible GitHub API issue`
          );
        }
      }, 2000);
    } else {
      console.error(`❌ [QUEUE] ASSIGNMENT FAILED for issue #${issue.number}`);
      console.error(`❌ [QUEUE] Reason: ${assignmentResult.error}`);
      console.error(
        `❌ [QUEUE] FALLBACK: Task will proceed without Copilot assignment`
      );
    }

    // Update task with issue info
    await databaseStorage.updateTask(nextTask.id, {
      issueNumber: issue.number,
    });

    console.log(`Task ${nextTask.id} started successfully`);

    // Log task started
    console.log(
      `📧 Task notification: Task started for ${nextTask.owner}/${nextTask.repo} - Issue #${issue.number}`
    );
  } catch (error) {
    console.error('Error starting next task:', error);
  }
}

export async function markTaskCompleted(taskId: string): Promise<void> {
  try {
    const task = await databaseStorage.getTask(taskId);
    if (!task) {
      console.error(`Task ${taskId} not found`);
      return;
    }

    await databaseStorage.updateTask(taskId, {
      status: 'completed',
    });

    // Update monthly counter for the repository
    const repository = await databaseStorage.getUserRepository(task.userId, task.repositoryId);
    if (repository) {
      await databaseStorage.updateUserRepository(repository.id, {
        monthlyAssignmentsUsed: (repository.monthlyAssignmentsUsed || 0) + 1,
      });
    }

    console.log(`Task ${taskId} marked as completed`);

    // Log task completed
    console.log(
      `📧 Task notification: Task completed for ${task.owner}/${task.repo} - ${task.title}`
    );

    // Start next task if available
    setTimeout(() => {
      startNextIfIdle(task.userId).catch(console.error);
    }, 2000);
  } catch (error) {
    console.error('Error marking task as completed:', error);
  }
}

export async function markTaskFailed(
  taskId: string,
  reason?: string
): Promise<void> {
  try {
    const task = await databaseStorage.getTask(taskId);
    if (!task) {
      console.error(`Task ${taskId} not found`);
      return;
    }

    await databaseStorage.updateTask(taskId, {
      status: 'failed',
    });

    console.log(
      `Task ${taskId} marked as failed: ${reason || 'Unknown error'}`
    );

    // Log task failed
    console.log(
      `📧 Task notification: Task failed for ${task.owner}/${task.repo} - ${task.title} (${reason})`
    );

    // Start next task if available
    setTimeout(() => {
      startNextIfIdle(task.userId).catch(console.error);
    }, 2000);
  } catch (error) {
    console.error('Error marking task as failed:', error);
  }
}
