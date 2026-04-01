# TODO — PRISM Development Roadmap

> **Last Updated**: 2026-04-01 (v0.4.13 — audit corrections applied)
>
> **Purpose**: Development roadmap organized by priority and severity.
>
> **Related Documents**:
> - [BUG.md](./BUG.md) - Bug reports and status
> - [IMPLEMENTED.md](./IMPLEMENTED.md) - Implemented features
> - [TESTING.md](./TESTING.md) - Testing guide
> - [TESTING_COVERAGE.md](./TESTING_COVERAGE.md) - Test coverage details
> - [FRONTEND_AUDIT.md](./FRONTEND_AUDIT.md) - Frontend mockup audit
> - [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md) - Legacy API migration

---

## Recent Releases

### ✅ v0.4.13 (2026-04-01) - BUG-012 COMPLETE: Hardcoded Styles Cleanup
- ✅ **BUG-012: 100% COMPLETE** - All 1,433+ hardcoded style violations FIXED!
- ✅ Fixed ALL layout components (Sidebar, AppLayout)
- ✅ Fixed ALL page components (14 pages)
- ✅ Fixed ALL modal components (14 modals)
- ✅ Fixed ALL service managers (7 managers)
- ✅ Fixed ALL service tabs (4 tabs)
- ✅ Fixed ALL security components
- ✅ Fixed Project color mapping (all 8 colors)
- ⚠️ BUG-013 DISCOVERED: Project colors display with duplicate colors (needs better color palette)
- ✅ All tests passing (76/76 tests)
- ✅ Build successful - Server, Agent, Frontend

### ✅ v0.4.12 (2026-04-01) - Password Fields Cleanup
- ✅ Removed password fields from ProfileModal
- ✅ Removed password fields from UserFormModal (edit mode)
- ✅ Clear UX: dedicated modals for password changes only

### ✅ v0.4.11 (2026-04-01) - Bug Fixes
- ⚠️ Infrastructure tab rename claimed but NOT applied (code still reads "Infrastructure" at `ProjectDetailPage.tsx:202,209`) — BUG-007 remains open
- ✅ Test files cleaned up (removed .bak files)
- ✅ Project color display fixed

### ✅ v0.4.10 (2026-04-01) - Project Color Fix
- ✅ Fixed project color display in create/edit modal
- ✅ Mapped color names to Ant Design token values
- ✅ Consistent color rendering across all views

### ✅ v0.4.9 (2026-04-01) - User Password Change Features
- ✅ User self-service password change (requires current password)
- ✅ Admin password reset for other users (admin-only)
- ✅ Password strength validation (min 8 characters)
- ✅ ChangePasswordModal integrated with ProfileModal
- ✅ ResetPasswordModal integrated with UsersPage

### ✅ v0.4.8 (2026-04-01) - User Profile Menu Relocation
- ✅ Moved user profile from top-right header to bottom-left sidebar
- ✅ Split bottom sidebar: user profile dropdown + logout button
- ✅ Clean modern UI with hover effects

### ✅ v0.4.7 (2026-04-01) - BUG-008 Phase 1 Complete
- ✅ Added deprecation warnings to LegacyAgent model
- ✅ Added X-API-Deprecation-Warning headers to /api/agents endpoints
- ✅ Created MIGRATION_GUIDE.md with detailed migration instructions
- ✅ Documented migration timeline (v0.5 → v0.6 → v1.0)

### ✅ v0.4.6 (2026-04-01) - Process Discovery Modal Integrated
- ✅ RBAC permission creation now uses real API (BUG-010)
- ✅ Created `usePermissions` hook with full CRUD
- ✅ Frontend build successful

### ✅ v0.4.4 (2026-04-01) - Frontend Audit & Bug Fixes
- ✅ Add Database UI for existing accounts (BUG-001)
- ✅ Frontend audit completed - identified 2 mockups/placeholders
- ⚠️ Test files temporarily disabled (TypeScript errors - BUG-009)
- 🔍 Discovered: RBAC permission creation is mockup (BUG-010)
- 🔍 Discovered: Process discovery modal TODO (BUG-011)

### ✅ v0.4.3 (2026-04-01) - Low Priority Bug Fixes

