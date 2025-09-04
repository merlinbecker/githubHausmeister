import { randomBytes } from 'crypto';
import { databaseStorage } from './database-storage';
import {
  type MentraGlass,
  type InsertMentraGlass,
  type InsertMentraSession,
  type InsertVoiceCommand,
  type InsertGlassNotification,
  type VoiceCommand,
  type GlassNotification,
} from '@shared/schema';

export enum VoiceCommandType {
  STATUS_CHECK = 'status_check',
  TASK_CREATE = 'task_create',
  TASK_LIST = 'task_list',
  REPO_STATUS = 'repo_status',
  HELP = 'help',
  UNKNOWN = 'unknown',
}

export interface VoiceCommandContext {
  userId: string;
  glassId: string;
  originalText: string;
  commandType: VoiceCommandType;
  params: Record<string, any>;
}

export interface MentraNotificationPayload {
  type: 'text' | 'image' | 'combined';
  title: string;
  message: string;
  imageUrl?: string;
  imageData?: string; // Base64 encoded
}

export interface GlassPairingRequest {
  userId: string;
  glassId: string;
  glassName: string;
  deviceModel?: string;
  apiEndpoint?: string;
}

export interface VoiceCommandRequest {
  glassId: string;
  sessionToken: string;
  voiceText: string;
  timestamp: string;
}

export interface MentraPushRequest {
  glassId: string;
  notification: MentraNotificationPayload;
}

export class MentraService {
  /**
   * Generate a secure pairing token for glass registration
   */
  private static generatePairingToken(): string {
    return randomBytes(32).toString('hex');
  }

  /**
   * Generate a session token for active glass sessions
   */
  private static generateSessionToken(): string {
    return randomBytes(24).toString('hex');
  }

  /**
   * Register/pair a new glass with a user account
   */
  public static async registerGlass(
    pairingRequest: GlassPairingRequest
  ): Promise<{ glass: MentraGlass; pairingToken: string }> {
    const { userId, glassId, glassName, deviceModel, apiEndpoint } = pairingRequest;

    // Check if glass is already registered
    const existingGlass = await databaseStorage.getGlassByGlassId(glassId);
    if (existingGlass) {
      if (existingGlass.userId === userId && existingGlass.isActive) {
        throw new Error('Glass already registered to this user');
      } else if (existingGlass.userId !== userId) {
        throw new Error('Glass is registered to another user');
      }
    }

    const pairingToken = this.generatePairingToken();

    const glassData: InsertMentraGlass = {
      userId,
      glassId,
      glassName,
      deviceModel: deviceModel || 'evenrealities G1',
      pairingToken,
      isActive: true,
      apiEndpoint,
    };

    const glass = await databaseStorage.addGlass(glassData);
    
    console.log(`✅ Glass registered: ${glassId} for user ${userId}`);
    return { glass, pairingToken };
  }

  /**
   * Create an active session for a registered glass
   */
  public static async createSession(
    glassId: string,
    pairingToken: string
  ): Promise<{ sessionToken: string; expiresAt: Date }> {
    const glass = await databaseStorage.getGlassByGlassId(glassId);
    if (!glass) {
      throw new Error('Glass not found');
    }

    if (!glass.isActive) {
      throw new Error('Glass is not active');
    }

    if (glass.pairingToken !== pairingToken) {
      throw new Error('Invalid pairing token');
    }

    // Deactivate any existing sessions for this glass
    const existingSession = await databaseStorage.getActiveSession(glass.id);
    if (existingSession) {
      await databaseStorage.deactivateSession(existingSession.id);
    }

    const sessionToken = this.generateSessionToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const sessionData: InsertMentraSession = {
      glassId: glass.id,
      sessionToken,
      isActive: true,
      expiresAt,
    };

    await databaseStorage.createSession(sessionData);
    
    // Update last seen timestamp
    await databaseStorage.updateGlass(glass.id, { lastSeen: new Date() });

    console.log(`✅ Session created for glass ${glassId}`);
    return { sessionToken, expiresAt };
  }

