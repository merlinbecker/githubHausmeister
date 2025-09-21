// Stub for removed notification service
export const NotificationService = {
  sendNotification: () => Promise.resolve({ sent: 0, failed: 0 })
};

export enum NotificationType {
  TASK_STARTED = 'task_started',
  TASK_COMPLETED = 'task_completed', 
  TASK_FAILED = 'task_failed'
}