### ✅ v0.4.2 (2026-04-01) - Critical Bug Fixes
- ✅ Valkey provisioning (all 3 subtypes: cache, broker, nosql)
- ✅ Primary database field auto-population
- ✅ Server-side "Add Database to Existing Account" diff logic
- ✅ Valkey module registration and command routing
- ✅ Test suite implementation (79 tests, 92% pass)

### ✅ v0.4.1 - Stability Improvements
- ✅ WebSocket reconnection exponential backoff
- ✅ Runtime detection symlink resolution
- ✅ Ant Design deprecation fixes
- ✅ TypeScript strict mode cleanup

---

## 🔴 CRITICAL PRIORITY

### Test Coverage Gaps

#### Frontend Hooks Testing
**Severity**: 🔴 CRITICAL | **Coverage**: 40% → 80% goal  
**Components**: `src/hooks/`

**Missing Tests**:
- [ ] `useAccounts` - Service account CRUD
- [ ] `useDeployments` - Deployment CRUD
- [ ] `useProjects` - Project CRUD
- [ ] `useUsers` - User management
- [ ] `useManagementCredentials` - Encrypted credentials
- [ ] `useWebSocketAgents` - Real-time agent status

**Files**: `frontend/src/hooks/__tests__/`

---

#### Integration Tests
**Severity**: 🔴 CRITICAL | **Coverage**: 20% → 70% goal  
**Components**: End-to-End flows

**Missing Tests**:
- [ ] Complete account provisioning flow (Frontend → Server → Agent)
- [ ] Valkey account creation flow (all 3 subtypes)
- [ ] Database account creation flow
- [ ] Deployment flow (Git → Agent → PM2/Systemd)
- [ ] Agent registration flow
- [ ] Agent reconnection with backoff

**Framework**: Consider Playwright or Cypress for E2E

---

## 🟡 HIGH PRIORITY

### Test Coverage Gaps

#### Agent Modules Testing
**Severity**: 🟡 HIGH | **Coverage**: 60% → 85% goal  
**Components**: `agent/internal/modules/`

**Missing Tests**:
- [ ] MySQL module operations
- [ ] PostgreSQL module operations
- [ ] MongoDB module operations
- [ ] Valkey module operations (GetInfo, ListKeys, etc.)
- [ ] RabbitMQ module operations
- [ ] MinIO module operations
- [ ] Caddy module operations
- [ ] Nginx module operations
- [ ] PM2 module operations
- [ ] Systemd module operations
- [ ] Firewall module operations

**Files**: `agent/internal/modules/*_test.go`

---

#### Frontend Pages Testing
**Severity**: 🟡 HIGH | **Coverage**: 55% → 80% goal  
**Components**: `frontend/src/pages/`

**Missing Tests**:
- [ ] `DashboardPage` - Overview stats
- [ ] `ProjectsPage` - Project listing
- [ ] `ProjectDetailPage` - Project detail with accounts
- [ ] `AccountsPage` - Account management
- [ ] `DeploymentsPage` - Deployment management
- [ ] `ProcessesPage` - Process management
- [ ] `SecurityPage` - Firewall rules
- [ ] `LogsPage` - Activity log viewer
- [ ] `UsersPage` - User management
- [ ] `SettingsPage` - System settings

**Files**: `frontend/src/pages/__tests__/`

---

#### Database Layer Testing
**Severity**: 🟡 HIGH | **Coverage**: 0% → 70% goal  
**Components**: `server/internal/db/`

**Missing Tests**:
- [ ] CRUD operations for all models
- [ ] SQLCipher encryption tests
- [ ] Migration tests
- [ ] Filter queries tests
- [ ] Transaction tests

**Files**: `server/internal/db/*_test.go`

---

### Feature Enhancements

