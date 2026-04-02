# PRISM Developer Guide

> **Purpose**: Complete guide for developing PRISM
>
> **For**: Developers contributing to PRISM project
>
> **Version**: v0.4.25

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Architecture Overview](#architecture-overview)
3. [Development Setup](#development-setup)
4. [Code Structure](#code-structure)
5. [Coding Guidelines](#coding-guidelines)
6. [Testing](#testing)
7. [Building](#building)
8. [Debugging](#debugging)
9. [Contributing](#contributing)

---

## Getting Started

### Prerequisites

**Required**:
- Node.js 18+ (for frontend)
- Go 1.21+ (for server and agent)
- Git

**Recommended**:
- VS Code with Go and ESLint extensions
- Docker (for testing deployments)
- QEMU/KVM (for VM testing)

### Quick Start

```bash
# Clone repository
git clone https://github.com/mriza/prism.git
cd prism

# Install frontend dependencies
cd frontend && npm install

# Build server
cd server && go build -o prism-server ./cmd/server

# Build agent
cd agent && go build -o prism-agent ./cmd/agent

# Start development
./scripts/run_tests.sh
```

---

## Architecture Overview

### High-Level Architecture

```
┌──────────────┐         WebSocket          ┌──────────────┐
│   Frontend   │◄──────────────────────────►│  Hub (Server) │
│ React + Vite │         REST API           │  Go + SQLite  │
│  Ant Design  │◄──────────────────────────►│               │
└──────────────┘                            └──────┬───────┘
                                                   │ WebSocket
                                            ┌──────▼───────┐
                                            │    Agent      │  × N servers
                                            │  Go modules   │
                                            │  21 services  │
                                            └──────────────┘
```

### Components

**Frontend** (`frontend/`):
- React 18 + TypeScript
- Ant Design v6 for UI
- Vite for build
- Vitest for testing

**Server** (`server/`):
- Go 1.21+
- SQLite database (with SQLCipher encryption)
- WebSocket hub for real-time updates
- REST API

**Agent** (`agent/`):
- Go 1.21+
- Service modules (21 types)
- WebSocket client
- Service discovery

---

## Development Setup

### Frontend Development

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev

# Run tests
npm test

# Build for production
npm run build

# Lint code
npm run lint
```

**Environment Variables**:
```bash
# frontend/.env.local
VITE_API_URL=http://localhost:8080
VITE_LOG_LEVEL=debug
```

### Server Development

```bash
cd server

# Build
go build -o prism-server ./cmd/server

# Run
./prism-server

# Run with debug logging
LOG_LEVEL=debug ./prism-server

# Test
go test ./...

# Test with coverage
go test -cover ./...
```

**Environment Variables**:
```bash
# server/.env.local
SERVER_PORT=8080
AUTH_TOKEN=shared-secret-for-agents
JWT_SECRET=your-jwt-secret
DB_PATH=./data/prism.db
```

### Agent Development

```bash
cd agent

# Build
go build -o prism-agent ./cmd/agent

# Run
./prism-agent --config config/agent.yaml

# Test
go test ./...
```

**Configuration** (`config/agent.yaml`):
```yaml
server_url: http://localhost:8080
server_token: shared-secret-for-agents
agent_name: test-agent
log_level: debug
```

---

## Code Structure

### Frontend Structure

```
frontend/
├── src/
│   ├── components/       # Reusable UI components
│   │   ├── modals/       # Modal dialogs
│   │   ├── services/     # Service-related components
│   │   └── managers/     # Service managers (DB, RabbitMQ, etc.)
│   ├── pages/            # Page components
│   ├── hooks/            # Custom React hooks
│   ├── contexts/         # React contexts
│   ├── layouts/          # Layout components
│   ├── types/            # TypeScript types
│   ├── utils/            # Utility functions
│   └── styles/           # CSS styles
├── public/               # Static assets
└── tests/                # Test files
```

### Server Structure

```
server/
├── cmd/
│   └── server/           # Server entry point
├── internal/
│   ├── api/              # HTTP handlers
│   ├── db/               # Database layer
│   ├── models/           # Data models
│   ├── security/         # Security utilities
│   ├── ws/               # WebSocket hub
│   └── config/           # Configuration
└── tests/                # Test files
```

### Agent Structure

```
agent/
├── cmd/
│   └── agent/            # Agent entry point
├── internal/
│   ├── modules/          # Service modules
│   ├── config/           # Configuration
│   └── protocol/         # Communication protocol
└── tests/                # Test files
```

---

## Coding Guidelines

### TypeScript Guidelines

**Use proper types**:
```typescript
// ✅ Good
interface User {
  id: string;
  username: string;
  role: 'admin' | 'manager' | 'user';
}

// ❌ Bad - avoid any
const user: any = {};
```

**Use hooks properly**:
```typescript
// ✅ Good - custom hook for data fetching
const { data, loading, error } = useProjects();

// ❌ Bad - fetch in component
useEffect(() => {
  fetch('/api/projects').then(...);
}, []);
```

**Error handling**:
```typescript
// ✅ Good - use handleError utility
const result = await handleError(
  () => fetchProjects(),
  'Failed to fetch projects',
  { showToast: true }
);

// ❌ Bad - silent failure
try {
  await fetchProjects();
} catch (err) {
  console.error(err);
}
```

### Go Guidelines

**Error handling**:
```go
// ✅ Good - proper error handling
result, err := doSomething()
if err != nil {
    log.Errorf("Failed to do something: %v", err)
    return nil, err
}

// ❌ Bad - ignore error
result, _ := doSomething()
```

**Function naming**:
```go
// ✅ Good - clear names
func GetUserByID(id string) (*User, error)
func CreateProject(name string) (*Project, error)

// ❌ Bad - vague names
func Get(id string) interface{}
func Create(name string) interface{}
```

**Database queries**:
```go
// ✅ Good - prepared statements
query := "SELECT * FROM users WHERE id = ?"
err := db.QueryRow(query, id).Scan(&user)

// ❌ Bad - SQL injection risk
query := fmt.Sprintf("SELECT * FROM users WHERE id = '%s'", id)
```

---

## Testing

### Frontend Testing

```bash
cd frontend

# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Run specific test file
npm test -- src/hooks/__tests__/useProjects.test.tsx

# Run in watch mode
npm test -- --watch
```

**Test structure**:
```typescript
import { render, screen } from '@testing-library/react';
import { ProjectsPage } from '../pages/ProjectsPage';

describe('ProjectsPage', () => {
  it('should render project list', async () => {
    render(<ProjectsPage />);
    expect(await screen.findByText('Project 1')).toBeInTheDocument();
  });
});
```

### Server Testing

```bash
cd server

# Run all tests
go test ./...

# Run specific package
go test ./internal/api/...

# Run with coverage
go test -cover ./...

# Run with verbose output
go test -v ./...
```

**Test structure**:
```go
func TestGetUser(t *testing.T) {
    db := setupTestDB()
    defer db.Close()
    
    user, err := GetUser(db, "123")
    if err != nil {
        t.Fatalf("Failed to get user: %v", err)
    }
    
    if user.Name != "Test" {
        t.Errorf("Expected name 'Test', got '%s'", user.Name)
    }
}
```

### Agent Testing

```bash
cd agent

# Run all tests
go test ./...

# Run specific module
go test ./internal/modules/mysql_test.go

# Run with coverage
go test -cover ./...
```

---

## Building

### Build All Components

```bash
# Frontend
cd frontend && npm run build

# Server
cd server && go build -o prism-server ./cmd/server

# Agent
cd agent && go build -o prism-agent ./cmd/agent
```

### Build for Production

```bash
# Frontend (optimized)
cd frontend && npm run build

# Server (stripped binary)
cd server && go build -ldflags="-s -w" -o prism-server ./cmd/server

# Agent (stripped binary)
cd agent && go build -ldflags="-s -w" -o prism-agent ./cmd/agent
```

### Create Release

```bash
# Use release script
./scripts/create_release.sh v0.5.0

# Or manually
git tag -a v0.5.0 -m "PRISM v0.5.0"
git push origin v0.5.0
```

---

## Debugging

### Frontend Debugging

**VS Code Configuration** (`.vscode/launch.json`):
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "chrome",
      "request": "launch",
      "name": "Debug Frontend",
      "url": "http://localhost:5173",
      "webRoot": "${workspaceFolder}/frontend/src"
    }
  ]
}
```

**React DevTools**:
- Install React Developer Tools extension
- Use Components tab to inspect component tree
- Use Profiler tab to find performance issues

### Server Debugging

**VS Code Configuration**:
```json
{
  "name": "Debug Server",
  "type": "go",
  "request": "launch",
  "mode": "debug",
  "program": "${workspaceFolder}/server/cmd/server",
  "env": {
    "LOG_LEVEL": "debug"
  }
}
```

**Delve Debugger**:
```bash
# Install delve
go install github.com/go-delve/delve/cmd/dlv@latest

# Debug server
dlv debug ./cmd/server

# Set breakpoints
(dlv) break main.go:100
(dlv) continue
```

### Agent Debugging

**Run with verbose logging**:
```bash
LOG_LEVEL=debug ./prism-agent --config config/agent.yaml
```

**Check agent logs**:
```bash
journalctl -u prism-agent -f
```

---

## Contributing

### Pull Request Process

1. **Fork the repository**
2. **Create feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. **Make changes**
4. **Run tests**:
   ```bash
   ./scripts/run_tests.sh
   ```
5. **Commit changes**:
   ```bash
   git commit -m "feat: add your feature description"
   ```
6. **Push to fork**:
   ```bash
   git push origin feature/your-feature-name
   ```
7. **Create Pull Request**

### Commit Message Format

```
type: subject

body (optional)

footer (optional)
```

**Types**:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Formatting
- `refactor`: Code refactoring
- `test`: Tests
- `chore`: Maintenance

**Example**:
```
feat: add user password reset functionality

- Add ResetPasswordModal component
- Add POST /api/users/:id/reset-password endpoint
- Add email notification

Closes #123
```

### Code Review Checklist

- [ ] Code follows style guidelines
- [ ] Tests are included
- [ ] Documentation is updated
- [ ] No security vulnerabilities
- [ ] Performance is acceptable
- [ ] Error handling is proper

---

## Troubleshooting

### Common Issues

**Frontend build fails**:
```bash
# Clear node_modules and rebuild
rm -rf node_modules package-lock.json
npm install
npm run build
```

**Server won't start**:
```bash
# Check if port is in use
lsof -i :8080

# Kill process
kill -9 <PID>

# Check database file
ls -la data/prism.db
```

**Agent can't connect to server**:
```bash
# Check server URL in config
cat config/agent.yaml

# Test connection
curl http://localhost:8080/api/health

# Check firewall
sudo ufw status
```

---

## Resources

- **GitHub**: https://github.com/mriza/prism
- **Documentation**: See `docs/` directory
- **Issues**: https://github.com/mriza/prism/issues
- **Releases**: https://github.com/mriza/prism/releases

---

**Last Updated**: 2026-04-02  
**Version**: 1.0  
**Maintained By**: PRISM Development Team
