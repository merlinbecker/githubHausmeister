# GitHub Hausmeister

## Overview

GitHub Hausmeister is an automated GitHub maintenance application that streamlines repository maintenance by creating chore issues, assigning them to GitHub Copilot agents, and automatically merging pull requests after CI validation. The application provides a centralized dashboard for monitoring automated maintenance tasks across multiple repositories with configurable monthly limits and single-task concurrency controls.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
The application uses a React-based frontend with TypeScript, built using Vite for development and bundling. The UI framework leverages shadcn/ui components built on Radix UI primitives for a consistent design system. The frontend follows a mobile-first approach with a dark GitHub-themed interface using Tailwind CSS for styling.

**Key Frontend Design Decisions:**
- **React with Vite**: Chosen for fast development experience and optimized bundling
- **TypeScript**: Ensures type safety across the application
- **Wouter**: Lightweight routing solution instead of React Router for reduced bundle size
- **TanStack Query**: Handles server state management, caching, and data fetching
- **Mobile-first responsive design**: Ensures usability across all device sizes

### Backend Architecture
The backend is built as an Express.js API server that handles GitHub integrations, webhook processing, and task queue management. The architecture follows a RESTful API pattern with dedicated modules for different GitHub operations.

**Core Backend Components:**
- **Express.js API**: Provides RESTful endpoints for frontend communication
- **GitHub REST API Integration**: Handles repository operations, issue creation, PR management
- **GitHub GraphQL Integration**: Manages Copilot agent assignments
- **Webhook Processing**: Real-time handling of GitHub events with signature verification
- **Task Queue System**: In-memory queue with persistent state for single-task concurrency

### Data Storage Solutions
The application uses a hybrid storage approach combining PostgreSQL for persistent data and in-memory storage for active operations.

**Storage Strategy:**
- **PostgreSQL with Drizzle ORM**: Primary database for tasks, webhook deliveries, and system state
- **In-memory storage**: Queue management and active task tracking
- **File-based state**: JSON file backup for critical system state (monthly counters, system status)

### Authentication and Authorization
The system uses GitHub Personal Access Tokens for API authentication, supporting both Classic and Fine-grained tokens with specific permission requirements.

**Security Considerations:**
- **Token-based authentication**: Personal Access Tokens stored securely in environment variables
- **Webhook signature verification**: HMAC-SHA256 verification for incoming GitHub webhooks
- **Permission scoping**: Minimal required permissions (repo, workflow, admin:repo_hook, read:org)

### Task Queue and Concurrency Management
The application implements a single-task concurrency model with configurable monthly limits to prevent API rate limiting and ensure controlled automation.

**Queue Management Features:**
- **Single active task**: Only one task processes at a time to prevent conflicts
- **Monthly limits**: Configurable task quotas with automatic reset
- **Persistent state**: Queue and system state survive application restarts
- **Idempotent operations**: Webhook deduplication and retry mechanisms

### CI Integration and Auto-merge
The system monitors GitHub Actions workflows and automatically merges pull requests when all checks pass, implementing a complete automation pipeline.

**Auto-merge Workflow:**
- **CI Status Monitoring**: Tracks both status checks and check runs
- **Automatic approval**: Creates approval reviews when CI passes
- **Merge strategies**: Configurable merge methods (merge, squash, rebase)
- **Error handling**: Robust retry mechanisms with exponential backoff

## External Dependencies

### GitHub API Services
- **GitHub REST API v3**: Repository management, issue/PR operations, webhook registration
- **GitHub GraphQL API v4**: Copilot agent assignment and advanced queries
- **GitHub Webhooks**: Real-time event processing for issues, PRs, and CI completion

### Database and ORM
- **PostgreSQL**: Primary database via Neon serverless
- **Drizzle ORM**: Type-safe database operations with schema migrations
- **Drizzle Kit**: Database schema management and migration tools

### Development and Build Tools
- **Vite**: Frontend build tool and development server
- **ESBuild**: Backend bundling for production deployment
- **TypeScript Compiler**: Type checking and compilation

### UI and Styling Framework
- **Tailwind CSS**: Utility-first CSS framework
- **Radix UI**: Headless UI components for accessibility
- **shadcn/ui**: Pre-built component library
- **Lucide React**: Icon library for consistent iconography

### Utility Libraries
- **date-fns**: Date manipulation and formatting
- **crypto**: Built-in Node.js module for HMAC verification
- **nanoid**: Unique ID generation for internal tracking

### Deployment Platform
- **Replit**: Hosting platform with integrated secrets management
- **Environment Variables**: Secure configuration via Replit Secrets