#### Frontend "Add Database" Dedicated UI
**Severity**: 🟡 HIGH | **Components**: Frontend  
**Tracking**: [BUG-001](./BUG.md#bug-001-add-database-to-existing-account--frontend-ui-missing)  
**Status**: Server-side implemented (v0.4.2), UI pending

**Task**: Add dedicated "Add Database" button in account detail view.

**Requirements**:
- Button visible on MySQL/PostgreSQL/MongoDB account details
- Opens modal with database name input + role selector
- Uses existing server-side diff logic

**Files**: `frontend/src/pages/AccountsPage.tsx` or `AccountDetailModal.tsx`

---

#### Service Activity Logs Tab
**Severity**: 🟡 HIGH | **Components**: Frontend + Server  
**Status**: Not started

**Task**: Add activity log tab in ServiceDetailModal showing logs for each service.

**Requirements**:
- New tab in ServiceDetailModal (from server card)
- Fetch logs filtered by service ID
- Display as timeline/table with timestamps
- Show: start, stop, restart, config change events

**Server Changes**:
- Add `GET /api/logs?serviceId=xxx` endpoint
- Ensure all service operations are logged

**Frontend Changes**:
- Add "Activity" tab to ServiceDetailModal
- Fetch and display logs for selected service

**Files**: 
- Server: `server/internal/api/logs.go`
- Frontend: `frontend/src/components/modals/ServiceDetailModal.tsx`

---

#### Activity Log Enhancements
**Severity**: 🟡 HIGH | **Components**: Server + Agent
**Status**: Not started

**Task**: Expand activity log types to include agent connection events and more.

**New Log Types**:
- `agent_connected` - Agent establishes WebSocket connection
- `agent_disconnected` - Agent disconnects (graceful or timeout)
- `agent_rejected` - Agent enrollment rejected
- `service_discovered` - New service auto-discovered
- `config_changed` - Service configuration modified
- `deployment_started` - Deployment process initiated
- `deployment_completed` - Deployment successful
- `deployment_failed` - Deployment failed

**Server Changes**:
- Update `LogAuditAction` calls to include new event types
- Add agent connection/disconnect logging in WebSocket handler
- Ensure all service operations log appropriate events

**Files**:
- `server/internal/db/db.go` - LogAuditAction function
- `server/cmd/server/main.go` - Agent WebSocket handlers

---

#### Log Clearing & Retention
**Severity**: 🟢 MEDIUM | **Components**: Frontend + Server
**Status**: Not started

**Task**: Add ability to clear/truncate activity logs with retention policies.

**Requirements**:
- Add "Clear Logs" button in LogsPage (admin only)
- Confirmation modal with options:
  - Clear all logs
  - Clear logs older than X days
  - Clear logs by type (service, deployment, security, etc.)
  - Clear logs by agent/server
- Retention policy settings in SettingsPage:
  - Auto-delete logs after X days (default: 30/90/365 days)
  - Max log entries to keep (default: 10000/50000/100000)
  - Archive old logs before deletion (optional)
- Audit trail: Log who cleared logs and when
- API endpoints:
  - `DELETE /api/logs` - Clear logs with filters
  - `GET /api/logs/stats` - Get log statistics (count by type, age, etc.)
  - `PUT /api/settings/log-retention` - Update retention settings

**Server Changes**:
- Add `HandleClearLogs` endpoint with filters
- Add `HandleLogStats` endpoint
- Add retention policy cron job
- Add audit logging for log clearing operations
- Database migration for retention settings

**Frontend Changes**:
- Add "Clear Logs" button in LogsPage
- Create `ClearLogsModal` component
- Add retention settings in SettingsPage
- Show log statistics dashboard

**Files**:
- Server: `server/internal/api/logs.go` - New handlers
- Server: `server/internal/db/db.go` - Clear logs function
- Server: `server/internal/config/` - Retention settings
- Frontend: `frontend/src/pages/LogsPage.tsx` - Clear button
- Frontend: `frontend/src/components/modals/ClearLogsModal.tsx` - NEW
- Frontend: `frontend/src/pages/SettingsPage.tsx` - Retention settings

---

#### ~~Merge Deployments & Processes Pages~~ ✅ DONE (Phase 1)
**Severity**: 🟡 MEDIUM | **Components**: Frontend
**Status**: ✅ Phase 1 complete — unified UI, Phase 2 (Docker/Podman/Binary deployers) deferred to v0.6.0

**Task**: Merge DeploymentsPage and ProcessesPage into unified "Applications" page.

**Background**: 
During early development, the distinction between "Deployments" and "Processes" was unclear. Both essentially manage applications running on servers:
- **Deployments**: Git-based application deployments (release artifacts)
- **Processes**: System processes managed by PM2/Systemd/Supervisor

These should be unified under a single "Applications" concept with different deployment/management methods.

**New Unified Workflow**:
1. **Applications Page** - Single page to manage all running applications
2. **Deployment Methods** (6 methods):
   - **GitHub/GitLab Release** - Deploy from Git release artifacts (tarballs/zip)
   - **Manual Registration** - Register existing processes (PM2/Systemd/Supervisor)
   - **Docker Container** - Deploy from Docker image (Docker Hub, private registry)
   - **Podman Container** - Deploy from Podman image (rootless containers)
   - **Binary Upload** - Upload compiled binary directly (Go, Rust, etc.)
   - **Direct Git Clone** - Clone repo and build on target server
3. **Process Management**:
   - Start/Stop/Restart
   - View logs (real-time streaming)
   - Resource monitoring (CPU, Memory, Network)
   - Auto-restart configuration
   - Health check endpoints
   - Scaling (multiple instances)
4. **Runtime Support**:
   - Node.js (with version management via nvm)
   - Python (with virtualenv support)
   - PHP (with PHP-FPM)
   - Go (static binaries)
   - Java (JAR files)
   - Docker/Podman containers
   - System binaries
5. **Project Context**: Applications linked to projects for organization

**Frontend Changes**:
- Create `ApplicationsPage.tsx` - Unified page with deployment method selector
- Create `ApplicationCard.tsx` - Reusable card component showing app status
- Create `DeployApplicationModal.tsx` - Multi-step wizard with method selection
- Create deployment method-specific components:
  - `GitReleaseForm.tsx` - GitHub/GitLab release deployment
  - `ManualProcessForm.tsx` - Register existing process
  - `DockerForm.tsx` - Docker container deployment
  - `PodmanForm.tsx` - Podman container deployment
  - `BinaryUploadForm.tsx` - Binary file upload
  - `GitCloneForm.tsx` - Direct git clone and build
- Merge columns from both tables
- Unified search/filter by project, agent, runtime, status, deployment method
- Keep deployment history per application
- Process discovery integration
- Real-time deployment progress indicator

**API Changes**:
- `GET /api/applications` - Unified applications list (merge deployments + processes)
- `POST /api/applications` - Create new application (any method)
- `PUT /api/applications/:id` - Update application config
- `DELETE /api/applications/:id` - Remove application
- `POST /api/applications/:id/deploy` - Trigger deployment
- `POST /api/applications/:id/control` - Start/Stop/Restart
- `POST /api/applications/:id/scale` - Scale instances
- `GET /api/applications/:id/logs` - Stream application logs
- `GET /api/applications/:id/metrics` - Get resource metrics
- Keep existing `/api/deployments` for backward compatibility (deprecated)

**Server-Side Deployment Handlers**:
- `GitReleaseDeployer` - Download and extract release artifacts
- `ManualProcessRegistrar` - Register and monitor existing processes
- `DockerDeployer` - Pull and run Docker containers
- `PodmanDeployer` - Pull and run Podman containers (rootless)
- `BinaryUploader` - Handle binary upload and execution
- `GitCloneBuilder` - Clone repo, build, and deploy

**Agent Modules to Implement**:
- `docker.go` - Docker container management
- `podman.go` - Podman container management
- `git.go` - Git operations (clone, pull, checkout)
- `build.go` - Build processes (npm, pip, go build, etc.)

**Migration**:
- Migrate existing deployments to applications table
- Migrate existing processes to applications table
- Update navigation menu: Remove "Deployments" and "Processes", add "Applications"
- Update project detail page tabs
- Backward compatibility layer for existing API clients

**Files**:
- Frontend: `frontend/src/pages/ApplicationsPage.tsx` - NEW
- Frontend: `frontend/src/components/Applications/` - NEW directory
  - `ApplicationCard.tsx` - Reusable card component
  - `DeploymentMethodSelector.tsx` - Method selection UI
  - `GitReleaseForm.tsx` - NEW
  - `ManualProcessForm.tsx` - NEW
  - `DockerForm.tsx` - NEW
  - `PodmanForm.tsx` - NEW
  - `BinaryUploadForm.tsx` - NEW
  - `GitCloneForm.tsx` - NEW
- Frontend: `frontend/src/components/modals/DeployApplicationModal.tsx` - NEW
- Frontend: `frontend/src/pages/DeploymentsPage.tsx` - DEPRECATED (redirect to Applications)
- Frontend: `frontend/src/pages/ProcessesPage.tsx` - DEPRECATED (redirect to Applications)
- Server: `server/internal/api/applications.go` - NEW unified API
- Server: `server/internal/deployers/` - NEW directory
  - `deployer.go` - Interface for all deployers
  - `git_release.go` - NEW
  - `manual_process.go` - NEW
  - `docker.go` - NEW
  - `podman.go` - NEW
  - `binary.go` - NEW
  - `git_clone.go` - NEW
- Agent: `agent/internal/modules/docker.go` - NEW
- Agent: `agent/internal/modules/podman.go` - NEW
- Agent: `agent/internal/modules/git.go` - NEW
- Agent: `agent/internal/modules/build.go` - NEW
- Server: `server/internal/db/migrations/` - Migration for applications table

---

## 🟢 MEDIUM PRIORITY

### User Management Enhancements

#### ~~User Password Change (Self-Service)~~ ✅ FIXED v0.4.9
**Severity**: 🟢 MEDIUM | **Components**: Frontend + Server  
**Status**: ✅ FIXED

**Fix Applied**:
- `ChangePasswordModal.tsx` created with current/new/confirm password fields
- Integrated into `ProfileModal.tsx`
- API endpoint `PUT /api/users/:id/password` implemented
- Password strength validation (min 8 chars)

---

#### ~~Admin Change User Password~~ ✅ FIXED v0.4.9
**Severity**: 🟢 MEDIUM | **Components**: Frontend + Server  
**Status**: ✅ FIXED

**Fix Applied**:
- `ResetPasswordModal.tsx` created
- "Reset Password" action added to `UsersPage.tsx`
- API endpoint `POST /api/users/:id/reset-password` implemented
- Admin-only permission check applied

---

### UI/UX Improvements

#### ~~User Profile Menu Relocation~~ ✅ FIXED v0.4.8
**Severity**: 🟢 MEDIUM | **Components**: Frontend
**Status**: ✅ FIXED - User profile moved to bottom-left sidebar

**Fix Applied**:
- Moved user profile from top-right header to bottom-left sidebar
- Split bottom sidebar into user profile dropdown + logout button
- User profile dropdown includes: My Profile, Settings, Sign Out
- Hover effect on user profile section
- Clean modern UI with avatar and role display

**Files Changed**:
- `frontend/src/layouts/Sidebar.tsx` - Added user profile section at bottom
- `frontend/src/layouts/AppLayout.tsx` - Removed user dropdown from header

---

### Test Coverage Gaps

#### Frontend Modals Testing
**Severity**: 🟢 MEDIUM | **Coverage**: Partial  
**Components**: `frontend/src/components/modals/`

**Missing Tests**:
- [ ] `DeploymentFormModal`
- [ ] `FirewallModal`
- [ ] `CrowdSecModal`
- [ ] `ApproveServerModal`
- [ ] `ServiceDetailModal`
- [ ] `ServerSettingsModal`

**Files**: `frontend/src/components/modals/__tests__/`

---

#### WebSocket Hub Testing
**Severity**: 🟢 MEDIUM | **Coverage**: 0%  
**Components**: `server/internal/ws/`

**Missing Tests**:
- [ ] Message broadcasting
- [ ] Client management
- [ ] Connection handling

**Files**: `server/internal/ws/*_test.go`

---

#### Frontend Contexts Testing
**Severity**: 🟢 MEDIUM | **Coverage**: 0%  
**Components**: `frontend/src/contexts/`

**Missing Tests**:
- [ ] `AuthContext` - Authentication state
- [ ] `AgentsContext` - Agent state management
- [ ] `AppConfigContext` - App configuration

**Files**: `frontend/src/contexts/__tests__/`

---

#### API Endpoints Testing
**Severity**: 🟢 MEDIUM | **Coverage**: Partial  
**Components**: `server/internal/api/`

**Missing Tests**:
- [ ] Management Credentials API
- [ ] Certificates API
- [ ] Servers API (approve/reject)
- [ ] v4.2 advanced features (RBAC, webhooks, retention)

**Files**: `server/internal/api/*_test.go`

---

### Feature Enhancements

#### Valkey Module Aliasing Verification
**Severity**: 🟢 MEDIUM | **Component**: Agent  
**Status**: Implemented in v0.4.2, needs verification

**Task**: Verify `normalizeServiceName()` correctly routes commands for all Valkey subtypes.

**Test Cases**:
- [ ] `valkey-cache` commands route to `valkey` module
- [ ] `valkey-broker` commands route to `valkey` module
- [ ] `valkey-nosql` commands route to `valkey` module

**File**: `agent/cmd/agent/main.go`

---

#### Pending Agent Notification
**Severity**: 🟢 MEDIUM | **Components**: Frontend  
**Tracking**: [BUG-006](./BUG.md#bug-006-pending-agent-notification)  
**Status**: Not started

**Task**: Show badge count for agents awaiting approval.

**Requirements**:
- Badge on "Servers" menu item showing count of pending agents
- Optional: Desktop notification when new agent connects

**Files**: `frontend/src/pages/ServersPage.tsx` or `AppLayout.tsx`

---

#### "Infrastructure" Tab Rename
**Severity**: 🟢 MEDIUM | **Components**: Frontend  
**Tracking**: [BUG-007](./BUG.md#bug-007-infrastructure-tab-misleading)  
**Status**: Not started ⚠️ (erroneously claimed fixed in v0.4.11 release notes — code unchanged)

**Task**: Rename tab to "Processes" or make non-default.

**Options**:
1. Rename "Infrastructure" → "Processes"
2. Change `defaultActiveKey` from "infrastructure" to "accounts"
3. Remove tab entirely (ProcessesPage exists globally)

**File**: `frontend/src/pages/ProjectDetailPage.tsx:202,205,209`

---

#### Certificate Authority Initialization
**Severity**: 🟡 MEDIUM | **Components**: Server  
**Tracking**: [BUG-026](./BUG.md#bug-026-certificate-authority---getcertificateauthority-returns-nil)  
**Status**: Not started

**Task**: Initialize `CertificateAuthority` at server startup instead of returning `nil` from a placeholder function.

**Issue**: `server/internal/api/certificates.go:401-404` — `getCertificateAuthority()` always returns `nil`. Called at lines 62 and 379 without nil-checks, causing potential panic on any certificate API request.

**Fix**:
- Initialize CA in `server/cmd/server/main.go` on startup
- Store as package-level var or pass via server context
- Update `getCertificateAuthority()` to retrieve from context
- Resolve placeholder comments in `server/internal/security/certificates.go:528,534`

**Files**:
- `server/internal/api/certificates.go` - Remove placeholder, retrieve from context
- `server/internal/security/certificates.go` - Implement placeholder stubs
- `server/cmd/server/main.go` - Add CA initialization at startup

---

## 🔵 LOW PRIORITY / TECHNICAL DEBT

### Test Coverage Gaps

#### Performance Tests
**Severity**: 🔵 LOW | **Coverage**: 0%  
**Components**: All

**Missing Tests**:
- [ ] API response time tests
- [ ] WebSocket connection stress tests
- [ ] Database query performance
- [ ] Agent heartbeat load tests
- [ ] Frontend rendering performance

**Framework**: Consider k6 or Apache JMeter

---

#### Security Tests
**Severity**: 🔵 LOW | **Coverage**: 0%  
**Components**: All

**Missing Tests**:
- [ ] SQL injection tests
- [ ] XSS tests
- [ ] CSRF tests
- [ ] Authentication bypass tests
- [ ] Penetration testing scripts

---

#### Accessibility Tests
**Severity**: 🔵 LOW | **Coverage**: 0%  
**Components**: Frontend

**Missing Tests**:
- [ ] Screen reader compatibility
- [ ] Keyboard navigation
- [ ] Color contrast
- [ ] ARIA labels

**Framework**: Consider axe-core or pa11y

---

### Technical Debt

#### Widespread Hardcoded Styles Violation
**Severity**: 🟡 MEDIUM | **Components**: Frontend
**Tracking**: [BUG-012](./BUG.md#bug-012-widespread-hardcoded-styles-violation)
**Status**: 🔧 IN PROGRESS (Phase 1 Complete - v0.4.13)

**Issue**: 1433+ occurrences of hardcoded inline styles throughout frontend codebase.

**Phase 1 Completed (v0.4.13)** - ✅ ~210+ violations fixed:
- ✅ Layout components (Sidebar, AppLayout) - 30+ violations
- ✅ Page components (Dashboard, Projects, Services, Security, Accounts, Users, Settings) - 145+ violations
- ✅ Modal components (ProjectFormModal, AccountFormModal) - 30+ violations

**Files Fixed**:
- `frontend/src/layouts/Sidebar.tsx` - 20+ violations
- `frontend/src/layouts/AppLayout.tsx` - 10+ violations
- `frontend/src/pages/DashboardPage.tsx` - 25+ violations
- `frontend/src/pages/ProjectsPage.tsx` - 15+ violations
- `frontend/src/pages/ServicesPage.tsx` - 30+ violations
- `frontend/src/pages/SecurityPage.tsx` - 40+ violations
- `frontend/src/pages/AccountsPage.tsx` - 15+ violations (partial)
- `frontend/src/pages/UsersPage.tsx` - 15+ violations
- `frontend/src/pages/SettingsPage.tsx` - 10+ violations
- `frontend/src/components/modals/ProjectFormModal.tsx` - 10+ violations
- `frontend/src/components/modals/AccountFormModal.tsx` - 20+ violations

**Remaining Scope** (Phase 2 - Planned for v0.5.0):
- AccountsPage.tsx (remaining violations)
- Other page components (Users, Settings, Logs, Servers, etc.) - 100+ violations
- Other modal components - 40+ violations
- Other components - 100+ violations

**Fix Guidelines Applied**:
1. Replace hardcoded values with tokens:
   - `padding: '16px'` → `padding: token.padding`
   - `borderRadius: '8px'` → `borderRadius: token.borderRadiusLG`
   - `fontSize: '14px'` → `fontSize: token.fontSize`
   - `color: '#fff'` → `color: token.colorWhite`

2. Use Ant Design components with token props:
   - `<Card styles={{ body: { padding: token.padding } }}>`
   - `<Typography.Text style={{ fontSize: token.fontSize }}>`

3. Avoid inline styles when possible:
   - Use Ant Design's `styles` prop
   - Create reusable styled components

**Estimated Effort**: Phase 1 complete. Phase 2 - v0.5.0 cleanup sprint

---

#### Legacy Table Unification (agents → servers)
**Severity**: 🔵 TECHNICAL DEBT | **Components**: Server  
**Tracking**: [BUG-008](./BUG.md#bug-008-legacy-table-redundancy)  
**Status**: ✅ Phase 1 COMPLETE (v0.4.7)

**Issue**: Hub maintains both `agents` (v3.x legacy) and `servers` (v4.x+) tables.

**Phase 1 Completed (v0.4.7)**:
- ✅ Added deprecation comments to `LegacyAgent` struct
- ✅ Added `X-API-Deprecation-Warning` headers to all `/api/agents` responses
- ✅ Added `X-API-Sunset: 2026-12-31` header
- ✅ Created `MIGRATION_GUIDE.md` with detailed migration instructions

**Phase 2: v0.6 - Data Migration** (Planned)
- [ ] Create migration script to copy `agents` → `servers`
- [ ] Update all internal references to use `servers`
- [ ] Keep sync layer for backward compatibility
- [ ] Add feature flag to disable legacy API

**Phase 3: v1.0 - Remove Legacy** (Planned)
- [ ] Remove `agents` table
- [ ] Remove `LegacyAgent` model
- [ ] Remove `/api/agents` endpoint
- [ ] Remove sync layer

**Files**: 
- `server/internal/models/models.go` - ✅ Deprecated `LegacyAgent` struct
- `server/internal/db/db.go` - 🔵 Legacy agent operations (to be removed)
- `server/cmd/server/main.go` - 🔵 Deprecated legacy API endpoint
- `MIGRATION_GUIDE.md` - ✅ Migration documentation

---

#### Code Quality Improvements
**Severity**: 🔵 LOW | **Components**: Server, Agent

**Tasks**:
- [ ] Add more inline documentation
- [ ] Standardize error handling patterns
- [ ] Add request/response logging
- [ ] Implement circuit breaker pattern

---

## Future Features

### Runtime Environment Manager
- [ ] Auto-detect installed runtimes on agent bootstrap
- [ ] Report runtime versions to Hub
- [ ] Optional auto-install via `nvm`, `pyenv`, or package manager

### Web Proxy Enhancements
- [ ] SSL/TLS auto-provisioning via Caddy (Let's Encrypt)
- [ ] Proxy health checks and uptime monitoring
- [ ] Proxy logs streaming to dashboard

### Dashboard Improvements
- [ ] Deployments widget on main Dashboard
- [ ] Deployment count + status in Project detail
- [ ] Real-time deployment log streaming

### Configuration Drift Detection UI
- [ ] Drift detection dashboard (backend exists)
- [ ] Snapshot comparison view
- [ ] Auto-remediation actions

### Webhook & Notifications UI
- [ ] Webhook delivery management (backend exists)
- [ ] Email/Slack notification integration
- [ ] Alert rules for service down / drift

### Security & RBAC UI
- [ ] Granular permission assignment
- [ ] Server group-based access control
- [ ] API key authentication for CI/CD

### Operational Tools
- [ ] Database backup & restore tooling
- [ ] Telemetry auto-cleanup (cron-based)
- [ ] Multi-node Hub clustering

---

## Release Planning

### ✅ v0.4.13 (Current) - BUG-012 Phase 1
- ✅ Hardcoded styles cleanup - 165+ violations fixed
- ✅ Ant Design theme tokens integration
- ✅ Dark mode readiness improved

### v0.5.0 (Next Sprint)
- 🔴 **BUG-014** - ServiceDetailModal account management callbacks
- 🔴 **BUG-015** - ConfigurationTab configuration save (API implementation)
- 🔴 **Test Infrastructure Setup** - Fix AuthContext mocking for hook tests
- 🔴 Frontend hooks testing (useAccounts, useDeployments, etc.) - Test templates created
- 🔴 Integration tests for critical flows
- 🟠 **BUG-016** - RBACPage edit permission modal
- 🟠 **BUG-017** - LogsTab WebSocket streaming (replace mock data)
- 🟠 **BUG-018** - sqlite.go account config JSON serialization
- 🟡 **BUG-026** - Certificate authority initialization (getCertificateAuthority returns nil)
- 🟡 **BUG-007** - Infrastructure tab rename in ProjectDetailPage (erroneously claimed fixed in v0.4.11)
- 🟡 **BUG-019** - Remove console.log from production code (8 occurrences)
- 🟡 **BUG-020** - Add user-facing error messages (silent failures)
- 🟡 Agent modules testing
- 🟡 Frontend pages testing
- 🟡 Database layer testing
- ✅ **DONE**: Merge Deployments & Processes → ApplicationsPage (Phase 1)
- 🟡 Service activity logs tab
- 🟡 Activity log enhancements
- 🟢 Log clearing & retention feature
- ✅ BUG-013 - Project color display - **FIXED in v0.4.13**
- ✅ BUG-012 - Hardcoded styles - **100% COMPLETE in v0.4.13**
- 🔵 CI/CD GitHub Actions workflow
- 🔵 **BUG-006** - Pending agent notification badge (LOW priority)

### v0.6.0 (Future)
- 🔵 Legacy table unification
- 🔵 Runtime environment manager
- 🔵 SSL auto-provisioning
- 🔵 Performance tests
- 🔵 Security tests

---

## Quick Reference

**For Bug Reports**: See [BUG.md](./BUG.md)  
**For Implemented Features**: See [IMPLEMENTED.md](./IMPLEMENTED.md)  
**For Testing Guide**: See [TESTING.md](./TESTING.md)  
**For Coverage Details**: See [TESTING_COVERAGE.md](./TESTING_COVERAGE.md)
