import { databaseStorage } from './database-storage';
import {
  sendPushToMultipleSubscriptions,
  type NotificationPayload,
} from './webPush';
import { MentraService } from './mentraService';

export enum NotificationType {
  TASK_STARTED = 'taskStarted',
  TASK_COMPLETED = 'taskCompleted',
  TASK_FAILED = 'taskFailed',
  PR_CREATED = 'prCreated',
  PR_MERGED = 'prMerged',
  CI_STATUS_CHANGED = 'ciStatusChanged',
  COPILOT_ASSIGNED = 'copilotAssigned',
  // mentraOS specific notifications
  GLASS_COMMAND_EXECUTED = 'glassCommandExecuted',
  GLASS_STATUS_UPDATE = 'glassStatusUpdate',
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
          body: `"${context.taskTitle}" in ${repo}`,
          icon: '/icon-192.png',
          tag: 'task-started',
          url: context.url || '/',
          data: { type, context },
        };

      case NotificationType.TASK_COMPLETED:
        return {
          title: '✅ Task abgeschlossen',
          body: `"${context.taskTitle}" in ${repo} erfolgreich beendet`,
          icon: '/icon-192.png',
          tag: 'task-completed',
          url: context.url || '/',
          data: { type, context },
        };

      case NotificationType.TASK_FAILED:
        return {
          title: '❌ Task fehlgeschlagen',
          body: `"${context.taskTitle}" in ${repo}: ${context.error || 'Unbekannter Fehler'}`,
          icon: '/icon-192.png',
          tag: 'task-failed',
          url: context.url || '/',
          data: { type, context },
        };

      case NotificationType.PR_CREATED:
        return {
          title: '📝 Pull Request erstellt',
          body: `Copilot hat PR #${context.pullNumber} in ${repo} geöffnet`,
          icon: '/icon-192.png',
          tag: 'pr-created',
          url: context.url || '/',
          data: { type, context },
        };

      case NotificationType.PR_MERGED:
        return {
          title: '🎉 Pull Request gemergt',
          body: `PR #${context.pullNumber} in ${repo} wurde automatisch gemergt`,
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
          title: '🔄 CI-Status geändert',
          body: `Neuer Status für PR #${context.pullNumber} in ${repo}`,
          icon: '/icon-192.png',
          tag: 'ci-status',
          url: context.url || '/',
          data: { type, context },
        };

      case NotificationType.GLASS_COMMAND_EXECUTED:
        return {
          title: '🤖 Befehl ausgeführt',
          body: context.data?.message || 'Sprachbefehl wurde verarbeitet',
          icon: '/icon-192.png',
          tag: 'glass-command',
          url: context.url || '/',
          data: { type, context },
        };

      case NotificationType.GLASS_STATUS_UPDATE:
        return {
          title: '📊 Status Update',
          body: context.data?.message || 'System Status wurde aktualisiert',
          icon: '/icon-192.png',
          tag: 'glass-status',
          url: context.url || '/',
          data: { type, context },
        };

      default:
        return {
          title: 'GitHub Hausmeister',
          body: 'Neue Aktivität in Ihrer Repository-Wartung',
          icon: '/icon-192.png',
          tag: 'general',
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
    glassSent: number;
    glassFailed: number;
  }> {
    try {
      // Get user's notification settings
      const settings = await databaseStorage.getUserNotificationSettings(
        context.userId
      );

      // Check if this notification type is enabled
      const settingKey = type as keyof typeof settings;
      if (settings[settingKey] === false) {
        console.log(`Notification ${type} disabled for user ${context.userId}`);
        return { sent: 0, failed: 0, glassSent: 0, glassFailed: 0 };
      }

      // Generate notification content
      const payload = this.getNotificationContent(type, context);

      let webResults = { successful: 0, failed: 0 };
      const glassResults = { sent: 0, failed: 0 };

      // Send to web push subscriptions
      const subscriptions = await databaseStorage.getUserPushSubscriptions(
        context.userId
      );

      if (subscriptions.length > 0) {
        const pushSubscriptions = subscriptions.map((sub) => ({
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dhKey,
            auth: sub.authKey,
          },
        }));

        webResults = await sendPushToMultipleSubscriptions(
          pushSubscriptions,
          payload
        );
      }

      // Send to mentraOS glasses
      const glasses = await databaseStorage.getUserGlasses(context.userId);

      if (glasses.length > 0) {
        const glassPromises = glasses.map(async (glass) => {
          try {
            await MentraService.sendNotificationToGlass({
              glassId: glass.glassId,
              notification: {
                type: 'text',
                title: payload.title,
                message: payload.body,
              },
            });
            return { success: true };
          } catch (error) {
            console.error(
              `Failed to send notification to glass ${glass.glassId}:`,
              error
            );
            return { success: false };
          }
        });

        const glassResultsArray = await Promise.allSettled(glassPromises);
        glassResults.sent = glassResultsArray.filter(
          (result) => result.status === 'fulfilled' && result.value.success
        ).length;
        glassResults.failed = glassResultsArray.length - glassResults.sent;
      }

      console.log(
        `Sent ${type} notification to user ${context.userId}: Web: ${webResults.successful}/${webResults.failed}, Glass: ${glassResults.sent}/${glassResults.failed}`
      );

      return {
        sent: webResults.successful,
        failed: webResults.failed,
        glassSent: glassResults.sent,
        glassFailed: glassResults.failed,
      };
    } catch (error) {
      console.error(`Error sending ${type} notification:`, error);
      return { sent: 0, failed: 1, glassSent: 0, glassFailed: 0 };
    }
  }
}