  /**
   * Validate and authenticate a glass session
   */
  public static async validateSession(
    glassId: string,
    sessionToken: string
  ): Promise<MentraGlass> {
    const glass = await databaseStorage.getGlassByGlassId(glassId);
    if (!glass) {
      throw new Error('Glass not found');
    }

    if (!glass.isActive) {
      throw new Error('Glass is not active');
    }

    const session = await databaseStorage.getActiveSession(glass.id);
    if (!session) {
      throw new Error('No active session found');
    }

    if (session.sessionToken !== sessionToken) {
      throw new Error('Invalid session token');
    }

    if (session.expiresAt && session.expiresAt < new Date()) {
      await databaseStorage.deactivateSession(session.id);
      throw new Error('Session expired');
    }

    // Update session activity
    await databaseStorage.updateSessionActivity(session.id);
    await databaseStorage.updateGlass(glass.id, { lastSeen: new Date() });

    return glass;
  }

  /**
   * Parse voice command text and extract command type and parameters
   */
  private static parseVoiceCommand(voiceText: string): {
    commandType: VoiceCommandType;
    params: Record<string, any>;
  } {
    const normalizedText = voiceText.toLowerCase().trim();

    // Status check commands
    if (normalizedText.includes('status') || normalizedText.includes('wie geht')) {
      return { commandType: VoiceCommandType.STATUS_CHECK, params: {} };
    }

    // Task creation commands
    if (normalizedText.includes('erstelle') || normalizedText.includes('create task')) {
      return {
        commandType: VoiceCommandType.TASK_CREATE,
        params: { originalText: voiceText },
      };
    }

    // Task listing commands
    if (normalizedText.includes('aufgaben') || normalizedText.includes('list tasks')) {
      return { commandType: VoiceCommandType.TASK_LIST, params: {} };
    }

    // Repository status commands
    if (normalizedText.includes('repository') || normalizedText.includes('repo')) {
      return { commandType: VoiceCommandType.REPO_STATUS, params: {} };
    }

    // Help commands
    if (normalizedText.includes('hilfe') || normalizedText.includes('help')) {
      return { commandType: VoiceCommandType.HELP, params: {} };
    }

    // Unknown command
    return { commandType: VoiceCommandType.UNKNOWN, params: { originalText: voiceText } };
  }

  /**
   * Process a voice command from a glass
   */
  public static async processVoiceCommand(
    commandRequest: VoiceCommandRequest
  ): Promise<VoiceCommand> {
    const { glassId, sessionToken, voiceText } = commandRequest;

    // Validate session
    const glass = await this.validateSession(glassId, sessionToken);

    // Parse command
    const { commandType, params } = this.parseVoiceCommand(voiceText);

    // Save voice command to database
    const commandData: InsertVoiceCommand = {
      userId: glass.userId,
      glassId: glass.id,
      originalText: voiceText,
      normalizedCommand: voiceText.toLowerCase().trim(),
      commandType,
      commandParams: params,
      executionStatus: 'pending',
    };

    const voiceCommand = await databaseStorage.addVoiceCommand(commandData);

    // Execute command asynchronously
    this.executeVoiceCommand(voiceCommand).catch(error => {
      console.error(`Error executing voice command ${voiceCommand.id}:`, error);
    });

    console.log(`📢 Voice command received: ${commandType} from glass ${glassId}`);
    return voiceCommand;
  }

