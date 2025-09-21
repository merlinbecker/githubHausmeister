import { databaseStorage } from './database-storage';

export enum NotificationType {
  TASK_STARTED = 'taskStarted',
  TASK_COMPLETED = 'taskCompleted',
  TASK_FAILED = 'taskFailed',
  PR_CREATED = 'prCreated',
  PR_MERGED = 'prMerged',
  CI_STATUS_CHANGED = 'ciStatusChanged',
  COPILOT_ASSIGNED = 'copilotAssigned',
}

export interface NotificationContext {
  userId: string;
  repositoryName?: string;
  taskTitle?: string;
  issueNumber?: number;
  pullNumber?: number;
  copilotAgent?: string;
  error?: string;
  url?: string;
  data?: any;
}

export interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
  tag?: string;
  url?: string;
  data?: any;
}

export class NotificationService {
  private static getNotificationContent(
    type: NotificationType,
    context: NotificationContext
  ): NotificationPayload {
    const repo = context.repositoryName || 'Repository';

    switch (type) {
      case NotificationType.TASK_STARTED:
        return {
          title: '🚀 Task gestartet',
          body: `Task "${context.taskTitle}" wurde in ${repo} gestartet`,
          icon: '/icon-192.png',
          tag: 'task-started',
          url: context.url || '/',
          data: { type, context },
        };

      case NotificationType.TASK_COMPLETED:
        return {
          title: '✅ Task abgeschlossen',
          body: `Task "${context.taskTitle}" wurde erfolgreich in ${repo} abgeschlossen`,
          icon: '/icon-192.png',
          tag: 'task-completed',
          url: context.url || '/',
          data: { type, context },
        };

      case NotificationType.TASK_FAILED:
        return {
          title: '❌ Task fehlgeschlagen',
          body: `Task "${context.taskTitle}" ist in ${repo} fehlgeschlagen`,
          icon: '/icon-192.png',
          tag: 'task-failed',
          url: context.url || '/',
          data: { type, context },
        };

      case NotificationType.PR_CREATED:
        return {
          title: '📄 Pull Request erstellt',
          body: `PR #${context.pullNumber} wurde in ${repo} erstellt`,
          icon: '/icon-192.png',
          tag: 'pr-created',
          url: context.url || '/',
          data: { type, context },
        };

      case NotificationType.PR_MERGED:
        return {
          title: '🎉 Pull Request gemerged',
          body: `PR #${context.pullNumber} wurde in ${repo} gemerged`,
          icon: '/icon-192.png',
          tag: 'pr-merged',
          url: context.url || '/',
          data: { type, context },
        };

      case NotificationType.COPILOT_ASSIGNED:
        return {
          title: '🤖 Copilot zugewiesen',
          body: `${context.copilotAgent} wurde Issue #${context.issueNumber} in ${repo} zugewiesen`,
          icon: '/icon-192.png',
          tag: 'copilot-assigned',
          url: context.url || '/',
          data: { type, context },
        };

      case NotificationType.CI_STATUS_CHANGED:
        return {
          title: '⚙️ CI Status geändert',
          body: `Neuer Status für PR #${context.pullNumber} in ${repo}`,
          icon: '/icon-192.png',
          tag: 'ci-status',
          url: context.url || '/',
          data: { type, context },
        };

      default:
        return {
          title: 'GitHub Hausmeister',
          body: 'Neue Aktivität in Ihrer Repository-Wartung',
          icon: '/icon-192.png',
          tag: 'notification',
          url: context.url || '/',
          data: { type, context },
        };
    }
  }

  public static async sendNotification(
    type: NotificationType,
    context: NotificationContext
  ): Promise<{
    sent: number;
    failed: number;
  }> {
    try {
      // Generate notification content
      const payload = this.getNotificationContent(type, context);

      // For now, we just log the notification since push notifications table was removed
      // TODO: Implement alternative notification system if needed
      console.log(
        `[NOTIFICATION] ${type} for user ${context.userId}: ${payload.title} - ${payload.body}`
      );

      return {
        sent: 1, // We consider console logging as "sent"
        failed: 0,
      };
    } catch (error) {
      console.error(`Error sending ${type} notification:`, error);
      return { sent: 0, failed: 1 };
    }
  }
}