import type { Express } from 'express';
import { createServer, type Server } from 'http';
import session from 'express-session';
import connectPg from 'connect-pg-simple';
import { randomUUID } from 'crypto';
import { databaseStorage } from './lib/database-storage';
import { insertTaskSchema, type LegacyTaskTemplate, type TaskTemplate } from '@shared/schema';
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
  listRepositoryIssues,
  listRepositoryCollaborators,
  listPRsForIssue,
} from './lib/github-rest';
import { isPRGreen } from './lib/ci';
import { GitHubOAuth } from './lib/github-oauth';
import {
  requireAuth,
  optionalAuth,
  type AuthenticatedRequest,
} from './lib/auth-middleware';
import { ServiceFactory } from './lib/service-factory';
import { isMockModeEnabled } from './lib/feature-flags';
import type { MockAuthService } from './lib/mock-auth-service';
import { initializeWebPush } from './lib/webPush';
import { MentraService } from './lib/mentraService';

// Extend session types
declare module 'express-session' {
  interface Session {
    oauthState?: string;
    oauthTimestamp?: number;
    userId?: string;
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Initialize web-push with VAPID keys
  const webPushInitialized = initializeWebPush();
  if (!webPushInitialized) {
    console.warn('⚠️ Push notifications will not be available');
  }

