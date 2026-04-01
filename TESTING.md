# PRISM Testing Guide

> **Purpose**: Guide for running tests and understanding the test structure
> **Last Updated**: 2026-04-01 (v0.4.3)
> 
> **For Test Results**: See [BUG.md](./BUG.md#test-results-summary-v443)  
> **For Coverage Details**: See [TESTING_COVERAGE.md](./TESTING_COVERAGE.md)

---

## Test Coverage Summary

| Component | Coverage | Status | Details |
|-----------|----------|--------|---------|
| Server API | 85% | ✅ Good | [See Coverage](./TESTING_COVERAGE.md#server-test-coverage) |
| Agent Core | 75% | ✅ Good | [See Coverage](./TESTING_COVERAGE.md#agent-test-coverage) |
| Frontend | 55% | ⚠️ Needs Work | [See Coverage](./TESTING_COVERAGE.md#frontend-test-coverage) |
| Integration | 20% | ❌ Poor | [See Coverage](./TESTING_COVERAGE.md#integration-tests) |

**For detailed coverage breakdown**: See [TESTING_COVERAGE.md](./TESTING_COVERAGE.md)

## Test Structure

```
prism/
├── server/
│   └── internal/api/
│       ├── helpers_test.go              # isValkeyType, isDatabaseType
│       ├── accounts_provisioning_test.go # Valkey provisioning, DB diff
│       └── auth_test.go                 # Auth, health, settings
├── agent/
│   └── cmd/agent/
│       └── main_test.go                 # normalizeServiceName
└── frontend/
    └── src/
        ├── components/modals/
        │   └── __tests__/
        │       └── AccountFormModal.test.tsx
        ├── hooks/
        │   └── __tests__/
        │       └── useAgents.test.ts
        └── pages/
            └── __tests__/
                └── ServersPage.test.tsx
```

---

## Running Tests

### All Tests
```bash
./run_tests.sh
```

### Server Tests Only
```bash
cd server
go test -v ./...
```

### Agent Tests Only
```bash
cd agent
go test -v ./...
```

### Frontend Tests Only
```bash
cd frontend
npm test
```

### Frontend Tests with Coverage
```bash
cd frontend
npm test -- --coverage
```

---

## Test Files

### Server Tests

**helpers_test.go**
- `TestIsValkeyType` - Tests all Valkey subtypes
- `TestIsDatabaseType` - Tests database type detection

**accounts_provisioning_test.go**
- `TestHandleAccountsPOST_ValkeySubtypes_Logic` - Valkey provisioning logic
- `TestHandleAccountsPUT_AddDatabaseLogic` - Database diff logic

**auth_test.go**
- Login, health, settings, agents endpoint tests

### Agent Tests

**main_test.go**
- `TestNormalizeServiceName` - Service type normalization
- `TestValkeyModuleRegistration` - Valkey subtype registration
- `TestNonValkeyServicesUnchanged` - Non-Valkey service stability

### Frontend Tests

**AccountFormModal.test.tsx**
- Valkey subtype form field tests
- Primary database field tests
- Valkey-specific field tests

**useAgents.test.ts**
- Agent data fetching tests

**ServersPage.test.tsx**
- Server listing tests
- Runtime detection tests

---

## Troubleshooting

### Server Tests Fail
```bash
# Ensure SQLite is available
sudo apt-get install sqlite3 libsqlite3-dev

# Run with verbose output
go test -v ./...
```

### Frontend Tests Fail
```bash
# Reinstall dependencies
cd frontend
rm -rf node_modules package-lock.json
npm install

# Clear cache
npm test -- --clearCache
```

### Agent Tests Fail
```bash
# Ensure Go modules are tidy
cd agent
go mod tidy

# Build test binary
go test -c ./cmd/agent/
```

---

## Continuous Integration

### GitHub Actions Workflow (Future)

```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Go
        uses: actions/setup-go@v4
        with:
          go-version: '1.21'
      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '20'
      - name: Server Tests
        run: cd server && go test ./...
      - name: Agent Tests
        run: cd agent && go test ./...
      - name: Frontend Tests
        run: cd frontend && npm test
```

---

## Related Documentation

- [BUG.md](./BUG.md) - Bug reports with test results
- [IMPLEMENTED.md](./IMPLEMENTED.md) - Implementation details
- [TODO.md](./TODO.md) - Planned enhancements
*Next scheduled test review: v0.5.0*
