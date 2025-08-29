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
