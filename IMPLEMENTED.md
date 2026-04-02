# IMPLEMENTED — PRISM Feature Registry

> **Last Updated**: 2026-04-01 (v0.5.0 — Service Activity Verified)
>
> **Purpose**: Complete registry of implemented features with file locations and technical details.
>
> **Related Documents**:
> - [BUG.md](./BUG.md) - Active bugs (single source of truth)
> - [TODO.md](./TODO.md) - Planned enhancements
> - [TESTING.md](./TESTING.md) - Testing guide
> - [TESTING_COVERAGE.md](./TESTING_COVERAGE.md) - Test coverage details

---

## Documentation Consolidation Notice

**v0.4.15**: Audit reports have been consolidated into BUG.md and TODO.md.

**Removed Documents**:
- ~~FRONTEND_AUDIT.md~~ - Findings integrated
- ~~INTEGRATION_AUDIT.md~~ - Findings integrated
- ~~COMPREHENSIVE_AUDIT.md~~ - Findings integrated

---

## Recent Updates (v0.4.16 – v0.5.0)

### 🏆 v0.5.0 — Service Activity & Real-time Logs (Verified)

| Feature | Component | Details | Verified |
|---------|-----------|---------|----------|
| Service Activity Logs | Frontend | `ActivityLogList`, `useActivityLogs` | ✅ Real-time dashboard |
| Event Forwarding | Server | `control.go`, `agents.go` (BUG-037) | ✅ WS Broadcasting |
| Activity Tab | Frontend | `ProjectDetailPage.tsx` | ✅ Contextual filtering |

### 🏆 v0.4.19 — Post-Audit Bug Fixes (Verified)

| Feature | Component | Details | Verified |
|---------|-----------|---------|----------|
| Server Refactor | Server | `hub/`, `api/control.go` | ✅ Decoupled Agent Hub |
| Integration Suite | Server | `integration_test.go` | ✅ End-to-End verified |
| GetEvents Nil Fix | Server | `db.go:988,1019` | ✅ Returns `[]` for empty sets |
| DB Index Fix | Agent | `modules_test.go:52` | ✅ Index > 9 supported |
| Interface Mismatch Fix | Agent | `modules_test.go:161-165` | ✅ Test alignment |
| Type Safety Fix | Frontend | `ProjectDetailPage.tsx:57` | ✅ `any[]` removed |
| Shadowing Err Fix | Server | `webhooks_retention.go:189-210` | ✅ Lint fix |

### 🔍 v0.4.18 — Comprehensive Audit (Code-Verified)

### 🏆 v0.4.17 — Final Production Bug Fixes

| Feature | Component | File(s) | Verified |
|---------|-----------|---------|----------|
| Polling Fallback Warning | Frontend | `contexts/AgentsContext.tsx:109` | ✅ `usingPollingFallback` exposed |
| Pending Agent Badge | Frontend | `layouts/Sidebar.tsx:32-43` | ✅ `pendingCount` with `<Badge>` |

### 🚀 v0.4.16 — 10-Bug Fix Sprint

| Feature | Component | File(s) | Verified |
|---------|-----------|---------|----------|
| API Routes Registration | Server | `cmd/server/main.go` | ✅ 8 new routes for /api/servers, /api/certificates |
| Real-Time Log Forwarding | Server | `cmd/server/main.go:44-45,813-856` | ✅ `logSubscribers` map + broadcast |
| Logging Utility | Frontend | `utils/log.ts` | ✅ Environment-based log utility |
| Error Messages in Hooks | Frontend | `hooks/*.ts` | ✅ All hooks use `message.error()` |
| ProcessDiscovery Error UX | Frontend | `modals/ProcessDiscoveryModal.tsx` | ✅ Alert + Retry button |
| Password Error Messages | Frontend | `modals/ChangePasswordModal.tsx` | ✅ HTTP status-specific messages |
| Service Manager Errors | Frontend | `services/managers/*.tsx` | ✅ 6 managers updated |
| Service Manager Loading | Frontend | `services/managers/*.tsx` | ✅ Loading states added |
| TypeScript Type Safety | Frontend | Multiple files | ✅ `any[]` → proper interfaces |
| API URL Prefix | Frontend | `modals/FirewallModal.tsx`, `CrowdSecModal.tsx` | ✅ `VITE_API_URL` prefix |

### v0.4.15 Implementations

