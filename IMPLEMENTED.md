# IMPLEMENTED — PRISM Feature Registry

> **Last Updated**: 2026-04-01 (v0.4.3)
> 
> **Purpose**: Complete registry of implemented features with file locations and technical details.
> 
> **Related Documents**:
> - [BUG.md](./BUG.md) - Active bugs (fixed bugs in version history)
> - [TODO.md](./TODO.md) - Planned enhancements
> - [TESTING.md](./TESTING.md) - Testing guide
> - [TESTING_COVERAGE.md](./TESTING_COVERAGE.md) - Test coverage details

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

**Summary**:
- ⚠️ Frontend "Add Database" dedicated UI (server-side implemented)
- 🔵 Legacy table unification (`agents` vs `servers`)

---

## File Index

**Server**: `server/cmd/server/`, `server/internal/`  
**Agent**: `agent/cmd/agent/`, `agent/internal/`  
**Frontend**: `frontend/src/`

For detailed file locations, see the tables above.
