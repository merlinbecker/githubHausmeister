# Coverage Workflow Documentation

## Overview

This document explains how code coverage is generated and uploaded in the GitHub Hausmeister project.

## Coverage Generation

Coverage is generated using Vitest with the v8 provider, configured in `vitest.config.ts`:

```typescript
coverage: {
  provider: 'v8',
  reporter: ['text', 'json', 'html'],
  exclude: [
    'node_modules/',
    'tests/',
    '**/*.d.ts',
    '**/*.config.*',
    'dist/',
    'build/',
    'coverage/',
    'vitest.setup.ts'
  ]
}
```

## Local Development

### Running Tests with Coverage

```bash
# Run tests with coverage report
npm run test:coverage

# View coverage report
open coverage/index.html
```

### Coverage Files Generated

- `coverage/coverage-final.json` - JSON format for CI/CD consumption
- `coverage/index.html` - Human-readable HTML report
- `coverage/` directory - Complete coverage report assets

## CI/CD Integration

### When Coverage is Uploaded

Coverage is uploaded to Codecov only when:

1. **Tests run successfully** - Uses `if: success()` condition
2. **On specific events**:
   - Pull requests (for PR coverage comparison)
   - Push to `main` branch (for baseline coverage)
   - Push to `develop` branch (for development tracking)

### Upload Configuration

```yaml
- name: Upload coverage reports
  uses: codecov/codecov-action@v4
  if: success() && (github.event_name == 'pull_request' || github.ref == 'refs/heads/main' || github.ref == 'refs/heads/develop')
  with:
    token: ${{ secrets.CODECOV_TOKEN }}
    fail_ci_if_error: false
    files: ./coverage/coverage-final.json
    flags: unittests
    name: codecov-umbrella
```

### Why This Design?

1. **Only upload when meaningful** - No point uploading if tests failed
2. **Avoid noise** - Skip coverage on feature branches to reduce API usage
3. **Focus on important branches** - Main and develop branches provide baseline
4. **PR comparison** - Coverage changes visible in PR reviews

## Codecov Configuration

The `codecov.yml` file configures:

- **Coverage precision**: 2 decimal places
- **Target range**: 70-100% coverage
- **Status checks**: Project and patch coverage
- **Ignored paths**: Test files, config files, generated code
- **Comment format**: Concise PR comments

## Troubleshooting

### "No coverage reports found"

This error occurs when:

1. Tests didn't run (previous CI step failed)
2. Coverage files weren't generated
3. Wrong file path in upload configuration

**Solution**: Check that tests run successfully before coverage upload.

### Coverage not appearing in Codecov

1. Verify `CODECOV_TOKEN` secret is set
2. Check that coverage files exist in CI logs
3. Ensure branch is configured for upload
4. Review Codecov project settings

### False coverage drops

1. Check if test files are properly excluded
2. Verify path mappings in `codecov.yml`
3. Review coverage threshold settings

## Best Practices

### When to Upload Coverage

✅ **Upload on**:
- Pull requests (for comparison)
- Main/develop branch pushes
- Release branches

❌ **Skip on**:
- Feature branches (to save API quota)
- Draft PRs (until ready for review)
- Failed test runs

### Coverage Goals

- **Server logic**: Aim for 80%+ coverage
- **Client components**: Focus on business logic, not UI components
- **Shared utilities**: 90%+ coverage
- **Integration points**: High coverage for critical paths

## Related Files

- `vitest.config.ts` - Test and coverage configuration
- `.github/workflows/ci.yml` - CI workflow with coverage upload
- `codecov.yml` - Codecov service configuration
- `tests/README.md` - Testing guidelines and setup