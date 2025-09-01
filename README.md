# GitHub Hausmeister

An automated GitHub maintenance application that creates chore issues, assigns them to GitHub Copilot, and automatically merges PRs after CI passes.

## Features

- **Automated Issue Creation**: Creates maintenance tasks (tests, linting, types, security updates) for selected repositories
- **Copilot Integration**: Automatically assigns GitHub Copilot agents to issues via GraphQL API
- **Automated CI/CD Pipeline**: Monitors pull requests and automatically processes draft PRs
  - Triggers CI on draft PRs created by Copilot agents
  - Converts draft PRs to "ready for review" when CI passes
  - Automatically approves and merges successful PRs
  - Comments on PRs when auto-merge fails
- **Webhook Integration**: Real-time handling of GitHub events (issues, PRs, CI completion, check runs)
- **Task Queue Management**: Single-task concurrency with configurable monthly limits
- **Mobile-First UI**: Dark GitHub-themed dashboard for monitoring and control

## Automated CI/CD Workflow

The system provides fully automated CI/CD processing for Copilot-generated PRs:

### 1. Draft PR Creation

- When a GitHub Copilot agent creates a draft PR, the CI pipeline automatically starts
- Webhook events for `pull_request` with `opened` action trigger the workflow
- CI runs on all PRs including drafts (TypeScript check, tests, build process)

### 2. CI Monitoring

- Monitors `workflow_run`, `check_suite`, and `check_run` events for CI completion
- Automatically checks CI status using combined GitHub status and checks APIs
- Supports Codecov integration for test coverage reporting

### 3. Auto-Merge Process

When CI completes successfully:

1. **Draft Conversion**: Automatically converts draft PR to "ready for review"
2. **Status Verification**: Confirms all CI checks are green using `isPRGreen`
3. **Auto-Approval**: Creates an automatic approval review
4. **Merge**: Merges PR using squash method
5. **Task Completion**: Marks the maintenance task as completed

### 4. Failure Handling

When CI fails or auto-merge encounters errors:

- PR remains open for manual intervention
- Adds informative comment explaining the failure
- Marks task as failed for dashboard visibility
- Preserves draft → ready conversion for manual review

### 5. Monitored Events

The webhook system handles these GitHub events:

- `pull_request` (opened, ready_for_review, synchronize)
- `workflow_run` (CI workflow completion)
- `check_suite` (check suite completion)
- `check_run` (individual check completion)
- `issues` (issue events)

## Environment Variables

Configure these environment variables in Replit Secrets:

### Required

- `GITHUB_TOKEN`: Personal Access Token with `repo`, `workflow`, `admin:repo_hook` permissions (stored securely and passed to GitHub API functions)
- `GITHUB_WEBHOOK_SECRET`: Secret for GitHub webhook signature verification (use a strong random string)
- `DATABASE_URL`: PostgreSQL connection string (e.g., from Neon serverless)
- `SESSION_SECRET`: Secret for Express session management (use a strong random string)

### GitHub OAuth (Optional)

- `GITHUB_CLIENT_ID`: GitHub OAuth App Client ID
- `GITHUB_CLIENT_SECRET`: GitHub OAuth App Client Secret  
- `GITHUB_REDIRECT_URI`: OAuth redirect URI

### Optional Configuration

- `COPILOT_ACTOR_ID`: GitHub Copilot agent node ID (auto-detected if not provided)
- `MAX_MONTHLY_TASKS`: Maximum tasks per month per repository (default: 10)
- `PORT`: Server port (default: 3000)
- `NODE_ENV`: Environment mode (`development` or `production`)

### Replit Platform Variables (Auto-configured)

- `REPLIT_DOMAIN`: Replit app domain (auto-set)
- `REPLIT_DEV_DOMAIN`: Development domain (auto-set)
- `REPL_OWNER`: Repository owner (auto-set)
- `REPL_SLUG`: Repository slug (auto-set)

## Setup Instructions

