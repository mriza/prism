# PRISM — Infrastructure Manager

PRISM is a lightweight infrastructure management platform for managing services, databases, firewalls, and security across multiple servers.

## Components

- **Hub (Server)** — Central control server with REST API and WebSocket relay
- **Agent** — Runs on managed servers, auto-discovers services, executes commands
- **Frontend** — Modern web dashboard built with React + Vite

## Quick Start

```bash
# Build Hub
cd server && go build -o prism-server cmd/server/main.go

# Build Agent
cd agent && go build -o prism-agent cmd/agent/*.go

# Build Frontend
cd frontend && npm install && npm run build
```

## License

MIT