| Feature | Component | File(s) | Verified |
|---------|-----------|---------|----------|
| Certificate File Persistence | Server | `internal/security/certificates.go:525-543` | ✅ os.ReadFile/WriteFile |
| Nftables Firewall Management | Agent | `internal/modules/nftables.go:76-158` | ✅ nft CLI commands |
| RBAC Permissions API Route | Server | `cmd/server/main.go:849` | ✅ Route registered |
| ServerSettingsModal Null Guard | Frontend | `components/modals/ServerSettingsModal.tsx:50` | ✅ Null check added |
| ProjectDetailPage Error Handling | Frontend | `pages/ProjectDetailPage.tsx:74-125` | ✅ try/catch/finally |

### 📊 Cumulative Bug Fix Statistics (v0.4.19)

- **Total Bugs Tracked**: 54
- **Bugs Fixed**: 53 (98.1% resolution rate)
- **Active Bugs**: 1 (Technical Debt: BUG-044)
- **Critical/High Bugs**: 0
- **Code Verification**: ✅ All fixes verified against actual codebase

---

## Test Confirmation (v0.4.2)

**All critical bug fixes verified with automated tests**:

| Feature | Tests | Status |
|---------|-------|--------|
| Valkey provisioning (all 3 subtypes) | 50 tests | ✅ PASS |
| Primary database field auto-population | Manual | ✅ Verified |
| Add database diff logic | 4 tests | ✅ PASS |
| Service name normalization | 16 tests | ✅ PASS |