### 1. Prerequisites

- Node.js 20+ 
- PostgreSQL database (e.g., Neon serverless)
- GitHub Personal Access Token with required permissions

### 2. Installation

```bash
# Install dependencies
npm install

# Setup database schema
npm run db:push
```

### 3. Configuration

1. Configure environment variables in Replit Secrets (see Environment Variables section)
2. Set up GitHub webhook in target repositories:
   - **URL**: `https://[your-replit-domain]/api/webhook`
   - **Events**: `issues`, `pull_request`, `workflow_run`, `check_suite`
   - **Secret**: Same as `GITHUB_WEBHOOK_SECRET`
   - **Content Type**: `application/json`

### 4. Repository Setup

Each managed repository needs:
1. CI workflow (`.github/workflows/ci.yml`)
2. Webhook configuration (see above)
3. Optional: Branch protection rules

Example CI workflow:
```yaml
name: CI
on:
  pull_request:
    branches: [ main ]
jobs:
  node:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: 'npm' }
      - run: npm ci
      - run: npm run build
      - run: npm test --if-present
```

## Build and Test Commands

### Development
```bash
# Start development server (frontend + backend)
npm run dev

# Type checking
npm run check
```

### Building
```bash
# Build for production
npm run build

# Start production server
npm start
```

### Testing
```bash
# Run tests once
npm run test:run

# Run tests in watch mode
npm test

# Run tests with UI interface  
npm run test:ui

# Run tests with coverage report
npm run test:coverage
```

### Database
```bash
# Push schema changes to database
npm run db:push
```

## Deployment

The application is designed for deployment on Replit:

### Replit Deployment

1. **Import Repository**: Fork or import this repository to Replit
2. **Configure Secrets**: Set environment variables in Replit Secrets
3. **Install Dependencies**: Run `npm install`
4. **Database Setup**: Run `npm run db:push`
5. **Start Application**: Use `npm start` or let Replit auto-start

### Other Platforms

For deployment on other platforms:

1. Ensure Node.js 20+ runtime
2. Set environment variables
3. Install dependencies: `npm install`
4. Build application: `npm run build`
5. Start server: `npm start`

**Note**: The application expects Replit-specific environment variables. For other platforms, you may need to adjust the OAuth redirect URIs and webhook URLs accordingly.

## Contributing

### Development Workflow

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Install dependencies**: `npm install`
4. **Make changes**: Follow the coding guidelines
5. **Run tests**: `npm run test:run` 
6. **Build the project**: `npm run build`
7. **Commit changes**: Use descriptive commit messages
8. **Push to branch**: `git push origin feature/amazing-feature`
9. **Open a Pull Request**

### Coding Guidelines

- **TypeScript**: Use strict type checking, prefer explicit types
- **React**: Functional components with hooks, follow existing patterns
- **Backend**: RESTful API design, proper error handling
- **Testing**: Write tests for new features and bug fixes
- **Documentation**: Update documentation for any changes

### Project Structure

```
├── client/src/          # React frontend application
├── server/              # Express.js backend
│   ├── lib/             # Business logic modules
│   └── routes.ts        # API route handlers
├── shared/              # Shared types and schemas
├── tests/               # Test files (mirrors src structure)
├── documentation/       # Project documentation
│   ├── arc42.md         # Architecture documentation
│   └── repository-status.md  # Repository analysis
└── replit.md           # Replit-specific documentation
```

### Running Tests

Before submitting a PR:
```bash
# Run all tests
npm run test:run

# Check types
npm run check

# Build project
npm run build
```

### Debugging

For development debugging:
```bash
# Start with development server
npm run dev

# Access logs in browser console and terminal
# Use React DevTools for frontend debugging
```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For support and questions:
- Review the [arc42 documentation](documentation/arc42.md) for technical details
- Check existing [Issues](https://github.com/merlinbecker/githubHausmeister/issues)
- Create a new issue for bugs or feature requests
