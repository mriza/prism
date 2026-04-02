# PRISM Error Handling Guide

> **Purpose**: Standardized error handling patterns for PRISM project
>
> **Utility**: `frontend/src/utils/log.ts` - `handleError` function

---

## Overview

PRISM uses a centralized error handling utility to ensure consistent error handling across the entire frontend application.

### Key Benefits

- ✅ Consistent error messages
- ✅ Centralized logging
- ✅ Automatic user notifications
- ✅ Reduced code duplication
- ✅ Better error tracking

---

## handleError Utility

### Location

```typescript
frontend/src/utils/log.ts
```

### Function Signature

```typescript
export const handleError = async <T>(
  operation: () => Promise<T>,
  errorMessage: string,
  options?: {
    showToast?: boolean;
    logLevel?: LogLevel;
    onError?: (error: unknown) => void;
  }
): Promise<T | undefined>
```

### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `operation` | `() => Promise<T>` | Required | The async operation to execute |
| `errorMessage` | `string` | Required | User-friendly error message |
| `options.showToast` | `boolean` | `true` | Show toast notification |
| `options.logLevel` | `LogLevel` | `'error'` | Log level (debug/info/warn/error) |
| `options.onError` | `(error) => void` | `undefined` | Custom error handler |

### Returns

- `Promise<T | undefined>` - Returns operation result or `undefined` on error

---

## Usage Examples

### Basic Usage

```typescript
import { handleError } from '@/utils/log';

// Before: Manual error handling
try {
  const projects = await fetchProjects();
  setProjects(projects);
} catch (err) {
  console.error('Failed to fetch projects', err);
  message.error('Failed to fetch projects');
}

// After: Using handleError
const projects = await handleError(
  () => fetchProjects(),
  'Failed to fetch projects'
);

if (projects) {
  setProjects(projects);
}
```

### With Custom Error Handler

```typescript
const result = await handleError(
  () => createProject(data),
  'Failed to create project',
  {
    onError: (error) => {
      // Custom error handling
      log.error('Project creation failed', error);
      // Track in analytics
      analytics.track('project_create_error');
    }
  }
);
```

### Without Toast Notification

```typescript
// For errors that shouldn't show toast
const result = await handleError(
  () => fetchProjects(),
  'Failed to fetch projects',
  {
    showToast: false,
    logLevel: 'warn'
  }
);
```

### With Different Log Levels

```typescript
// Warning level
await handleError(
  () => fetchProjects(),
  'Failed to fetch projects',
  { logLevel: 'warn' }
);

// Info level (for expected failures)
await handleError(
  () => fetchOptionalData(),
  'Optional data not available',
  { logLevel: 'info' }
);
```

---

## Migration Guide

### Step 1: Identify Catch Blocks

Find all catch blocks in your code:

```bash
grep -rn "catch.*err" frontend/src/ --include="*.ts" --include="*.tsx"
```

### Step 2: Categorize Errors

**Category A: Simple fetch/data operations**
```typescript
// Replace with handleError
try {
  const data = await fetchData();
  setData(data);
} catch (err) {
  console.error('Failed to fetch', err);
  message.error('Failed to fetch');
}
```

**Category B: Complex error handling**
```typescript
// Keep custom logic, but use handleError for logging
try {
  const result = await complexOperation();
  // Custom success handling
} catch (err) {
  handleError(
    () => { throw err; },
    'Operation failed',
    {
      onError: (error) => {
        // Custom error handling
      }
    }
  );
}
```

**Category C: Validation errors**
```typescript
// Keep as-is for validation
try {
  validateInput(data);
} catch (err) {
  // Show validation error to user
  setValidationError(err.message);
}
```

### Step 3: Refactor

**Before**:
```typescript
const createProject = useCallback(async (data) => {
  try {
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    
    if (!res.ok) throw new Error('Failed');
    
    const project = await res.json();
    setProjects(prev => [project, ...prev]);
    message.success('Project created');
  } catch (err) {
    console.error('Failed to create project', err);
    message.error('Failed to create project');
  }
}, []);
```

