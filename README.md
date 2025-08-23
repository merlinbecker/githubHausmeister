# GitHub Hausmeister

An automated GitHub maintenance application that creates chore issues, assigns them to GitHub Copilot, and automatically merges PRs after CI passes.

## Features

- **Automated Issue Creation**: Creates maintenance tasks (tests, linting, types, security updates) for selected repositories
- **Copilot Integration**: Automatically assigns GitHub Copilot agents to issues via GraphQL API
- **CI Monitoring**: Monitors pull requests and automatically approves/merges when CI passes
- **Webhook Integration**: Real-time handling of GitHub events (issues, PRs, CI completion)
- **Task Queue Management**: Single-task concurrency with configurable monthly limits
- **Mobile-First UI**: Dark GitHub-themed dashboard for monitoring and control

## Environment Variables

Configure these environment variables in Replit Secrets:

### Required
