# GitHub Copilot Instructions for GitHub Hausmeister

## Repository Overview

GitHub Hausmeister is an automated GitHub maintenance application that streamlines repository maintenance by creating chore issues, assigning them to GitHub Copilot agents, and automatically merging pull requests after CI validation. The application provides a centralized dashboard for monitoring automated maintenance tasks across multiple repositories with configurable monthly limits and single-task concurrency controls.

## User Preferences

**Preferred communication style**: Simple, everyday language.

## System Architecture Context

### Tech Stack
- **Frontend**: React + TypeScript + Vite, shadcn/ui components, Tailwind CSS
- **Backend**: Express.js + TypeScript, GitHub REST/GraphQL APIs
- **Database**: PostgreSQL with Drizzle ORM
- **Deployment**: Replit hosting platform
- **Queue Management**: In-memory with persistent state backup

### Key Components
- **GitHub Integration**: REST API v3 for repository operations, GraphQL API v4 for Copilot assignments
- **Webhook Processing**: Real-time GitHub event handling with HMAC verification
- **Task Queue**: Single-task concurrency with monthly limits
- **Auto-merge Pipeline**: CI monitoring and automatic PR merging

## Coding Guidelines

### Code Style
- Use TypeScript with strict type checking
- Follow React functional component patterns with hooks
- Prefer async/await over promises
- Use descriptive variable and function names
- Keep functions focused and single-purpose

### Architecture Patterns
- **Frontend**: Component-based with TanStack Query for server state
- **Backend**: RESTful API with dedicated modules for GitHub operations
- **Error Handling**: Robust retry mechanisms with exponential backoff
- **Security**: Token-based auth, webhook signature verification

### File Organization
- `client/src/components/`: React UI components
- `client/src/lib/`: Frontend utilities and API clients
- `server/lib/`: Backend business logic modules
- `server/routes/`: Express route handlers
- `shared/`: Common types and schemas
- `documentation/`: Project documentation

## Domain-Specific Knowledge

### GitHub API Integration
- Use Octokit for REST API operations
- GraphQL for Copilot agent assignments and complex queries
- Handle rate limiting with proper retry logic
- Verify webhook signatures using HMAC-SHA256

### Task Management Flow
1. **Issue Creation**: Generate maintenance tasks from templates
2. **Copilot Assignment**: Assign GitHub Copilot agents via GraphQL
3. **PR Monitoring**: Track pull request status and CI checks
4. **Auto-merge**: Approve and merge when all checks pass
5. **Queue Management**: Process one task at a time with monthly limits

### Common Patterns
- **Webhook Handlers**: Verify signatures, deduplicate events, update task state
- **API Endpoints**: Validate input, handle errors, return consistent responses
- **Database Operations**: Use Drizzle ORM with proper type safety
- **GitHub Operations**: Check permissions, handle API errors gracefully

## Development Guidelines

### Testing
- Write unit tests for core business logic
- Mock GitHub API calls in tests
- Test webhook signature verification
- Validate database operations

### Error Handling
- Log errors with context for debugging
- Return user-friendly error messages
- Implement retry logic for transient failures
- Handle GitHub API rate limits gracefully

### Security Considerations
- Store secrets in environment variables
- Validate all webhook payloads
- Use minimal required GitHub permissions
- Sanitize user inputs

## Important Notes for Pull Requests

### **Wichtiger Hinweis für Pull Requests**
**Wenn du Platzhalter implementierst, anstelle der eigentlichen Implementierungen, mache dies prominent kenntlich in den Beschreibungen zum Pull-Request.**

### PR Description Guidelines
- Clearly describe what was implemented vs. what are placeholders
- Mark any TODO items or incomplete implementations
- Explain any architectural decisions or trade-offs
- Include testing instructions if applicable

## Common Tasks and Patterns

### Adding New GitHub Operations
1. Create function in appropriate `server/lib/` module
2. Add proper error handling and logging
3. Include rate limiting considerations
4. Add corresponding API endpoint if needed
5. Update frontend API client if required

### Extending Task Templates
1. Update templates in task creation logic
2. Ensure proper label assignment
3. Validate task data structure
4. Test with different repository configurations

### Modifying Webhook Handlers
1. Verify signature validation remains intact
2. Handle new event types appropriately
3. Update task state transitions correctly
4. Maintain idempotency for duplicate events

## Environment Configuration

Required environment variables:
- `GITHUB_TOKEN`: Personal Access Token with repo, workflow, admin:repo_hook permissions
- `WEBHOOK_SECRET`: Secret for GitHub webhook signature verification
- `DATABASE_URL`: PostgreSQL connection string
- `NODE_ENV`: Environment (development/production)

## Deployment Considerations

- Application runs on Replit with automatic restarts
- Uses file-based state backup for persistence
- Environment variables managed via Replit Secrets
- Build process: `npm run build` (Vite + ESBuild)
- Start command: `npm start`