  /**
   * Execute a voice command and update its status
   */
  private static async executeVoiceCommand(command: VoiceCommand): Promise<void> {
    try {
      let result: Record<string, any> = {};

      switch (command.commandType) {
        case VoiceCommandType.STATUS_CHECK: {
          const userState = await databaseStorage.getUserSystemState(command.userId);
          result = {
            monthlyDone: userState.monthlyDone,
            systemRunning: userState.systemRunning,
            message: `System läuft. ${userState.monthlyDone} Aufgaben diesen Monat erledigt.`,
          };
          break;
        }

        case VoiceCommandType.TASK_LIST: {
          const userTasks = await databaseStorage.getUserTasks(command.userId, 5);
          result = {
            taskCount: userTasks.length,
            recentTasks: userTasks.map(t => ({ title: t.title, status: t.status })),
            message: `${userTasks.length} aktuelle Aufgaben gefunden.`,
          };
          break;
        }

        case VoiceCommandType.REPO_STATUS: {
          const userRepos = await databaseStorage.getUserRepositories(command.userId);
          result = {
            repositoryCount: userRepos.length,
            repositories: userRepos.map(r => ({ name: `${r.owner}/${r.repo}`, active: r.isActive })),
            message: `${userRepos.length} Repositories überwacht.`,
          };
          break;
        }

        case VoiceCommandType.HELP:
          result = {
            commands: [
              'Status abfragen',
              'Aufgaben anzeigen',
              'Repository Status',
              'Hilfe anzeigen',
            ],
            message: 'Verfügbare Sprachbefehle angezeigt.',
          };
          break;

        case VoiceCommandType.TASK_CREATE:
        case VoiceCommandType.UNKNOWN:
        default:
          result = {
            message: 'Befehl wurde empfangen, aber noch nicht implementiert.',
            suggestion: 'Versuchen Sie: Status, Aufgaben, Repository oder Hilfe',
          };
          break;
      }

      await databaseStorage.updateVoiceCommandStatus(command.id, {
        executionStatus: 'executed',
        result,
        processedAt: new Date(),
      });

      // Send result back to glass as notification
      await this.sendNotificationToGlass({
        glassId: command.glassId!,
        notification: {
          type: 'text',
          title: 'Sprachbefehl',
          message: result.message || 'Befehl ausgeführt',
        },
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unbekannter Fehler';
      
      await databaseStorage.updateVoiceCommandStatus(command.id, {
        executionStatus: 'failed',
        errorMessage,
        processedAt: new Date(),
      });

      console.error(`Voice command execution failed:`, error);
    }
  }

  /**
   * Send a notification to a glass
   */
  public static async sendNotificationToGlass(
    pushRequest: MentraPushRequest
  ): Promise<GlassNotification> {
    const { glassId, notification } = pushRequest;

    // Find glass by glassId  
    const glass = await databaseStorage.getGlassByGlassId(glassId);
    if (!glass) {
      throw new Error('Glass not found');
    }

    if (!glass.isActive) {
      throw new Error('Glass is not active');
    }

    // Save notification to database
    const notificationData: InsertGlassNotification = {
      userId: glass.userId,
      glassId: glass.id,
      notificationType: notification.type,
      title: notification.title,
      message: notification.message,
      imageUrl: notification.imageUrl,
      imageData: notification.imageData,
      deliveryStatus: 'pending',
    };

    const glassNotification = await databaseStorage.addGlassNotification(notificationData);

    // TODO: Integrate with actual mentraOS API to send notification
    // For now, we'll simulate the sending process
    setTimeout(async () => {
      try {
        // Simulate API call to mentraOS
        const mentraMessageId = `mentra_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        await databaseStorage.updateGlassNotificationStatus(glassNotification.id, {
          deliveryStatus: 'sent',
          mentraMessageId,
          sentAt: new Date(),
        });

        console.log(`📱 Notification sent to glass ${glassId}: ${notification.title}`);
      } catch (error) {
        await databaseStorage.updateGlassNotificationStatus(glassNotification.id, {
          deliveryStatus: 'failed',
        });
        console.error('Failed to send notification to glass:', error);
      }
    }, 1000);

    return glassNotification;
  }

  /**
   * Get glass status and statistics for a user
   */
  public static async getGlassStatus(userId: string): Promise<{
    glasses: MentraGlass[];
    totalNotifications: number;
    recentCommands: VoiceCommand[];
  }> {
    const glasses = await databaseStorage.getUserGlasses(userId);
    const recentCommands = await databaseStorage.getUserVoiceCommands(userId, 10);
    const totalNotifications = (await databaseStorage.getUserGlassNotifications(userId)).length;

    return {
      glasses,
      totalNotifications,
      recentCommands,
    };
  }
}