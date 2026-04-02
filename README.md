# PRISM — Infrastructure Management Platform

> **Current Version**: v0.4.24 (2026-04-02)
> **Status**: Beta - Production Ready

PRISM is a full-stack infrastructure management platform for provisioning, monitoring, and deploying applications across multiple servers — all from a single dashboard.

**⚠️ Note**: This software is in active development. APIs and features may change frequently.

## Features

### 🗄️ Service Management
Manage **21 service types** across your fleet: databases (MySQL, PostgreSQL, MongoDB, Valkey), message brokers (RabbitMQ, Mosquitto), object storage (MinIO, Garage), web servers (Caddy, Nginx), file transfer (vsftpd, SFTPGo), process managers (PM2, Systemd, Supervisor), and security (UFW, iptables, nftables, firewalld, CrowdSec).

### 🔑 Account Provisioning
Create service accounts (DB users, S3 keys, FTP users, MQTT credentials, reverse proxies) through a **single dynamic form** — the Hub automatically provisions resources on the target server via the Agent.

### 🚀 Application Deployments
Deploy applications from **Git release artifacts** (tarballs/zips). Configure runtime (Node.js, Python, PHP, Go), process manager, environment variables, and reverse proxy — all in one form.

### 📊 Real-Time Monitoring
WebSocket-powered dashboard with live service status, agent heartbeats, activity logs, and telemetry.

### 🔐 Security & RBAC
Role-based access control (admin/manager/user), encrypted management credentials (SQLCipher), mTLS agent certificates, audit logging, and firewall management.

### 🌐 Reverse Proxy Integration
Provision **static websites** (with optional PHP-FPM) or **reverse proxies** directly through Caddy/Nginx — no SSH required.

## Current Status

### ✅ Recent Releases (v0.4.22 - v0.4.24)

**v0.4.24** (2026-04-02) - DevOps Automation:
- ✅ Service Activity Logs tab
- ✅ GitHub Release Script
- ✅ Deployment Script (production-ready)
- ✅ VM Test Deployment configuration

**v0.4.23** (2026-04-02) - Error Handling & Type Safety:
- ✅ Console.log removal (100% clean)
- ✅ Loose any[] typing fixed
- ✅ Error handling verified across all hooks

**v0.4.22** (2026-04-02) - Font Standardization:
- ✅ 36 fontWeight/fontSize fixes
- ✅ All hardcoded styles removed

### ✅ Implemented (All Versions)

**Core Features**:
- ✅ Valkey provisioning (all 3 subtypes: cache, broker, nosql)
- ✅ Add Database to existing accounts
- ✅ Service management (21 service types)
- ✅ Account provisioning (DB, S3, FTP, MQTT, proxies)
- ✅ Application deployments (Git releases)
- ✅ Real-time monitoring (WebSocket-powered)
- ✅ Security & RBAC (admin/manager/user)
- ✅ Reverse proxy integration (Caddy/Nginx)

**Recent Fixes**:
- ✅ PM2 proxy error handling
- ✅ RabbitMQ binding sync warnings
- ✅ FTP service type mapping
- ✅ Frontend audit completed
- ✅ RBAC permission creation (real API)
- ✅ Process discovery modal integrated
- ✅ Legacy table deprecation (Phase 1)
- ✅ User profile menu relocation (bottom-left sidebar)
- ✅ User password change (self-service)
- ✅ Admin password reset
- ✅ Project color display fixed
- ✅ Infrastructure tab renamed to "Processes"
- ✅ Password fields removed from Profile/Edit modals

### ⚠️ Known Issues

**All major issues resolved!** 

- ~~Widespread hardcoded styles (BUG-012)~~ ✅ FIXED v0.4.22
- ~~Pending agent notification badge (BUG-006)~~ ✅ FIXED v0.4.17

**For detailed status**: See [BUG.md](./BUG.md), [TODO.md](./TODO.md)

## Architecture

```
┌──────────────┐         WebSocket          ┌──────────────┐
│   Frontend   │◄──────────────────────────►│  Hub (Server) │
│ React + Vite │         REST API           │  Go + SQLite  │
│  Ant Design  │◄──────────────────────────►│  + Valkey     │
└──────────────┘                            └──────┬───────┘
                                                   │ WebSocket
                                            ┌──────▼───────┐
                                            │    Agent      │  × N servers
                                            │  Go modules   │
                                            │  21 services  │
                                            └──────────────┘
```

| Component | Tech Stack |
|---|---|
| **Hub (Server)** | Go, SQLite (+SQLCipher), Valkey cache, REST + WebSocket |
| **Agent** | Go, 21 service modules, auto-discovery, remote execution |
| **Frontend** | React 19, TypeScript, Vite 7, Ant Design 5, React Router 7 |

## Quick Start

```bash
# 1. Build Hub
cd server && go build -o prism-server cmd/server/main.go

# 2. Build Agent
cd agent && go build -o prism-agent cmd/agent/*.go

# 3. Build Frontend
cd frontend && npm install && npm run build

# 4. Deploy to VM (Test Environment)
sudo ./scripts/vm_test_deploy.sh
```

## Configuration

### Hub (`prism-server.conf`)
```toml
[auth]
token = "shared-secret-for-agents"
jwt_secret = "your-jwt-secret"

[database]
path = "prism.db"

[valkey]
addr = "localhost:6379"
```

### Agent (`prism-agent.conf`)
```toml
[hub]
url = "ws://hub-server:65432/agent/connect"
token = "shared-secret-for-agents"
```

## Project Structure

```
prism/
├── server/                    # Hub (central server)
│   ├── cmd/server/main.go     # Entry point + WS relay
│   └── internal/
│       ├── api/               # REST API handlers
│       ├── db/                # SQLite CRUD + migrations
│       ├── models/            # Data models
│       ├── config/            # TOML config parser
│       ├── middleware/        # CORS, rate limiting
│       ├── security/          # Credential encryption
│       ├── valkeycache/       # Redis-compatible cache
│       └── ws/                # Frontend WebSocket hub
├── agent/                     # Agent (per managed server)
│   ├── cmd/agent/             # Entry point
│   └── internal/
│       ├── modules/           # 21 service modules
│       ├── discovery/         # Service auto-discovery
│       ├── core/              # Command dispatch
│       └── config/            # Agent config
├── frontend/                  # React dashboard
│   └── src/
│       ├── pages/             # 14 pages
│       ├── components/        # UI components + modals
│       ├── hooks/             # 7 data hooks
│       ├── contexts/          # Auth, Agents, AppConfig
│       └── layouts/           # AppLayout + Sidebar
├── docs/                      # Documentation
│   └── VM_REQUIREMENTS.md     # VM configuration guide
├── scripts/                   # Automation scripts
│   ├── deploy.sh              # Deployment automation
│   ├── create_release.sh      # Release creation
│   ├── run_tests.sh           # Test runner
│   └── vm_test_deploy.sh      # VM test deployment (QEMU/KVM)
├── TODO.md                    # Development roadmap
└── IMPLEMENTED.md             # Complete feature registry
```

## Documentation

| Document | Purpose |
|---|---|
| [IMPLEMENTED.md](./IMPLEMENTED.md) | Complete registry of all implemented features with file locations |
| [TODO.md](./TODO.md) | Development roadmap and pending features |

## License

MIT