  // Session configuration
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: true, // Allow automatic table creation
    ttl: sessionTtl,
    tableName: 'sessions',
  });

  // Log session store connection
  sessionStore.on('connect', () => {
    console.log('✅ Session store connected to PostgreSQL');
  });

  sessionStore.on('disconnect', () => {
    console.log('❌ Session store disconnected from PostgreSQL');
  });

  app.use(
    session({
      secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
      store: sessionStore,
      resave: false, // Don't force session save when nothing changed
      saveUninitialized: false, // Don't save empty sessions
      rolling: false, // Don't reset expiry on each request
      cookie: {
        httpOnly: true,
        secure: false, // Always false for Replit dev environment
        maxAge: sessionTtl,
        sameSite: 'lax', // Consistent across environments
      },
      name: 'github-hausmeister-session', // Explicit session name
    })
  );

  // GitHub OAuth setup using ServiceFactory
  // Construct the correct redirect URI using Replit's environment variables
  const replitDomain =
    process.env.REPLIT_DEV_DOMAIN ||
    (process.env.REPL_SLUG && process.env.REPL_OWNER
      ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`
      : 'http://localhost:5000');

  const oauthConfig = {
    clientId: process.env.GITHUB_CLIENT_ID || '',
    clientSecret: process.env.GITHUB_CLIENT_SECRET || '',
    redirectUri:
      process.env.GITHUB_REDIRECT_URI ||
      `${replitDomain}/api/auth/github/callback`,
  };

  const authService = ServiceFactory.createAuthService(oauthConfig);

  console.log(
    `🔧 Using ${ServiceFactory.getServiceType()} authentication service`
  );
  console.log(
    `GitHub OAuth redirect URI: ${process.env.GITHUB_REDIRECT_URI || `${replitDomain}/api/auth/github/callback`}`
  );

  // Mock Authentication Routes (when MOCK_LOGIN=true)
  if (isMockModeEnabled()) {
    const mockAuthService = authService as MockAuthService;

    // Get available mock users for selection
    app.get('/api/auth/mock/users', (req, res) => {
      const users = mockAuthService.getAvailableUsers();
      res.json({ users, mode: 'mock' });
    });

    // Mock login route - bypasses OAuth flow
    app.get('/api/auth/mock/login/:userId', async (req, res) => {
      try {
        const { userId } = req.params;

        console.log(`🎭 [MOCK AUTH] Mock login attempt for user: ${userId}`);

        // Get user info to validate
        const users = mockAuthService.getAvailableUsers();
        const selectedUser = users.find((u) => u.id === userId);

        if (!selectedUser) {
          return res.status(400).json({
            error: 'Invalid mock user ID',
            availableUsers: users.map((u) => u.id),
          });
        }

        // Exchange for token (in mock mode, userId is the 'code')
        const { accessToken } =
          await mockAuthService.exchangeCodeForToken(userId);

        // Get full user info
        const githubUser = await mockAuthService.getUserInfo(accessToken);

        // Create or update user in database
        const user = await databaseStorage.createOrUpdateUser({
          id: githubUser.id,
          username: githubUser.login,
          email: githubUser.email,
          avatarUrl: githubUser.avatar_url,
          accessToken,
          refreshToken: `refresh-${accessToken}`,
          tokenExpiresAt: undefined,
        });

        // Set session
        if (!req.session) {
          return res.status(500).json({ error: 'Session not initialized' });
        }

        req.session.userId = user.id;

        console.log(
          `✅ [MOCK AUTH] Successfully logged in mock user: ${githubUser.login}`
        );

        res.json({
          success: true,
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            avatarUrl: user.avatarUrl,
          },
          mode: 'mock',
        });
      } catch (error) {
        console.error('❌ [MOCK AUTH] Mock login error:', error);
        res.status(500).json({ error: 'Mock authentication failed' });
      }
    });

    // Quick login route for default user (testing convenience)
    app.get('/api/auth/mock/quick-login', async (req, res) => {
      const defaultUser = mockAuthService.getDefaultUser();
      if (!defaultUser) {
        return res
          .status(500)
          .json({ error: 'No default mock user configured' });
      }

      // Redirect to regular mock login
      res.redirect(`/api/auth/mock/login/${defaultUser.id}`);
    });
  }

  // Check if mock mode is enabled (for frontend)
  app.get('/api/auth/mode', (req, res) => {
    res.json({
      mockMode: isMockModeEnabled(),
      serviceType: ServiceFactory.getServiceType(),
    });
  });

  // GitHub OAuth routes
  app.get('/api/auth/github', (req, res) => {
    // In mock mode, redirect to mock user selection
    if (isMockModeEnabled()) {
      return res.redirect('/mock-login');
    }

    // Ensure session exists
    if (!req.session) {
      console.error('❌ No session available');
      return res.status(500).json({ error: 'Session not initialized' });
    }

    const state = randomUUID();

    console.log('🔑 Starting OAuth flow:', {
      sessionId: req.session.id,
      state,
      userAgent: req.get('User-Agent'),
      cookies: req.headers.cookie,
      sessionStore: !!sessionStore,
    });

    // Initialize session with OAuth state
    req.session.oauthState = state;
    req.session.oauthTimestamp = Date.now();

    // Force session save with callback
    req.session.save((err) => {
      if (err) {
        console.error('❌ Session save error:', err);
        return res.status(500).json({ error: 'Session error' });
      }

      console.log('✅ Session saved successfully:', {
        sessionId: req.session?.id,
        oauthState: req.session?.oauthState,
        timestamp: req.session?.oauthTimestamp,
      });

      const authUrl = (authService as GitHubOAuth).getAuthorizationUrl(state);
      console.log('🔀 Redirecting to GitHub:', authUrl);
      res.redirect(authUrl);
    });
  });

  app.get('/api/auth/github/callback', async (req, res) => {
    try {
      const { code, state, error, error_description } = req.query;

      // Extended debug logging
      console.log('🔍 OAuth callback debug:');
      console.log('- Full query params:', req.query);
      console.log('- Received code:', !!code);
      console.log('- Received state:', state);
      console.log('- Session available:', !!req.session);
      console.log('- Session ID:', req.session?.id);
      console.log(
        '- Session keys:',
        req.session ? Object.keys(req.session) : 'no session'
      );
      console.log('- User-Agent:', req.get('User-Agent'));
      console.log('- Cookies received:', req.headers.cookie);
      console.log('- Session store connected:', sessionStore ? 'yes' : 'no');
      console.log(
        '- Full session object:',
        JSON.stringify(req.session, null, 2)
      );

      const sessionState = req.session?.oauthState;
      console.log('- Session state:', sessionState);
      console.log('- Session timestamp:', req.session?.oauthTimestamp);
      console.log(
        '- Time since OAuth start:',
        req.session?.oauthTimestamp
          ? Date.now() - req.session.oauthTimestamp
          : 'unknown'
      );
      console.log('- States match:', state === sessionState);

      // Check for GitHub OAuth errors first
      if (error) {
        console.error('GitHub OAuth error:', error, error_description);
        return res.status(400).json({
          error: 'GitHub OAuth error',
          details: error_description || error,
        });
      }

      if (!code) {
        console.error('No authorization code received');
        return res.status(400).json({
          error: 'No authorization code received',
          debug: { query: req.query },
        });
      }

      if (!state) {
        console.error('No state parameter received');
        return res.status(400).json({
          error: 'No state parameter received',
          debug: { query: req.query },
        });
      }

      if (!sessionState) {
        console.error('No session state found');
        return res.status(400).json({
          error: 'Session expired or invalid',
          debug: {
            hasSession: !!req.session,
            sessionKeys: Object.keys(req.session || {}),
          },
        });
      }

      if (state !== sessionState) {
        console.error('State mismatch:', {
          received: state,
          expected: sessionState,
        });
        return res.status(400).json({
          error: 'State parameter mismatch',
          debug: { receivedState: state, sessionState },
        });
      }

      // Exchange code for token
      const { accessToken, refreshToken } = await (
        authService as GitHubOAuth
      ).exchangeCodeForToken(code as string, state as string);

      // Get user info
      const githubUser = await (authService as GitHubOAuth).getUserInfo(
        accessToken
      );

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
      const { accessToken: _, ...userWithoutToken } = req.user;
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

  // Get user webhook forward URL
  app.get(
    '/api/user/webhook-forward-url',
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const user = await databaseStorage.getUserById(req.user!.id);
        res.json({ forwardUrl: user?.webhookForwardUrl || null });
      } catch (error) {
        console.error('Error getting webhook forward URL:', error);
        res.status(500).json({ error: 'Failed to get webhook forward URL' });
      }
    }
  );

  // Set user webhook forward URL
  app.post(
    '/api/user/webhook-forward-url',
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { forwardUrl } = req.body;

        // Validate URL format if provided
        if (forwardUrl) {
          try {
            new URL(forwardUrl);
            // Only allow HTTPS URLs (except localhost for development)
            if (!forwardUrl.startsWith('https://') && !forwardUrl.startsWith('http://localhost')) {
              return res.status(400).json({ 
                error: 'Only HTTPS URLs are allowed (except localhost for development)' 
              });
            }
          } catch {
            return res.status(400).json({ error: 'Invalid URL format' });
          }
        }

        await databaseStorage.updateUser(req.user!.id, {
          webhookForwardUrl: forwardUrl || null,
        });

        res.json({ success: true, forwardUrl: forwardUrl || null });
      } catch (error) {
        console.error('Error setting webhook forward URL:', error);
        res.status(500).json({ error: 'Failed to set webhook forward URL' });
      }
    }
  );

  // Get user repositories from GitHub
  app.get(
    '/api/repositories',
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const repositories = await authService.getUserRepositories(
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

        const webhook = await authService.registerWebhook(
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
            await (authService as GitHubOAuth).deleteWebhook(
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

        // Get custom templates for this repository
        const customTemplates = await databaseStorage.getTaskTemplates(
          req.user!.id,
          repository.id
        );

        // Create a map of custom templates by type for quick lookup
        const customTemplateMap = new Map<string, TaskTemplate>();
        customTemplates.forEach(template => {
          customTemplateMap.set(template.type, template);
        });

        // Default fallback templates (legacy support)
        const defaultTemplates: Record<string, LegacyTaskTemplate> = {
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
            // First try to use custom template, then fall back to default
            const customTemplate = customTemplateMap.get(templateKey);
            const defaultTemplate = defaultTemplates[templateKey];
            
            if (!customTemplate && !defaultTemplate) continue;

            // Use custom template data if available, otherwise use default
            const templateData = customTemplate || {
              title: defaultTemplate!.title,
              body: defaultTemplate!.body,
              labels: defaultTemplate!.labels,
              milestone: defaultTemplate!.milestone || null,
            };

            const taskData = insertTaskSchema.parse({
              userId: req.user!.id,
              repositoryId: repository.id,
              owner: repository.owner,
              repo: repository.repo,
              title: templateData.title,
              body: templateData.body,
              labels: templateData.labels as string[],
              milestone: templateData.milestone,
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

  // Task Template Management Endpoints

  // Get templates for a repository
  app.get(
    '/api/repositories/:repositoryId/templates',
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { repositoryId } = req.params;
        
        // Verify user owns the repository
        const repository = await databaseStorage.getUserRepository(
          req.user!.id,
          repositoryId
        );
        if (!repository) {
          return res.status(404).json({ error: 'Repository not found' });
        }

        const templates = await databaseStorage.getTaskTemplates(
          req.user!.id,
          repositoryId
        );

        res.json({ templates });
      } catch (error) {
        console.error('Error fetching templates:', error);
        res.status(500).json({ error: 'Failed to fetch templates' });
      }
    }
  );

  // Create or update a template
  app.post(
    '/api/repositories/:repositoryId/templates',
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { repositoryId } = req.params;
        const { type, title, body, labels, milestone } = req.body;

        if (!type || !title || !body) {
          return res.status(400).json({ 
            error: 'Type, title, and body are required' 
          });
        }

        // Verify user owns the repository
        const repository = await databaseStorage.getUserRepository(
          req.user!.id,
          repositoryId
        );
        if (!repository) {
          return res.status(404).json({ error: 'Repository not found' });
        }

        // Check if template already exists for this type
        const existingTemplate = await databaseStorage.getTaskTemplateByType(
          req.user!.id,
          repositoryId,
          type
        );

        let template;
        if (existingTemplate) {
          // Update existing template
          template = await databaseStorage.updateTaskTemplate(
            existingTemplate.id,
            { title, body, labels: labels || [], milestone }
          );
        } else {
          // Create new template
          template = await databaseStorage.createTaskTemplate({
            userId: req.user!.id,
            repositoryId,
            type,
            title,
            body,
            labels: labels || [],
            milestone,
            isActive: true,
          });
        }

        res.json({ template });
      } catch (error) {
        console.error('Error creating/updating template:', error);
        res.status(500).json({ error: 'Failed to save template' });
      }
    }
  );

  // Update a specific template
  app.put(
    '/api/repositories/:repositoryId/templates/:templateId',
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { repositoryId, templateId } = req.params;
        const { title, body, labels, milestone } = req.body;

        // Verify user owns the repository
        const repository = await databaseStorage.getUserRepository(
          req.user!.id,
          repositoryId
        );
        if (!repository) {
          return res.status(404).json({ error: 'Repository not found' });
        }

        // Verify template exists and belongs to user
        const existingTemplate = await databaseStorage.getTaskTemplateById(templateId);
        if (!existingTemplate || existingTemplate.userId !== req.user!.id) {
          return res.status(404).json({ error: 'Template not found' });
        }

        const template = await databaseStorage.updateTaskTemplate(templateId, {
          title,
          body,
          labels: labels || [],
          milestone,
        });

        if (!template) {
          return res.status(404).json({ error: 'Template not found' });
        }

        res.json({ template });
      } catch (error) {
        console.error('Error updating template:', error);
        res.status(500).json({ error: 'Failed to update template' });
      }
    }
  );

  // Delete a template
  app.delete(
    '/api/repositories/:repositoryId/templates/:templateId',
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { repositoryId, templateId } = req.params;

        // Verify user owns the repository
        const repository = await databaseStorage.getUserRepository(
          req.user!.id,
          repositoryId
        );
        if (!repository) {
          return res.status(404).json({ error: 'Repository not found' });
        }

        // Verify template exists and belongs to user
        const existingTemplate = await databaseStorage.getTaskTemplateById(templateId);
        if (!existingTemplate || existingTemplate.userId !== req.user!.id) {
          return res.status(404).json({ error: 'Template not found' });
        }

        const deleted = await databaseStorage.deleteTaskTemplate(templateId);
        if (!deleted) {
          return res.status(404).json({ error: 'Template not found' });
        }

        res.json({ success: true });
      } catch (error) {
        console.error('Error deleting template:', error);
        res.status(500).json({ error: 'Failed to delete template' });
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

  // Debug endpoint to test push notifications directly
  app.post(
    '/api/push/debug-test',
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { NotificationService, NotificationType } = await import(
          './lib/notificationService'
        );

        const result = await NotificationService.sendNotification(
          NotificationType.TASK_COMPLETED,
          {
            userId: req.user!.id,
            repositoryName: 'test-repo',
            taskTitle: 'Debug Test Task',
            url: '/',
          }
        );

        res.json({
          success: true,
          sent: result.sent,
          failed: result.failed,
          message: 'Debug notification sent',
        });
      } catch (error) {
        console.error('Error sending debug notification:', error);
        res.status(500).json({
          error: 'Failed to send debug notification',
          details: error instanceof Error ? error.message : 'Unknown error',
        });
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

  // Push notification endpoints

  // Get VAPID public key
  app.get('/api/push/vapid-public-key', (req, res) => {
    res.json({
      publicKey: process.env.VAPID_PUBLIC_KEY,
    });
  });

  // Subscribe to push notifications
  app.post(
    '/api/push/subscribe',
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { endpoint, keys } = req.body;

        // Import validation function
        const { validatePushSubscription } = await import('./lib/webPush');

        // Validate the subscription data
        const subscriptionData = { endpoint, keys };
        const validation = validatePushSubscription(subscriptionData);

        if (!validation.valid) {
          console.error(
            '❌ Invalid push subscription received:',
            validation.error
          );
          return res.status(400).json({
            error: 'Invalid subscription data',
            details: validation.error,
          });
        }

        console.log('✅ Valid push subscription received from client');

        const subscription = await databaseStorage.addPushSubscription({
          userId: req.user!.id,
          endpoint,
          p256dhKey: keys.p256dh,
          authKey: keys.auth,
          userAgent: req.get('User-Agent'),
        });

        res.json({ success: true, id: subscription.id });
      } catch (error) {
        console.error('Error subscribing to push:', error);
        res.status(500).json({ error: 'Failed to subscribe' });
      }
    }
  );

  // Unsubscribe from push notifications
  app.post(
    '/api/push/unsubscribe',
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { endpoint } = req.body;

        if (!endpoint) {
          return res.status(400).json({
            error: 'Endpoint required',
          });
        }

        await databaseStorage.removePushSubscription(endpoint);
        res.json({ success: true });
      } catch (error) {
        console.error('Error unsubscribing from push:', error);
        res.status(500).json({ error: 'Failed to unsubscribe' });
      }
    }
  );

  // Get notification settings
  app.get(
    '/api/push/settings',
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const settings = await databaseStorage.getUserNotificationSettings(
          req.user!.id
        );
        res.json(settings);
      } catch (error) {
        console.error('Error getting notification settings:', error);
        res.status(500).json({ error: 'Failed to get settings' });
      }
    }
  );

  // Update notification settings
  app.put(
    '/api/push/settings',
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const updates = req.body;
        const settings = await databaseStorage.updateNotificationSettings(
          req.user!.id,
          updates
        );
        res.json(settings);
      } catch (error) {
        console.error('Error updating notification settings:', error);
        res.status(500).json({ error: 'Failed to update settings' });
      }
    }
  );

  // Check if subscription exists on server
  app.post(
    '/api/push/subscription-status',
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { endpoint } = req.body;

        if (!endpoint) {
          return res.status(400).json({
            error: 'Endpoint required',
          });
        }

        const subscriptions = await databaseStorage.getUserPushSubscriptions(
          req.user!.id
        );

        const exists = subscriptions.some((sub) => sub.endpoint === endpoint);

        res.json({ exists });
      } catch (error) {
        console.error('Error checking subscription status:', error);
        res.status(500).json({ error: 'Failed to check subscription status' });
      }
    }
  );

  // Test notification endpoint
  app.post(
    '/api/push/test',
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const subscriptions = await databaseStorage.getUserPushSubscriptions(
          req.user!.id
        );

        if (subscriptions.length === 0) {
          return res.status(404).json({
            error: 'No active subscriptions found',
          });
        }

        const payload = {
          title: 'Test Benachrichtigung',
          body: 'Push-Benachrichtigungen funktionieren!',
          icon: '/icon-192.png',
          url: '/',
          tag: 'test',
        };

        // EXTREME FORCE LOG VISIBILITY - MUST APPEAR
        console.error('❌❌❌ PUSH TEST ENDPOINT CALLED - CRITICAL LOG ❌❌❌');
        console.error(
          '❌❌❌ SUBSCRIPTIONS COUNT:',
          subscriptions.length,
          '❌❌❌'
        );
        console.log(
          '🚀 /api/push/test endpoint called - about to send notifications'
        );
        console.log('📊 User subscriptions found:', subscriptions.length);

        const { sendPushToMultipleSubscriptions } = await import(
          './lib/webPush'
        );
        const results = await sendPushToMultipleSubscriptions(
          subscriptions.map((sub) => ({
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dhKey,
              auth: sub.authKey,
            },
          })),
          payload
        );

        res.json({
          success: true,
          sent: results.successful,
          failed: results.failed,
        });
      } catch (error) {
        console.error('Error sending test notification:', error);
        res.status(500).json({ error: 'Failed to send test' });
      }
    }
  );

  // ======================================
  // mentraOS Smartglasses API Endpoints
  // ======================================

  // Register a new glass with user account
  app.post(
    '/api/mentra/register',
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { glassId, glassName, deviceModel, apiEndpoint } = req.body;

        if (!glassId || !glassName) {
          return res.status(400).json({
            error: 'glassId and glassName are required',
          });
        }

        const { glass, pairingToken } = await MentraService.registerGlass({
          userId: req.user!.id,
          glassId,
          glassName,
          deviceModel,
          apiEndpoint,
        });

        res.json({
          success: true,
          glass: {
            id: glass.id,
            glassId: glass.glassId,
            glassName: glass.glassName,
            deviceModel: glass.deviceModel,
            isActive: glass.isActive,
            createdAt: glass.createdAt,
          },
          pairingToken,
        });
      } catch (error) {
        console.error('Error registering glass:', error);
        const message =
          error instanceof Error ? error.message : 'Failed to register glass';
        res.status(400).json({ error: message });
      }
    }
  );

  // Create a session for a registered glass (used by mentraOS app)
  app.post('/api/mentra/pair', async (req, res) => {
    try {
      const { glassId, pairingToken } = req.body;

      if (!glassId || !pairingToken) {
        return res.status(400).json({
          error: 'glassId and pairingToken are required',
        });
      }

      const { sessionToken, expiresAt } = await MentraService.createSession(
        glassId,
        pairingToken
      );

      res.json({
        success: true,
        sessionToken,
        expiresAt,
      });
    } catch (error) {
      console.error('Error pairing glass:', error);
      const message =
        error instanceof Error ? error.message : 'Failed to pair glass';
      res.status(400).json({ error: message });
    }
  });

  // Receive voice commands from glasses
  app.post('/api/mentra/voice', async (req, res) => {
    try {
      const { glassId, sessionToken, voiceText, timestamp } = req.body;

      if (!glassId || !sessionToken || !voiceText) {
        return res.status(400).json({
          error: 'glassId, sessionToken, and voiceText are required',
        });
      }

      const voiceCommand = await MentraService.processVoiceCommand({
        glassId,
        sessionToken,
        voiceText,
        timestamp,
      });

      res.json({
        success: true,
        commandId: voiceCommand.id,
        commandType: voiceCommand.commandType,
        status: voiceCommand.executionStatus,
      });
    } catch (error) {
      console.error('Error processing voice command:', error);
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to process voice command';
      res.status(400).json({ error: message });
    }
  });

  // Send push notification to a specific glass
  app.post(
    '/api/mentra/push',
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { glassId, notification } = req.body;

        if (!glassId || !notification) {
          return res.status(400).json({
            error: 'glassId and notification are required',
          });
        }

        if (
          !notification.type ||
          !notification.title ||
          !notification.message
        ) {
          return res.status(400).json({
            error: 'notification must have type, title, and message',
          });
        }

        const glassNotification = await MentraService.sendNotificationToGlass({
          glassId,
          notification,
        });

        res.json({
          success: true,
          notificationId: glassNotification.id,
          deliveryStatus: glassNotification.deliveryStatus,
        });
      } catch (error) {
        console.error('Error sending notification to glass:', error);
        const message =
          error instanceof Error
            ? error.message
            : 'Failed to send notification';
        res.status(400).json({ error: message });
      }
    }
  );

  // Send image notification to glass
  app.post(
    '/api/mentra/image',
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { glassId, title, message, imageUrl, imageData } = req.body;

        if (!glassId || !title) {
          return res.status(400).json({
            error: 'glassId and title are required',
          });
        }

        if (!imageUrl && !imageData) {
          return res.status(400).json({
            error: 'Either imageUrl or imageData must be provided',
          });
        }

        const notification = {
          type: 'image' as const,
          title,
          message: message || '',
          imageUrl,
          imageData,
        };

        const glassNotification = await MentraService.sendNotificationToGlass({
          glassId,
          notification,
        });

        res.json({
          success: true,
          notificationId: glassNotification.id,
          deliveryStatus: glassNotification.deliveryStatus,
        });
      } catch (error) {
        console.error('Error sending image to glass:', error);
        const message =
          error instanceof Error ? error.message : 'Failed to send image';
        res.status(400).json({ error: message });
      }
    }
  );

  // Get user's registered glasses and status
  app.get(
    '/api/mentra/glasses',
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const glassStatus = await MentraService.getGlassStatus(req.user!.id);
        res.json(glassStatus);
      } catch (error) {
        console.error('Error getting glass status:', error);
        res.status(500).json({ error: 'Failed to get glass status' });
      }
    }
  );

  // Get voice command history
  app.get(
    '/api/mentra/voice-commands',
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const limit = parseInt(req.query.limit as string) || 50;
        const commands = await databaseStorage.getUserVoiceCommands(
          req.user!.id,
          limit
        );
        res.json(commands);
      } catch (error) {
        console.error('Error getting voice commands:', error);
        res.status(500).json({ error: 'Failed to get voice commands' });
      }
    }
  );

  // Get glass notification history
  app.get(
    '/api/mentra/notifications',
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const limit = parseInt(req.query.limit as string) || 50;
        const notifications = await databaseStorage.getUserGlassNotifications(
          req.user!.id,
          limit
        );
        res.json(notifications);
      } catch (error) {
        console.error('Error getting glass notifications:', error);
        res.status(500).json({ error: 'Failed to get notifications' });
      }
    }
  );

  // Deactivate/remove a glass
  app.delete(
    '/api/mentra/glasses/:glassId',
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { glassId } = req.params;

        // Find the glass and verify ownership
        const glass = await databaseStorage.getGlassByGlassId(glassId);
        if (!glass) {
          return res.status(404).json({ error: 'Glass not found' });
        }

        if (glass.userId !== req.user!.id) {
          return res
            .status(403)
            .json({ error: 'Glass belongs to another user' });
        }

        const success = await databaseStorage.deactivateGlass(glass.id);
        if (success) {
          res.json({ success: true, message: 'Glass deactivated' });
        } else {
          res.status(400).json({ error: 'Failed to deactivate glass' });
        }
      } catch (error) {
        console.error('Error deactivating glass:', error);
        res.status(500).json({ error: 'Failed to deactivate glass' });
      }
    }
  );

  // Schedule delayed test notification endpoint
  app.post(
    '/api/push/schedule-delayed-test',
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { delaySeconds, message, testId } = req.body;

        if (
          !delaySeconds ||
          typeof delaySeconds !== 'number' ||
          delaySeconds < 1 ||
          delaySeconds > 300
        ) {
          return res.status(400).json({
            error: 'Invalid delay seconds (must be 1-300)',
          });
        }

        if (!message || typeof message !== 'string') {
          return res.status(400).json({
            error: 'Message is required',
          });
        }

        const subscriptions = await databaseStorage.getUserPushSubscriptions(
          req.user!.id
        );

        if (subscriptions.length === 0) {
          return res.status(404).json({
            error: 'No active subscriptions found',
          });
        }

        // Schedule the notification
        setTimeout(async () => {
          try {
            console.log(
              `🔔 Sending delayed notification after ${delaySeconds}s for user ${req.user!.id}`
            );

            const payload = {
              title: 'Verzögerte Test-Benachrichtigung',
              body: message,
              icon: '/icon-192.png',
              url: '/',
              tag: `delayed-test-${testId}`,
              badge: '/icon-192.png',
              requireInteraction: true,
              // Enhanced mobile and browser compatibility
              vibrate: [200, 100, 200], // Vibration pattern for mobile
              timestamp: Date.now(),
              renotify: false, // Don't re-notify for same tag
              silent: false, // Allow sound
              actions: [
                {
                  action: 'open',
                  title: 'App öffnen',
                  icon: '/icon-192.png',
                },
              ],
            };

            const { sendPushToMultipleSubscriptions } = await import(
              './lib/webPush'
            );
            const results = await sendPushToMultipleSubscriptions(
              subscriptions.map((sub) => ({
                endpoint: sub.endpoint,
                keys: {
                  p256dh: sub.p256dhKey,
                  auth: sub.authKey,
                },
              })),
              payload
            );

            console.log(
              `✅ Delayed notification sent - Success: ${results.successful}, Failed: ${results.failed}`
            );
          } catch (error) {
            console.error('❌ Error sending delayed notification:', error);
          }
        }, delaySeconds * 1000);

        res.json({
          success: true,
          message: `Delayed notification scheduled for ${delaySeconds} seconds`,
          testId,
          scheduledAt: new Date().toISOString(),
        });
      } catch (error) {
        console.error('Error scheduling delayed notification:', error);
        res
          .status(500)
          .json({ error: 'Failed to schedule delayed notification' });
      }
    }
  );

  // Get webhook deliveries for monitoring
  app.get(
    '/api/webhooks/deliveries',
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const limit = parseInt(req.query.limit as string) || 50;
        const deliveries = await databaseStorage.getUserWebhookDeliveries(
          req.user!.id,
          limit
        );
        res.json(deliveries);
      } catch (error) {
        console.error('Error getting webhook deliveries:', error);
        res.status(500).json({ error: 'Failed to get webhook deliveries' });
      }
    }
  );

  // Test webhook endpoint
  app.post(
    '/api/webhooks/test',
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { repositoryId } = req.body;

        if (!repositoryId) {
          return res.status(400).json({ error: 'Repository ID is required' });
        }

        // Get repository info
        const repositories = await databaseStorage.getUserRepositories(
          req.user!.id
        );
        const repository = repositories.find((r) => r.id === repositoryId);

        if (!repository) {
          return res.status(404).json({ error: 'Repository not found' });
        }

        // Create a test webhook delivery
        const testDelivery = {
          id: `test-${Date.now()}`,
          event: 'test',
          processed: true,
          repositoryOwner: repository.owner,
          repositoryName: repository.repo,
          action: 'webhook_test',
          actorLogin: req.user!.username,
          payloadSummary: {
            action: 'webhook_test',
            actorLogin: req.user!.username,
            message: 'Test webhook triggered from UI',
            timestamp: new Date().toISOString(),
          },
        };

        const recorded =
          await databaseStorage.recordWebhookDelivery(testDelivery);

        // Send test notification
        const subscriptions = await databaseStorage.getUserPushSubscriptions(
          req.user!.id
        );

        if (subscriptions.length > 0) {
          const payload = {
            title: 'Test Webhook',
            body: `Test webhook für ${repository.owner}/${repository.repo}`,
            icon: '/icon-192.png',
            url: '/',
            tag: 'webhook-test',
          };

          try {
            const { sendPushToMultipleSubscriptions } = await import(
              './lib/webPush'
            );
            await sendPushToMultipleSubscriptions(
              subscriptions.map((sub) => ({
                endpoint: sub.endpoint,
                keys: {
                  p256dh: sub.p256dhKey,
                  auth: sub.authKey,
                },
              })),
              payload
            );
          } catch (notificationError) {
            console.warn(
              'Failed to send test notification:',
              notificationError
            );
          }
        }

        res.json({
          success: true,
          delivery: recorded,
          message: 'Test webhook created successfully',
        });
      } catch (error) {
        console.error('Error creating test webhook:', error);
        res.status(500).json({ error: 'Failed to create test webhook' });
      }
    }
  );

  // Repository Issues Management Routes

  // Get repository issues (open + latest 10 closed)
  app.get(
    '/api/repositories/:owner/:repo/issues',
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { owner, repo } = req.params;
        const user = req.user!;

        // Check if user has access to this repository
        const userRepos = await databaseStorage.getUserRepositories(user.id);
        const userRepo = userRepos.find(
          (r) => r.owner === owner && r.repo === repo
        );
        if (!userRepo) {
          return res
            .status(404)
            .json({ error: 'Repository not found or no access' });
        }

        const issues = await listRepositoryIssues(
          user.accessToken,
          owner,
          repo
        );

        // For each open issue, check if it has associated PRs
        const openIssuesWithPRs = await Promise.all(
          issues.open.map(async (issue) => {
            try {
              const prs = await listPRsForIssue(
                user.accessToken,
                owner,
                repo,
                issue.number
              );
              return {
                ...issue,
                hasOpenPR: prs.length > 0,
                openPRs: prs,
              };
            } catch (error) {
              console.warn(
                `Error checking PRs for issue #${issue.number}:`,
                error
              );
              return {
                ...issue,
                hasOpenPR: false,
                openPRs: [],
              };
            }
          })
        );

        res.json({
          open: openIssuesWithPRs,
          closed: issues.closed,
        });
      } catch (error) {
        console.error('Error fetching repository issues:', error);
        res.status(500).json({ error: 'Failed to fetch repository issues' });
      }
    }
  );

  // Get repository collaborators
  app.get(
    '/api/repositories/:owner/:repo/collaborators',
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { owner, repo } = req.params;
        const user = req.user!;

        // Check if user has access to this repository
        const userRepos = await databaseStorage.getUserRepositories(user.id);
        const userRepo = userRepos.find(
          (r) => r.owner === owner && r.repo === repo
        );
        if (!userRepo) {
          return res
            .status(404)
            .json({ error: 'Repository not found or no access' });
        }

        const collaborators = await listRepositoryCollaborators(
          user.accessToken,
          owner,
          repo
        );
        res.json(collaborators);
      } catch (error) {
        console.error('Error fetching repository collaborators:', error);
        res
          .status(500)
          .json({ error: 'Failed to fetch repository collaborators' });
      }
    }
  );

  // Assign issue to Copilot
  app.post(
    '/api/repositories/:owner/:repo/issues/:issueNumber/assign',
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { owner, repo, issueNumber } = req.params;
        const user = req.user!;

        // Check if user has access to this repository
        const userRepos = await databaseStorage.getUserRepositories(user.id);
        const userRepo = userRepos.find(
          (r) => r.owner === owner && r.repo === repo
        );
        if (!userRepo) {
          return res
            .status(404)
            .json({ error: 'Repository not found or no access' });
        }

        // Use the existing Copilot assignment service
        const { CopilotAssignmentService } = await import(
          './lib/copilot-assignment'
        );
        const copilotService = new CopilotAssignmentService(user.accessToken);

        const result = await copilotService.assignToIssue(
          owner,
          repo,
          parseInt(issueNumber)
        );

        if (result.success) {
          res.json({
            success: true,
            assignedAgent: result.assignedAgent,
            message: `Issue #${issueNumber} assigned to ${result.assignedAgent}`,
          });
        } else {
          res.status(400).json({
            success: false,
            error: result.error,
            message: `Failed to assign issue #${issueNumber}: ${result.error}`,
          });
        }
      } catch (error) {
        console.error('Error assigning issue to Copilot:', error);
        res.status(500).json({ error: 'Failed to assign issue to Copilot' });
      }
    }
  );

  // Get PRs for specific issue
  app.get(
    '/api/repositories/:owner/:repo/issues/:issueNumber/prs',
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { owner, repo, issueNumber } = req.params;
        const user = req.user!;

        // Check if user has access to this repository
        const userRepos = await databaseStorage.getUserRepositories(user.id);
        const userRepo = userRepos.find(
          (r) => r.owner === owner && r.repo === repo
        );
        if (!userRepo) {
          return res
            .status(404)
            .json({ error: 'Repository not found or no access' });
        }

        const prs = await listPRsForIssue(
          user.accessToken,
          owner,
          repo,
          parseInt(issueNumber)
        );
        res.json(prs);
      } catch (error) {
        console.error('Error fetching PRs for issue:', error);
        res.status(500).json({ error: 'Failed to fetch PRs for issue' });
      }
    }
  );

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

      const payload = parseWebhookPayload(body, contentType);

      // Extract repository information and payload summary
      const repositoryOwner = payload?.repository?.owner?.login;
      const repositoryName = payload?.repository?.name;
      const action = payload?.action;
      const actorLogin = payload?.sender?.login;

      // Create payload summary with relevant info
      const payloadSummary = {
        action,
        actorLogin,
        pullRequestNumber: payload?.pull_request?.number,
        issueNumber: payload?.issue?.number,
        workflowName: payload?.workflow?.name,
        checkSuiteName: payload?.check_suite?.app?.name,
        checkRunName: payload?.check_run?.name,
        conclusion:
          payload?.check_run?.conclusion ||
          payload?.check_suite?.conclusion ||
          payload?.workflow_run?.conclusion,
      };

      // Record delivery
      await databaseStorage.recordWebhookDelivery({
        id: delivery,
        event,
        processed: true,
        repositoryOwner,
        repositoryName,
        action,
        actorLogin,
        payloadSummary,
      });

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
      } else {
        // Handle other webhook events with generic notifications
        await handleGenericWebhookEvent(event, payload);
      }

      // Forward webhook to user's configured URL if applicable
      await forwardWebhookToUsers(event, payload, repositoryOwner, repositoryName);

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

      // Send PR created notification if this is the first time we see this PR
      if (action === 'opened') {
        const { NotificationService, NotificationType } = await import(
          './lib/notificationService'
        );
        await NotificationService.sendNotification(
          NotificationType.PR_CREATED,
          {
            userId: userRepo.userId,
            repositoryName: `${owner}/${repo}`,
            pullNumber: pr.number,
            issueNumber: activeTask.issueNumber,
            url: pr.html_url,
          }
        );
      }

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
    // Get repository info to find users
    const repoFullName = payload.repository?.full_name;
    if (!repoFullName) return;

    const [owner, repo] = repoFullName.split('/');
    const userRepos = await databaseStorage.getUserRepositoriesByName(
      owner,
      repo
    );
    if (userRepos.length === 0) return;

    // Send CI status change notifications to all users monitoring this repository
    const ciStatus =
      payload.check_suite?.conclusion ||
      payload.workflow_run?.conclusion ||
      payload.check_run?.conclusion ||
      'unknown';

    const workflowName =
      payload.workflow_run?.name ||
      payload.check_suite?.app?.name ||
      payload.check_run?.name ||
      'CI Check';

    // Send notifications to all users
    for (const userRepo of userRepos) {
      try {
        const { NotificationService, NotificationType } = await import(
          './lib/notificationService'
        );
        await NotificationService.sendNotification(
          NotificationType.CI_STATUS_CHANGED,
          {
            userId: userRepo.userId,
            repositoryName: `${owner}/${repo}`,
            url:
              payload.workflow_run?.html_url ||
              payload.check_suite?.url ||
              payload.check_run?.html_url,
            data: {
              status: ciStatus,
              workflow: workflowName,
              event: payload.workflow_run
                ? 'workflow_run'
                : payload.check_suite
                  ? 'check_suite'
                  : 'check_run',
            },
          }
        );
      } catch (error) {
        console.warn(
          `Failed to send CI notification to user ${userRepo.userId}:`,
          error
        );
      }
    }

    // Continue with existing auto-merge logic for active tasks
    const userRepo = userRepos[0]; // Use first user for compatibility
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
    const action = payload.action;
    const issue = payload.issue;
    const owner = payload.repository?.owner?.login;
    const repo = payload.repository?.name;

    if (!owner || !repo || !issue) return;

    // Get all users monitoring this repository
    const userRepos = await databaseStorage.getUserRepositoriesByName(
      owner,
      repo
    );
    if (userRepos.length === 0) return;

    // Define which issue actions should trigger notifications
    const notifiableActions = [
      'opened',
      'closed',
      'reopened',
      'assigned',
      'unassigned',
      'labeled',
      'unlabeled',
    ];

    if (!notifiableActions.includes(action)) {
      console.log(
        `Issue event: ${action} for issue #${issue.number} (not notifiable)`
      );
      return;
    }

    console.log(
      `Issue event: ${action} for issue #${issue.number} - sending notifications`
    );

    // Send notifications to all users monitoring this repository
    for (const userRepo of userRepos) {
      try {
        // Check if this is a Copilot-managed issue by looking for our labels
        const isHausmeisterIssue = issue.labels?.some((label: any) =>
          ['hausmeister', 'chore'].includes(label.name?.toLowerCase())
        );

        // Use different notification types based on context
        let notificationType;
        if (isHausmeisterIssue && action === 'closed') {
          notificationType = await import('./lib/notificationService').then(
            (m) => m.NotificationType.TASK_COMPLETED
          );
        } else if (isHausmeisterIssue && ['assigned'].includes(action)) {
          notificationType = await import('./lib/notificationService').then(
            (m) => m.NotificationType.COPILOT_ASSIGNED
          );
        } else {
          // Generic repository activity
          continue; // Skip for now, could add REPOSITORY_ACTIVITY notification type
        }

        const { NotificationService } = await import(
          './lib/notificationService'
        );
        await NotificationService.sendNotification(notificationType, {
          userId: userRepo.userId,
          repositoryName: `${owner}/${repo}`,
          issueNumber: issue.number,
          url: issue.html_url,
          copilotAgent: issue.assignee?.login || 'GitHub Copilot',
          taskTitle: issue.title,
          data: {
            action,
            issueState: issue.state,
            issueTitle: issue.title,
          },
        });
      } catch (error) {
        console.warn(
          `Failed to send issue notification to user ${userRepo.userId}:`,
          error
        );
      }
    }

    // Auto-assignment logic: When an issue is closed, try to assign next open issue to Copilot
    if (action === 'closed') {
      console.log(
        `Issue #${issue.number} closed, checking for next issue to assign...`
      );
      await tryAssignNextIssue(owner, repo, userRepos);
    }
  }

  async function tryAssignNextIssue(
    owner: string,
    repo: string,
    userRepos: any[]
  ) {
    try {
      // Get the first user with access to this repository (we need their token)
      const userRepo = userRepos[0];
      if (!userRepo) return;

      const user = await databaseStorage.getUserById(userRepo.userId);
      if (!user?.accessToken) {
        console.log(`No access token available for user ${userRepo.userId}`);
        return;
      }

      console.log(`Fetching open issues for ${owner}/${repo}...`);
      const { listRepositoryIssues } = await import('./lib/github-rest');
      const issues = await listRepositoryIssues(user.accessToken, owner, repo);

      if (!issues.open || issues.open.length === 0) {
        console.log(`No open issues found in ${owner}/${repo}`);
        return;
      }

      // Find the first unassigned issue that doesn't have an open PR
      let nextIssue = null;
      for (const issue of issues.open) {
        // Skip if already assigned
        if (issue.assignees && issue.assignees.length > 0) {
          console.log(`Issue #${issue.number} already assigned, skipping`);
          continue;
        }

        // Check if this issue has open PRs
        const { listPRsForIssue } = await import('./lib/github-rest');
        const prs = await listPRsForIssue(
          user.accessToken,
          owner,
          repo,
          issue.number
        );

        if (prs.length > 0) {
          console.log(`Issue #${issue.number} has open PRs, skipping`);
          continue;
        }

        nextIssue = issue;
        break;
      }

      if (!nextIssue) {
        console.log(
          `No unassigned issues without PRs found in ${owner}/${repo}`
        );
        return;
      }

      console.log(
        `Attempting to assign issue #${nextIssue.number} to Copilot...`
      );

      // Use the existing Copilot assignment service
      const { CopilotAssignmentService } = await import(
        './lib/copilot-assignment'
      );
      const copilotService = new CopilotAssignmentService(user.accessToken);

      const result = await copilotService.assignToIssue(
        owner,
        repo,
        nextIssue.number
      );

      if (result.success) {
        console.log(
          `✅ Successfully assigned issue #${nextIssue.number} to ${result.assignedAgent}`
        );

        // Send notification to all users monitoring this repository
        for (const userRepo of userRepos) {
          try {
            const { NotificationService, NotificationType } = await import(
              './lib/notificationService'
            );
            await NotificationService.sendNotification(
              NotificationType.COPILOT_ASSIGNED,
              {
                userId: userRepo.userId,
                repositoryName: `${owner}/${repo}`,
                issueNumber: nextIssue.number,
                url: nextIssue.html_url,
                copilotAgent: result.assignedAgent || 'GitHub Copilot',
                taskTitle: nextIssue.title,
                data: {
                  action: 'auto-assigned',
                  issueState: 'open',
                  issueTitle: nextIssue.title,
                },
              }
            );
          } catch (notificationError) {
            console.warn(
              `Failed to send auto-assignment notification:`,
              notificationError
            );
          }
        }
      } else {
        console.log(
          `❌ Failed to assign issue #${nextIssue.number}: ${result.error}`
        );
      }
    } catch (error) {
      console.error(`Error in tryAssignNextIssue:`, error);
    }
  }

  async function handleGenericWebhookEvent(event: string, payload: any) {
    const owner = payload.repository?.owner?.login;
    const repo = payload.repository?.name;

    if (!owner || !repo) return;

    // Skip events that are too frequent or not user-relevant
    const skipEvents = [
      'ping',
      'push',
      'create',
      'delete',
      'fork',
      'watch',
      'star',
      'repository',
      'member',
      'team',
      'organization',
      'installation',
    ];

    if (skipEvents.includes(event)) return;

    // Get all users monitoring this repository
    const userRepos = await databaseStorage.getUserRepositoriesByName(
      owner,
      repo
    );
    if (userRepos.length === 0) return;

    console.log(
      `Generic webhook event: ${event} for ${owner}/${repo} - notifying ${userRepos.length} users`
    );

    // Send generic repository activity notifications
    for (const userRepo of userRepos) {
      try {
        // For now, we'll use a simple notification for unhandled events
        // Later this could be expanded with a REPOSITORY_ACTIVITY notification type
        console.log(
          `Webhook ${event} received for ${owner}/${repo} (user: ${userRepo.userId})`
        );
      } catch (error) {
        console.warn(
          `Failed to process generic webhook for user ${userRepo.userId}:`,
          error
        );
      }
    }
  }

  async function forwardWebhookToUsers(
    event: string,
    payload: any,
    repositoryOwner?: string,
    repositoryName?: string
  ) {
    if (!repositoryOwner || !repositoryName) return;

    try {
      // Get all users monitoring this repository
      const userRepos = await databaseStorage.getUserRepositoriesByName(
        repositoryOwner,
        repositoryName
      );

      if (userRepos.length === 0) return;

      // Get users with configured webhook forward URLs
      const usersWithForwardUrls = await Promise.all(
        userRepos.map(async (userRepo) => {
          const user = await databaseStorage.getUserById(userRepo.userId);
          return {
            userRepo,
            user,
            forwardUrl: user?.webhookForwardUrl,
          };
        })
      );

      const usersToForward = usersWithForwardUrls.filter(
        (item) => item.forwardUrl && item.user
      );

      if (usersToForward.length === 0) return;

      console.log(
        `🔀 Forwarding webhook ${event} for ${repositoryOwner}/${repositoryName} to ${usersToForward.length} users`
      );

      // Transform payload and forward to each user
      await Promise.all(
        usersToForward.map(async ({ forwardUrl }) => {
          try {
            const transformedPayload = transformWebhookPayload(
              event,
              payload,
              repositoryOwner,
              repositoryName
            );

            await forwardWebhook(forwardUrl!, transformedPayload);
          } catch (error) {
            console.warn(`Failed to forward webhook to ${forwardUrl}:`, error);
          }
        })
      );
    } catch (error) {
      console.error('Error in webhook forwarding:', error);
    }
  }

  function transformWebhookPayload(
    event: string,
    payload: any,
    repositoryOwner: string,
    repositoryName: string
  ) {
    const repository = `${repositoryOwner}/${repositoryName}`;
    const actor = payload?.sender?.login || 'unknown';

    let title = '';
    let text = '';

    switch (event) {
      case 'pull_request':
        const prAction = payload.action;
        const prNumber = payload.pull_request?.number;
        const prTitle = payload.pull_request?.title;
        title = `Pull Request ${prAction}: #${prNumber} ${prTitle}`;
        text = `${prAction} by ${actor} in ${repository}`;
        break;

      case 'issues':
        const issueAction = payload.action;
        const issueNumber = payload.issue?.number;
        const issueTitle = payload.issue?.title;
        title = `Issue ${issueAction}: #${issueNumber} ${issueTitle}`;
        text = `${issueAction} by ${actor} in ${repository}`;
        break;

      case 'workflow_run':
      case 'check_suite':
      case 'check_run':
        const conclusion = 
          payload?.check_run?.conclusion ||
          payload?.check_suite?.conclusion ||
          payload?.workflow_run?.conclusion ||
          'unknown';
        const workflowName = 
          payload?.workflow?.name ||
          payload?.check_suite?.app?.name ||
          payload?.check_run?.name ||
          'CI';
        title = `CI ${conclusion}: ${workflowName}`;
        text = `${conclusion} in ${repository} by ${actor}`;
        break;

      default:
        title = `${event} Event`;
        text = `${event} triggered in ${repository} by ${actor}`;
        break;
    }

    return {
      repository,
      title,
      text,
    };
  }

  async function forwardWebhook(url: string, payload: any) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'GitHub-Hausmeister-Forwarder/1.0',
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10000), // 10s timeout
      });

      if (!response.ok) {
        console.warn(`Webhook forward failed: ${response.status} ${response.statusText}`);
      } else {
        console.log(`✅ Webhook forwarded successfully to ${url}`);
      }
    } catch (error) {
      console.error(`❌ Webhook forward error to ${url}:`, error);
      // Do not fail original webhook processing
    }
  }

  const httpServer = createServer(app);

  // Note: In multi-user system, tasks are started when users make requests
  // No need to start tasks globally on server startup

  return httpServer;
}
