# PRISM — Infrastructure Management Platform

> **Current Version**: v0.7.0 (2026-04-12)
> **Status**: Beta - Enterprise Ready with Advanced Features

PRISM is a full-stack infrastructure management platform for provisioning, monitoring, and deploying applications across multiple servers — all from a single dashboard.

**⚠️ Note**: This software is in active development. APIs and features may change frequently.

## Documentation

All documentation has been consolidated into the `docs/` folder for easy access:

| Document | Description |
|----------|-------------|
| [BUGS.md](./docs/BUGS.md) | Active bug registry (8 active, 65 fixed) |
| [TODO.md](./docs/TODO.md) | Development roadmap (v0.6.0 planned) |
| [IMPLEMENTED.md](./docs/IMPLEMENTED.md) | Implemented features catalog |
| [CHANGELOG.md](./docs/CHANGELOG.md) | Complete version history |
| [VERSION.md](./docs/VERSION.md) | Versioning guidelines |
| [DEVELOPER_GUIDE.md](./docs/DEVELOPER_GUIDE.md) | Development setup guide |
| [ANSIBLE_INTEGRATION.md](./docs/ANSIBLE_INTEGRATION.md) | Ansible automation & service deployment |
| [VM_INFO.md](./docs/VM_INFO.md) | Test VM information (QEMU/KVM) |
| [k8s/](./k8s/) | Kubernetes deployment manifests |
| [helm/](./helm/) | Helm chart for PRISM |
| [grafana/](./grafana/) | Grafana dashboard JSON |
| [KNOWN_ISSUES.md](./docs/KNOWN_ISSUES.md) | Known issues and workarounds |
| [v0.5.0_RELEASE.md](./docs/v0.5.0_RELEASE.md) | Latest release notes |

## Features

### 🗄️ Service Management
Manage **23 service types** across your fleet: databases (MySQL, PostgreSQL, MongoDB, Valkey), message brokers (RabbitMQ, Mosquitto), object storage (MinIO, Garage, RustFS), web servers (Caddy, Nginx), file transfer (vsftpd, SFTPGo), process managers (PM2, Systemd, Supervisor), security (UFW, iptables, nftables, firewalld, CrowdSec), and **automation (Ansible)**.

### ⚡ Ansible-Powered Service Deployment
**Fresh server? No problem.** PRISM Agent + Ansible enables zero-touch server provisioning:
- **Automatic service installation** — Deploy databases, brokers, storage on fresh servers via Ansible playbooks
- **Account provisioning** — Create users, databases, buckets automatically through Ansible roles
- **Configuration management** — Ensure consistent configuration across all managed servers
- **Idempotent deployments** — Safe to run multiple times, only applies necessary changes

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

### ✅ Latest Release (v0.7.0 - 2026-04-12)

**v0.7.0** - Enterprise Features:
- ✅ Webhook System (event notifications via HTTP)
- ✅ Advanced RBAC (custom roles & permissions)
- ✅ Configuration Drift Detection
- ✅ Audit Log Retention Policies
- ✅ Frontend Theme System (light/dark mode)

**v0.5.0** - Code Quality, Testing & Infrastructure:
- ✅ Agent Registration Workflow (UI + installer script)
- ✅ Container Support (Docker + docker-compose)
- ✅ Monitoring (health checks, JSON logging)
- ✅ Performance benchmarks (k6)
- ✅ Error handling migration (100+ catch blocks)
- ✅ 82 unit tests passing

### ✅ Implemented (All Versions)

**Core Features**:
- ✅ Valkey provisioning (all 3 subtypes: cache, broker, nosql)
- ✅ Add Database to existing accounts
- ✅ Service management (23 service types + Ansible automation)
- ✅ Account provisioning (DB, S3, FTP, MQTT, proxies)
- ✅ Application deployments (Git releases)
- ✅ Real-time monitoring (WebSocket-powered)
- ✅ Security & RBAC (admin/manager/user)
- ✅ Reverse proxy integration (Caddy/Nginx)
- ✅ **Ansible-powered service deployment** (fresh server support)

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

**For detailed status**: See [BUGS.md](./BUGS.md), [TODO.md](./TODO.md)

## Architecture

```
┌──────────────┐         WebSocket          ┌───────────────┐
│   Frontend   │◄──────────────────────────►│  Hub (Server) │
│ React + Vite │         REST API           │  Go + SQLite  │
│  Ant Design  │◄──────────────────────────►│  + Valkey     │
└──────────────┘                            └──────┬────────┘
                                                   │ WebSocket
                                            ┌──────▼────────┐
                                            │    Agent      │  × N servers
                                            │  Go modules   │
                                            │  23 services  │
                                            │  + Ansible    │
                                            └───────────────┘
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
│   ├── BUGS.md                 # Active bug registry
│   ├── TODO.md                # Development roadmap
│   ├── IMPLEMENTED.md         # Implemented features
│   ├── CHANGELOG.md           # Version history
│   ├── VERSION.md             # Versioning guidelines
│   ├── DEVELOPER_GUIDE.md     # Development setup
│   ├── KNOWN_ISSUES.md        # Known issues
│   └── v0.5.0_RELEASE.md      # Latest release notes
├── scripts/                   # Automation scripts
│   ├── deploy.sh              # Deployment automation
│   ├── create_release.sh      # Release creation
│   ├── prism_install_agent.sh # Agent installer (NEW)
│   └── performance/           # k6 performance tests
│       └── run-all.sh         # Test runner
├── Dockerfile.server          # Server container (NEW)
├── Dockerfile.agent           # Agent container (NEW)
├── docker-compose.yml         # Local dev setup (NEW)
└── frontend/
    └── Dockerfile             # Frontend container (NEW)
```

## Quick Links

| Document | Purpose |
|---|---|
| [docs/IMPLEMENTED.md](./docs/IMPLEMENTED.md) | Complete registry of all features |
| [docs/TODO.md](./docs/TODO.md) | Development roadmap |
| [docs/BUGS.md](./docs/BUGS.md) | Bug tracker |
| [docs/CHANGELOG.md](./docs/CHANGELOG.md) | Version history |

## License

MIT
