# MOCK_LOGIN Feature Usage Guide

## Overview

The `MOCK_LOGIN` feature provides a complete simulation environment for testing GitHub Hausmeister without requiring real GitHub OAuth or API access. This is especially useful for development, testing, and demonstration purposes.

## Quick Start

### Enable Mock Mode

Set the environment variable to enable mock authentication:

```bash
export MOCK_LOGIN=true
```

### Run the Application

```bash
npm run dev
```

When `MOCK_LOGIN=true` is set, the application will automatically:
- Bypass real GitHub OAuth flow
- Provide a mock login interface with predefined test users
- Simulate GitHub repositories and API responses
- Redirect users to the mock login page instead of GitHub

## Available Test Users

The mock system includes three predefined test users:

### 1. testdev (Default User)
- **Username**: `testdev`
- **Email**: `testdev@example.com`
- **Repositories**: 
  - `frontend-app` (admin access)
  - `api-service` (push access)
  - `mobile-app` (admin access)

### 2. qauser (QA Specialist)
- **Username**: `qauser`
- **Email**: `qa@example.com`
- **Repositories**:
  - `test-automation` (admin access)
  - `qa-dashboard` (admin access)

### 3. devlead (Team Lead)
- **Username**: `devlead`
- **Email**: `lead@example.com`
- **Repositories**:
  - `infrastructure` (admin access)
  - `docs-site` (admin access)
  - `monitoring-stack` (push access)

## Mock Login Interface

![Mock Login Interface](https://github.com/user-attachments/assets/b8f666cb-0cf2-423f-b851-38ff9e4630c8)

The mock login interface provides:

1. **Quick Login**: One-click login with the default user (`testdev`)
2. **User Selection**: Choose from available test users
3. **Production Mode Info**: Shows that real GitHub auth is disabled

## API Endpoints

### Mock Authentication Routes

When `MOCK_LOGIN=true` is enabled, the following endpoints are available:

- `GET /api/auth/mode` - Check if mock mode is enabled
- `GET /api/auth/mock/users` - Get available mock users
- `GET /api/auth/mock/login/:userId` - Login as specific mock user
- `GET /api/auth/mock/quick-login` - Quick login with default user

### Example API Usage

```javascript
// Check authentication mode
const response = await fetch('/api/auth/mode');
const data = await response.json();
console.log(data); // { mockMode: true, serviceType: 'mock' }

// Get available users
const usersResponse = await fetch('/api/auth/mock/users');
const usersData = await usersResponse.json();
console.log(usersData.users); // Array of mock users
```

## Mock Repository Data

Each test user has access to different repositories to simulate various scenarios:

### Repository Structure
```json
{
  "id": 1001,
  "name": "frontend-app",
  "full_name": "testdev/frontend-app",
  "owner": { "login": "testdev" },
  "permissions": { "admin": true, "push": true },
  "description": "React frontend application for testing automated maintenance"
}
```

## Configuration Options

### Environment Variables

- `MOCK_LOGIN=true` - Enable mock authentication mode
- `MOCK_COPILOT_DELAY=1000` - Delay for mock Copilot responses (ms)
- `MOCK_CI_SUCCESS_RATE=0.8` - Success rate for mock CI runs (0-1)
- `MOCK_WEBHOOK_DELAY=500` - Delay for mock webhook events (ms)

### Custom Mock Data

You can customize mock users and repositories by modifying:

- `data/mock-users.json` - User definitions
- `data/mock-repositories.json` - Repository definitions per user

## Development Workflow

### Testing Scenarios

1. **Basic Authentication Test**:
   ```bash
   export MOCK_LOGIN=true
   npm run dev
   # Visit http://localhost:5000 and login with any test user
   ```

2. **Repository Management Test**:
   - Login as `testdev`
   - Select repositories to monitor
   - Create maintenance tasks
   - Observe mock webhook events

3. **Multi-User Testing**:
   - Test with different users to see varying repository access
   - Verify permission-based functionality

### Automated Testing

The mock system is fully tested with comprehensive test suites:

```bash
# Run all tests including mock service tests
npm run test:run

# Run specific mock service tests
npm run test:run tests/server/lib/mock-auth-service.test.ts
```

## Switching Between Mock and Production

### Enable Production Mode
```bash
unset MOCK_LOGIN
# or
export MOCK_LOGIN=false
```

### Enable Mock Mode
```bash
export MOCK_LOGIN=true
```

The application automatically detects the mode and:
- Shows appropriate login interface
- Uses correct authentication service
- Provides mode indicator in the UI

## Troubleshooting

### Common Issues

1. **"MOCK_LOGIN not working"**
   - Ensure `MOCK_LOGIN=true` is set
   - Restart the server after changing environment variables
   - Check logs for "Using mock authentication service" message

2. **"No mock users available"**
   - Verify `data/mock-users.json` exists
   - Check file permissions and JSON syntax

3. **"Database connection required"**
   - Mock mode still requires a DATABASE_URL for session storage
   - Use a test database or PostgreSQL instance

### Debug Mode

Enable debug logging to see mock service operations:

```bash
export NODE_ENV=development
export MOCK_LOGIN=true
npm run dev
```

Look for log messages prefixed with:
- `🎭 [MOCK AUTH]`
- `🔧 [SERVICE FACTORY]`
- `[MOCK]`

## Security Considerations

⚠️ **Important**: Mock mode should **never** be used in production environments.

- Mock mode bypasses real authentication
- Uses predictable mock tokens
- Provides unrestricted access to test users
- Should only be enabled in development/testing environments

## Architecture Integration

The mock system is designed to be:
- **Non-intrusive**: Minimal changes to existing codebase
- **Backwards compatible**: All existing functionality works in production mode
- **Testable**: Comprehensive test coverage for mock components
- **Configurable**: Easy to customize for different testing scenarios

## Next Steps

This implementation provides the foundation for:
- Complete GitHub repository simulation
- Mock webhook event generation
- Simulated Copilot interactions
- End-to-end testing workflows

The mock authentication system is now ready for use and can be extended with additional GitHub API simulation features as needed.