**After**:
```typescript
import { handleError } from '@/utils/log';

const createProject = useCallback(async (data) => {
  const result = await handleError(
    async () => {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      
      if (!res.ok) throw new Error('Failed');
      
      return await res.json();
    },
    'Failed to create project'
  );
  
  if (result) {
    setProjects(prev => [result, ...prev]);
    message.success('Project created');
  }
}, []);
```

---

## Best Practices

### Do's ✅

```typescript
// ✅ Use handleError for async operations
const data = await handleError(
  () => fetchData(),
  'Failed to fetch data'
);

// ✅ Check result before using
if (data) {
  setData(data);
}

// ✅ Use custom error handlers for tracking
await handleError(
  () => operation(),
  'Failed',
  {
    onError: (error) => {
      analytics.track('error', { error });
    }
  }
);

// ✅ Use appropriate log levels
await handleError(
  () => fetchOptional(),
  'Optional data unavailable',
  { logLevel: 'warn' }
);
```

### Don'ts ❌

```typescript
// ❌ Don't use console.error directly
catch (err) {
  console.error('Error', err);
}

// ❌ Don't ignore errors
catch (err) {
  // Empty catch
}

// ❌ Don't show generic messages
await handleError(
  () => operation(),
  'Error occurred'  // Too vague
);

// ❌ Don't use for synchronous validation
try {
  validateForm(data);  // Keep sync validation as-is
} catch (err) {
  setErrors(err.message);
}
```

---

## Error Message Guidelines

### User-Friendly Messages

```typescript
// ✅ Good
'Failed to fetch projects'
'Failed to create project'
'Failed to delete user'

// ❌ Bad
'Error'
'Operation failed'
'Something went wrong'
```

### Specific Messages

```typescript
// ✅ Include operation name
'Failed to fetch projects'
'Failed to update settings'
'Failed to upload file'

// ✅ Include context when helpful
'Failed to connect to server. Please check your connection.'
'Failed to save changes. Please try again.'
```

---

## Testing Error Handling

### Unit Tests

```typescript
import { handleError } from '@/utils/log';

test('handleError returns undefined on error', async () => {
  const result = await handleError(
    () => Promise.reject(new Error('Test error')),
    'Test error message'
  );
  
  expect(result).toBeUndefined();
});

test('handleError returns value on success', async () => {
  const result = await handleError(
    () => Promise.resolve('success'),
    'Error message'
  );
  
  expect(result).toBe('success');
});
```

### Integration Tests

```typescript
test('shows error toast on API failure', async () => {
  jest.spyOn(global, 'fetch').mockRejectedValue(new Error('Network error'));
  
  render(<ProjectsPage />);
  
  expect(await screen.findByText('Failed to fetch projects')).toBeInTheDocument();
});
```

---

## Migration Checklist

For each file with catch blocks:

- [ ] Identify catch block
- [ ] Categorize (A/B/C)
- [ ] Import handleError
- [ ] Replace try/catch with handleError
- [ ] Add result check
- [ ] Test error scenario
- [ ] Remove console.error
- [ ] Update tests if needed

---

## Audit Progress

**Total Catch Blocks**: 83

**Migration Status**:
- [ ] Hooks (useProjects, useUsers, useAccounts, etc.)
- [ ] Pages (ProjectsPage, UsersPage, etc.)
- [ ] Components (Modals, Forms, etc.)
- [ ] Contexts (AuthContext, AgentsContext, etc.)

**Target**: 100% adoption by v0.5.0

---

## Troubleshooting

### handleError Not Showing Toast

**Check if message is imported**:
```typescript
import { message } from 'antd';
```

**Check showToast option**:
```typescript
await handleError(operation, 'Error', { showToast: true });
```

### Error Not Logged

**Check log level**:
```typescript
// Set VITE_LOG_LEVEL=debug in .env
```

**Check handleError import**:
```typescript
import { handleError } from '@/utils/log';
```

---

## Resources

- [Error Handling Best Practices](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Control_flow_and_error_handling)
- [Ant Design Message](https://ant.design/components/message)
- [TypeScript Error Handling](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-2-0.html)

---

**Last Updated**: 2026-04-02  
**Version**: 1.0  
**Maintained By**: PRISM Development Team
