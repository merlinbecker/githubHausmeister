# Testing Guide

This project uses [Vitest](https://vitest.dev/) as the testing framework, which provides excellent TypeScript support and integrates seamlessly with our existing Vite setup.

## Running Tests

### Basic Commands

```bash
# Run tests once
npm run test:run

# Run tests in watch mode (interactive)
npm test

# Run tests with UI interface
npm run test:ui

# Run tests with coverage report
npm run test:coverage
```

### Test Structure

Tests are organized in the `tests/` directory mirroring the source code structure:

```
tests/
├── client/         # Frontend React component tests
├── server/lib/     # Backend business logic tests
└── shared/         # Shared schema and utility tests
```

## Writing Tests

### Basic Test Example

```typescript
import { describe, it, expect } from 'vitest';
import { myFunction } from '@/lib/utils';

describe('MyFunction', () => {
  it('should return expected result', () => {
    const result = myFunction('input');
    expect(result).toBe('expected output');
  });
});
```

### Mocking Dependencies

```typescript
import { describe, it, expect, vi } from 'vitest';
import fs from 'fs';

// Mock external dependencies
vi.mock('fs', () => ({
  default: {
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
  },
}));

describe('File Operations', () => {
  it('should handle file operations', () => {
    const mockFs = vi.mocked(fs);
    mockFs.readFileSync.mockReturnValue('test content');

    // Your test logic here
  });
});
```

### Testing React Components

```typescript
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MyComponent } from '@/components/MyComponent'

describe('MyComponent', () => {
  it('should render correctly', () => {
    render(<MyComponent />)
    expect(screen.getByText('Hello World')).toBeInTheDocument()
  })
})
```

## Path Aliases

The following path aliases are available in tests:

- `@/*` - Maps to `client/src/*`
- `@shared/*` - Maps to `shared/*`

## Configuration

The testing setup includes:

- **Global test utilities**: `describe`, `it`, `expect` are available globally
- **jsdom environment**: For DOM testing of React components
- **Jest DOM matchers**: Extended matchers like `toBeInTheDocument()`
- **TypeScript support**: Full TypeScript support with proper type checking

## Best Practices

1. **Test file naming**: Use `.test.ts` or `.test.tsx` extensions
2. **Group related tests**: Use `describe` blocks to organize tests
3. **Clear test names**: Test names should describe what is being tested
4. **Mock external dependencies**: Keep tests isolated and fast
5. **Test both happy and error paths**: Cover success and failure scenarios
6. **Keep tests simple**: Each test should focus on one specific behavior

## Integration with CI/CD

The test suite can be integrated into CI/CD pipelines using:

```bash
npm run test:run
```

This command runs all tests once and exits with appropriate exit codes for CI systems.