**For detailed test results**: See [TESTING.md](./TESTING.md)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                     PRISM Platform                       │
├──────────────┬──────────────────┬────────────────────────┤
│   Frontend   │   Hub (Server)   │      Agent (per VM)    │
│  React+Vite  │    Go + SQLite   │    Go + Modules        │
│  Ant Design  │    REST + WS     │    21 Service Modules  │
└──────────────┴──────────────────┴────────────────────────┘
```

---

## 1. Hub Server (`server/`)

### Core Infrastructure

| Component | File(s) | Description |
|---|---|---|
| Database (SQLite) | `internal/db/db.go` | Schema definitions, table creation, auto-migration |
| SQLCipher Encryption | `internal/db/sqlcipher.go` | Optional encrypted database via `PRISM_DB_PASSWORD` |
| Valkey Cache | `internal/valkeycache/` | Optional Redis-compatible caching layer + Pub/Sub |
| Configuration | `internal/config/` | TOML-based config (`prism-server.conf`) |
| WebSocket Hub | `internal/ws/` | Frontend real-time event broadcasting |
| Protocol | `internal/protocol/` | Agent-Hub WebSocket message types |
| Middleware | `internal/middleware/` | CORS, rate limiting |
| Security | `internal/security/` | Encryption helpers for management credentials |

### Data Models (`internal/models/models.go`)

| Model | Purpose |
|---|---|
| `User` | Internal PRISM users with RBAC roles (admin/manager/user) |
| `Project` | Resource groups for organizing accounts and deployments |
| `ServiceAccount` | Application-level credentials (DB users, S3 keys, FTP accounts, etc.) |
| `ManagementCredential` | Encrypted root/admin credentials used by agents |
| `Server` | Managed server representation (v4.0+) |
| `Service` | Discovered service on a server |
| `LegacyAgent` | Backward-compatible agent model (v3.x legacy) |
| `Command` | Commands sent from Hub to Agent |
| `Telemetry` | Time-series metrics from agents |
| `AuditLog` | Immutable audit trail |
| `Event` | System events (connection, status changes) |
| `Deployment` | Application deployment via Git releases |
| `Permission` | Granular RBAC permissions |
| `ServerGroup` | Server grouping for access control |
| `UserServerAccess` | Per-user server access grants |
| `WebhookSubscription` | Webhook endpoint configurations |
| `WebhookDelivery` | Webhook delivery tracking |
| `RetentionPolicy` | Data retention rules |
| `ConfigurationSnapshot` | Point-in-time config snapshots |
| `DriftEvent` | Configuration drift detection events |

### REST API Endpoints (`internal/api/`)

| File | Endpoints | Purpose |
|---|---|---|
| `auth.go` | `POST /api/auth/login` | JWT authentication |
| `accounts.go` | `GET/POST /api/accounts`, `GET/PUT/DELETE /api/accounts/:id` | Service account CRUD + remote provisioning |
| `deployments.go` | `GET/POST /api/deployments`, `GET/PUT/DELETE /api/deployments/:id` | Application deployment CRUD |
| `projects.go` | `GET/POST /api/projects`, `GET/PUT/DELETE /api/projects/:id` | Project CRUD |
| `servers.go` | Server management endpoints | Server CRUD + enrollment |
| `management_credentials.go` | `GET/POST/PUT/DELETE /api/management-credentials/*` | Encrypted credential management |
| `users.go` | `GET/POST/PUT/DELETE /api/users/*` | User management (admin only) |
| `settings.go` | `GET/PUT /api/settings` | System settings |
| `certificates.go` | Certificate management | Agent mTLS certificates |
| `health.go` | `GET /health`, `GET /ready` | Health checks |
| `logs.go` | `GET /api/logs` | Activity log retrieval |
| `v42.go` | v4.2 advanced endpoints | RBAC, webhooks, retention, drift |

### Database CRUD (`internal/db/`)

| File | Tables Managed |
|---|---|
| `db.go` | All table creation + migrations, Project CRUD, Agent CRUD, Event CRUD, User CRUD, Settings |
| `accounts.go` | `service_accounts` — full CRUD with filtering, bulk operations, cross-reference queries |
| `deployments.go` | `deployments` — full CRUD with filtering |
| `servers.go` | `servers`, `services` — CRUD + telemetry + commands |
| `management_credentials.go` | `management_credentials` — encrypted credential CRUD |
| `certificates.go` | `agent_certificates` — mTLS certificate management |
| `enrollment_keys.go` | `enrollment_keys` — one-time agent enrollment PSKs |
| `rbac.go` | `permissions`, `role_permissions`, `user_server_access`, `server_groups` |
| `webhooks_retention.go` | `webhook_subscriptions`, `webhook_deliveries`, `retention_policies`, drift tables |

### Account Provisioning (Remote Execution via Agent)

When creating a Service Account, the Hub sends commands to the Agent to provision resources:

| Service Type | Actions Performed |
|---|---|
| MySQL / PostgreSQL / MongoDB | `db_create_db` → `db_create_user` with role-based permissions |
| RabbitMQ | `db_create_db` (vhost) → `db_create_user` → exchanges, queues, bindings |
| MinIO / Garage (S3) | `storage_create_bucket` → `storage_create_user` (access/secret keys) |
| Caddy / Nginx | `proxy_create` (domain → upstream) |
| Mosquitto (MQTT) | `mq_create_user` |
| vsftpd / SFTPGo | `ftp_create_user` with root path and optional quota |
| PM2 | Process config + optional proxy via Caddy/Nginx |
| **Valkey (All Subtypes)** | `db_create_db` → `db_create_user` (ACL-based) |

**Implementation Notes**:
- Valkey provisioning uses `isValkeyType()` helper to handle all subtypes
- For `valkey-cache` and `valkey-broker`: Only ACL user created (no database)
- For `valkey-nosql`: Database + user created normally
- Server-side diff logic for "Add Database" to existing accounts (v0.4.2)

---

## 2. Agent (`agent/`)

### Service Modules (`internal/modules/`)

21 modules providing service management capabilities:

| Module | File | Capabilities |
|---|---|---|
| **Databases** | | |
| MySQL/MariaDB | `mysql.go` | DB/user CRUD, privilege management, settings, import |
| PostgreSQL | `postgresql.go` | DB/user CRUD, privilege management, settings, import |
| MongoDB | `mongodb.go` | DB/user CRUD, role management, settings, import |
| Valkey (Redis) | `valkey.go` | User CRUD, ACL management, settings, Pub/Sub, NoSQL DB support |
| **Message Brokers** | | |
| RabbitMQ | `rabbitmq.go` | Vhost/user/exchange/queue/binding CRUD, import |
| Mosquitto (MQTT) | `mosquitto.go` | User CRUD, ACL management, settings |
| **Object Storage** | | |
| MinIO | `minio.go` | Bucket/user CRUD, policy management |
| Garage | `garage.go` | Bucket/key CRUD |
| **Web Servers** | | |
| Caddy | `caddy.go` | Proxy creation/deletion, config management |
| Nginx | `nginx.go` | Site configuration, proxy management |
| **File Transfer** | | |
| vsftpd | `vsftpd.go` | Virtual user CRUD with Btrfs quotas |
| **Process Managers** | | |
| PM2 | `pm2.go` | App lifecycle (start/stop/restart/delete), listing |
| Systemd | `systemd.go` | Service control, status, listing |
| Supervisor | `supervisor.go` | Process control, config management |
| **Security** | | |
| UFW | `ufw.go` | Firewall rule management |
| iptables | `iptables.go` | Firewall rule management |
| nftables | `nftables.go` | Firewall rule management |
| firewalld | `firewalld.go` | Zone/rule management |
| CrowdSec | `crowdsec.go` | Ban/unban, decision listing |
| **Automation** | | |
| Ansible | `ansible.go` | Playbook execution |
| **Deployment** | | |
| Deployment | `deployment.go` | Git release download, extract, PM2/Systemd/Supervisor config, auto-proxy |

### Agent Infrastructure

| Component | Location | Purpose |
|---|---|---|
| Discovery | `internal/discovery/` | Auto-detects running services on the host |
| Core | `internal/core/` | Command dispatch, WS connection, heartbeat |
| Config | `internal/config/` | Agent configuration (`prism-agent.conf`) |
| Protocol | `internal/protocol/` | Shared message types with Hub |
| Runtime Detection | `internal/modules/runtime.go` | Detects installed runtimes (node, python, php, go) |

### Service Type Normalization

The agent uses `normalizeServiceName()` helper to map service type aliases to canonical module names:

```go
// normalizeServiceName maps service type aliases to canonical module names
func normalizeServiceName(name string) string {
    switch name {
    case "valkey-cache", "valkey-broker", "valkey-nosql", "valkey-server":
        return "valkey"
    }
    return name
}
```

This allows Valkey subtypes to use the same `ValkeyModule` while maintaining distinct service types in the UI.

---

## 3. Frontend (`frontend/`)

### Tech Stack
- **Framework**: React 19 + TypeScript + Vite 7
- **UI Library**: Ant Design 5
- **Routing**: React Router 7
- **State**: React hooks + Context API

### Pages (`src/pages/`)

| Page | Route | Purpose |
|---|---|---|
| `DashboardPage` | `/` | Overview with server/service/account stats |
| `ProjectsPage` | `/projects` | Project listing and management |
| `ProjectDetailPage` | `/projects/:id` | Project detail with accounts and resources |
| `AccountsPage` | `/accounts` | Global account management with filtering |
| `DeploymentsPage` | `/deployments` | Application deployment management |
| `ServersPage` | `/servers` | Server fleet overview |
| `ProcessesPage` | `/processes` | PM2/Systemd/Supervisor process management |
| `SecurityPage` | `/security` | Firewall rules + CrowdSec decisions |
| `LogsPage` | `/logs` | Activity log viewer |
| `UsersPage` | `/users` | User management (admin only) |
| `SettingsPage` | `/settings` | System settings |
| `LoginPage` | `/login` | Authentication |
| `HealthDashboardPage` | — | System health monitoring |
| `RBACPage` | — | Role-based access control |

### Hooks (`src/hooks/`)

| Hook | Purpose |
|---|---|
| `useAccounts` | Service account CRUD + bulk operations + cross-reference |
| `useDeployments` | Deployment CRUD + project filtering |
| `useAgents` | Agent/server management |
| `useProjects` | Project CRUD |
| `useUsers` | User management |
| `useManagementCredentials` | Encrypted credential management |
| `useWebSocketAgents` | Real-time agent status via WebSocket |

### Modals (`src/components/modals/`)

| Modal | Purpose |
|---|---|
| `AccountFormModal` | Dynamic form for provisioning accounts — adapts fields by service type. Includes Website vs Reverse Proxy mode for Caddy/Nginx |
| `DeploymentFormModal` | Form for creating deployments — Source (Git repo), Runtime, Process Manager, Network, Env Vars |

### AccountFormModal Implementation

**Service-Specific Form Fields**:

| Service Type | Form Fields |
|---|---|
| MySQL/PostgreSQL/MongoDB | Username, Password, Databases (multi-tag) |
| RabbitMQ | Username, Password, VHost, Bindings (exchange, queue, routing key) |
| Valkey NoSQL | Username, Password, Database Index (0-15 selector) |
| Valkey Cache | Username, Password, ACL Category (@read, @write, @all) |
| Valkey Broker | Username, Password, Channel Pattern (e.g., `events:*`) |
| MinIO/Garage | Access Key, Secret Key, Bucket |
| Caddy/Nginx | Domain, Target/Upstream URL or Web Root |
| vsftpd/SFTPGo | Username, Password, Root Path, Quota |

**Primary Database Handling**:
- `database` (singular) auto-set from first item in `databases` array
- Ensures connection strings render correctly in `ProjectDetailPage`

### UI/UX Design Decisions

- **Single-step dynamic forms** instead of multistep wizards — service type dropdown changes visible fields
- **Web Servers (Caddy/Nginx)** are presented as "Web Proxy" provisioning, not "Account" creation
- **Website Mode toggle**: Static/PHP Website vs Reverse Proxy — each shows different fields
- **Process Managers, Security tools**: Not in account provisioning — managed as server configurations or integrated into deployments
- **Deployments**: Separate first-class entity under Projects, not lumped into Accounts

---

## 4. Deployment & Operations

| Script | Purpose |
|---|---|
| `auto_deploy.sh` | Automated build + SSH deployment to target VM |
| `deploy.sh` | Interactive manual deployment from GitHub artifacts |
| `services_installer.sh` | Interactive CLI to install and configure 14+ services |

---

## Version History

| Version | Key Changes | Release Date |
|---|---|---|
| v3.x | Original agent-based architecture with DaisyUI frontend | Legacy |
| v4.0 | Server/Service model, management credentials, Ant Design migration | 2025 |
| v4.2 | RBAC, webhooks, retention policies, drift detection, Valkey cache | 2025 |
| v4.3 | Application Deployments (Git releases), Agent deployment module, UI/UX simplification | 2025 |
| v0.4 | Valkey service expansion (Cache, Pub/Sub, NoSQL) | 2026-04 |
| v0.4.1 | Bug fixes: exponential backoff, symlink resolution, icon mapping, Ant Design migration | 2026-04 |
| v0.4.2 | CRITICAL FIX: Valkey provisioning, Primary database field, Add database logic | 2026-04-01 |
| **v0.4.3** | **LOW PRIORITY FIX: RabbitMQ warning, PM2 error handling, FTP mapping** | **2026-04-01** |
| v0.4.13 | BUG-012 COMPLETE: All 1,433+ hardcoded style violations fixed | 2026-04-01 |
| v0.4.14 | Applications merge + BUG-016/017/014/015/018 fixes | 2026-04-01 |
| v0.4.15 | Certificate persistence, nftables, RBAC route, documentation consolidation | 2026-04-01 |
| v0.4.16 | 10-bug fix sprint: API routes, log forwarding, error handling, TypeScript types | 2026-04-01 |
| v0.4.17 | Final production bug fixes: polling fallback warning, pending agent badge | 2026-04-01 |
| **v0.4.18** | **Comprehensive post-audit: 5 new bugs found, all builds/code verified** | **2026-04-01** |

### v0.4.3 Changes

**Bug Fixes**:
- ✅ RabbitMQ binding sync warning header (BUG-003)
- ✅ PM2 proxy error handling (BUG-004)
- ✅ FTP service type mapping (BUG-005)

**Test Files Added**:
- `server/internal/api/bug_fixes_test.go` - Tests for BUG-003,004,005

### v0.4.2 Changes

**Bug Fixes**:
- ✅ Valkey account provisioning for all subtypes (`valkey-cache`, `valkey-broker`, `valkey-nosql`)
- ✅ Primary `database` field auto-population from `databases` array
- ✅ Server-side "Add Database to Existing Account" diff logic
- ✅ Valkey module registration and command routing normalization

**New Helpers**:
- Server: `isValkeyType()`, `isDatabaseType()`
- Agent: `normalizeServiceName()`
- Frontend: Valkey-specific form fields (`databaseIndex`, `aclCategory`, `channelPattern`)

---

## Known Issues

For known bugs and their status, see [BUG.md](./BUG.md).

**Summary (v0.4.19 audit fixes)**:
- ⚠️ ~1202 hardcoded inline styles (BUG-044)
- 🔵 Legacy table unification (`agents` vs `servers`)

---

## File Index

**Server**: `server/cmd/server/`, `server/internal/`  
**Agent**: `agent/cmd/agent/`, `agent/internal/`  
**Frontend**: `frontend/src/`

For detailed file locations, see the tables above.
