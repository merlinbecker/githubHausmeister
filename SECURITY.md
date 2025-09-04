# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |

## Reporting a Vulnerability

We take security vulnerabilities seriously. If you discover a security issue, please follow these steps:

### 1. **Do Not** Create Public Issues

Please **do not** create GitHub issues for security vulnerabilities. This could put users at risk.

### 2. Report Privately

Send security reports to the repository maintainer via:

- **GitHub Security Advisories**: Use the "Report a vulnerability" button in the Security tab
- **Email**: Contact the repository owner directly through their GitHub profile

### 3. Include Detailed Information

When reporting a vulnerability, please include:

- Description of the vulnerability
- Steps to reproduce the issue
- Potential impact assessment
- Suggested fix (if you have one)
- Your contact information for follow-up

### 4. Response Timeline

- **Initial Response**: Within 48 hours
- **Status Update**: Within 7 days
- **Fix Timeline**: Depends on severity, typically 14-30 days

## Security Best Practices

### For Users

When deploying GitHub Hausmeister:

1. **Environment Variables**
   - Use strong, randomly generated secrets for `GITHUB_WEBHOOK_SECRET` and `SESSION_SECRET`
   - Store all secrets in Replit Secrets or equivalent secure storage
   - Never commit secrets to version control

2. **GitHub Token Security**
   - Use Personal Access Tokens with minimal required permissions:
     - `repo` (for repository access)
     - `workflow` (for CI monitoring)
     - `admin:repo_hook` (for webhook management)
   - Regularly rotate tokens
   - Monitor token usage in GitHub settings

3. **Webhook Security**
   - Always verify webhook signatures using HMAC-SHA256
   - Use HTTPS endpoints only
   - Keep webhook secrets confidential

4. **Database Security**
   - Use encrypted connections (TLS/SSL)
   - Implement proper access controls
   - Regular backups with encryption

### For Developers

When contributing:

1. **Code Security**
   - Validate all user inputs
   - Use parameterized queries (Drizzle ORM handles this)
   - Implement proper error handling without information leakage
   - Follow the principle of least privilege

2. **Dependencies**
   - Keep dependencies updated
   - Use `npm audit` to check for vulnerabilities
   - Review dependency licenses and security advisories

3. **Authentication & Authorization**
   - Implement proper session management
   - Use secure cookie settings
   - Validate permissions for all operations

## Known Security Considerations

### 1. GitHub API Token Management

- Tokens are passed to functions but not stored in database
- Implement token rotation strategy for production use

### 2. Webhook Verification

- All webhooks are verified using HMAC-SHA256 signatures
- Implementation in `server/lib/webhook-verify.ts`

### 3. Session Security

- Express sessions with secure configuration
- Session secrets should be cryptographically strong

### 4. CORS and API Security

- API endpoints validate request origins
- Implement rate limiting for production deployments

## Security Architecture

The application implements several security layers:

1. **Network Security**: HTTPS-only communication
2. **Authentication**: GitHub OAuth integration
3. **Authorization**: Token-based API access
4. **Data Protection**: Encrypted database connections
5. **Input Validation**: Zod schema validation
6. **Audit Trail**: Database logging of operations

## Third-Party Security

This application integrates with:

- **GitHub APIs**: Follow GitHub's security guidelines
- **Neon PostgreSQL**: Serverless database with built-in security
- **Replit Platform**: Relies on Replit's infrastructure security

## Updates and Patches

Security updates will be:

- Released as soon as possible after discovery
- Documented in release notes
- Communicated through GitHub releases

## Contact

For security-related questions that are not vulnerabilities:

- Create a regular GitHub issue with the `security` label
- Tag maintainers for priority review

---

_This security policy is subject to updates. Check this document regularly for the latest information._
