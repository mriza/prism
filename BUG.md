# PRISM Bug Report

> **Last Updated**: 2026-04-01 (v0.4.14 — second audit, BUG-038/039 added)
>
> **Purpose**: Active bug registry - only unfixed bugs listed here.
>
> **For Fixed Bugs**: See [IMPLEMENTED.md](./IMPLEMENTED.md)
> **For Test Results**: See [TESTING.md](./TESTING.md)

---

## Current Status

| Status | Count | Description |
|--------|-------|-------------|
| ✅ Fixed | 33 | 23 from v0.4.13 and earlier + BUG-014, 015, 016, 017, 018, 026, 027, 028, 029, 030 |
| ❌ Active | 16 | BUG-038 (critical), 019, 020, 021, 022, 031, 032, 035, 036, 037, 039, 006, 023, 024, 025, 033, 034 |

**Summary**:
- **Total Bugs Tracked**: 49
- **Resolution Rate**: 67.3% (33/49)
- **Critical Priority**: 1 (BUG-038)
- **Medium Priority**: 10 (BUG-019, 020, 021, 022, 031, 032, 035, 036, 037, 039)
- **Low Priority**: 5 (BUG-006, 023, 024, 025, 033, 034)

---

## Active Bugs

### 🔴 CRITICAL Priority

#### ~~[BUG-014] ServiceDetailModal - Account Management Actions Not Implemented~~ ✅ FIXED
**Severity**: 🔴 CRITICAL | **Components**: Frontend | **Status**: ✅ FIXED

**Fix Applied**:
- Imported `AccountFormModal` into `ServiceModal.tsx`
- Added `isAccountFormOpen` / `editingAccount` state
- Destructured `createAccount`, `updateAccount`, `deleteAccount`, `fetchAccounts` from `useAccounts`
- Implemented `handleCreateAccount`, `handleEditAccount`, `handleDeleteAccount`, `handleAccountSave` callbacks
- Rendered `AccountFormModal` inside `ServiceModal` JSX

---

#### ~~[BUG-015] ConfigurationTab - Configuration Update Not Implemented~~ ✅ FIXED
**Severity**: 🔴 CRITICAL | **Components**: Frontend + Agent | **Status**: ✅ FIXED

**Fix Applied**:
- Rewrote `ConfigurationTab.tsx` to use real agent API calls
- Fetches raw config file content via `service_get_config` on mount
- Displays config in editable textarea (monospace)
- Save button calls `service_update_config` with full file content
- Handles "unsupported" gracefully when module doesn't implement `ConfigurableModule`
- Removed misleading hardcoded MySQL placeholder fields
- Props renamed: `_agentId`→`agentId`, `_serviceName`→`serviceName` (now actually used)

---

### 🟠 HIGH Priority

#### ~~[BUG-016] RBACPage - Edit Permission Not Implemented~~ ✅ FIXED
**Severity**: 🟠 HIGH | **Components**: Frontend | **Status**: ✅ FIXED (v0.4.14)

**Fix Applied**:
- Added `editingPermission` state to track which permission is being edited
- Imported `updatePermission` from `usePermissions` hook
- Updated Edit button onClick to populate form with existing permission data
- Modified Modal title to dynamically show "Edit Permission" or "Create Permission"
- Updated form onFinish to call `updatePermission` when editing, `createPermission` when creating
- Added proper success/error messages for both operations
- Form fields are now populated when editing via `form.setFieldsValue()`

**Files Modified**:
- `frontend/src/pages/RBACPage.tsx` - Implemented edit permission modal with update API call

---

#### ~~[BUG-017] LogsTab - WebSocket Stream Not Implemented~~ ✅ FIXED (Partial)
**Severity**: 🟠 HIGH | **Components**: Frontend + Server | **Status**: ✅ FIXED (v0.4.14)

**Fix Applied**:
- Created new `useWebSocketLogs` hook for real-time log streaming
- Implemented server-side WebSocket handler `handleLogsWS` in `server/cmd/server/main.go`
- Added `/ws/logs` WebSocket endpoint for log streaming
- Updated `LogsTab` component to use real WebSocket instead of mock data
- Logs now stream from server with initial batch + real-time updates
- Added connection status indicator (Live/Disconnected)
- Implemented ping/pong keepalive mechanism
- Support for filtering by log level, search, and tail lines
- Auto-scroll and pause/resume functionality preserved

**Files Modified**:
- `frontend/src/hooks/useWebSocketLogs.ts` - New WebSocket hook for log streaming
- `frontend/src/components/services/LogsTab.tsx` - Integrated real WebSocket streaming
- `frontend/src/components/ServiceModal.tsx` - Updated prop names (agentId, serviceName)
- `server/cmd/server/main.go` - Added `handleLogsWS` function and `/ws/logs` route

**Note**: Current implementation sends initial batch of logs from DB and maintains WebSocket connection.
Real-time forwarding of new agent log events to connected clients is not yet implemented.
See server/cmd/server/main.go:1106-1109 comment. Full streaming requires BUG-037 fix.

---

#### ~~[BUG-018] Server Database Configuration - TODO Comments~~ ✅ FIXED
**Severity**: 🟠 HIGH | **Components**: Server | **Status**: ✅ FIXED

**Fix Applied**:
- Added `"encoding/json"` import to `sqlite.go`
- `CreateServiceAccount`: serializes `account.Config` map to JSON with `json.Marshal`
- `GetServiceAccounts`: deserializes `configJSON` back to `map[string]interface{}` with `json.Unmarshal`, falls back to empty map on parse error

---

### 🟡 MEDIUM Priority

#### ~~[BUG-026] Certificate Authority - getCertificateAuthority() Returns Nil~~ ✅ FIXED
**Severity**: 🟡 MEDIUM | **Components**: Server | **Status**: ✅ FIXED (v0.4.14)

**Fix Applied**:
- Added `globalCA` variable in `cmd/server/main.go` to store CA instance
- Initialize `CertificateAuthority` at server startup using `security.NewCertificateAuthority()`
- Created `SetCertificateAuthority()` function in `api/certificates.go` package
- Updated `getCertificateAuthority()` to return the initialized global CA instance
- Added proper error handling - server exits if CA initialization fails
- CA logs common name and expiry date on successful initialization

**Files Modified**:
- `server/cmd/server/main.go` - Added global CA variable and initialization
- `server/internal/api/certificates.go` - Added `SetCertificateAuthority()` and updated `getCertificateAuthority()`

**Impact**: Certificate endpoints now work properly without nil pointer panics.

---

#### ~~[BUG-027] ProcessDiscoveryModal - Unhandled Promise Rejection~~ ✅ FIXED
**Severity**: 🟡 MEDIUM | **Components**: Frontend | **Status**: ✅ FIXED (v0.4.14)

**Fix Applied**:
- Added `.catch()` handler to `listSystemdUnits()` promise chain
- Added `.finally()` to ensure `setLoading(false)` is always called
- Error is logged to console for debugging
- Modal no longer gets stuck with infinite spinner on error

**Files Modified**:
- `frontend/src/components/modals/ProcessDiscoveryModal.tsx` - Added proper promise error handling

---

#### ~~[BUG-028] FirewallModal / CrowdSecModal - No HTTP Status Check in controlAgent~~ ✅ FIXED
**Severity**: 🟡 MEDIUM | **Components**: Frontend | **Status**: ✅ FIXED (v0.4.14)

**Fix Applied**:
- Added `if (!res.ok)` check in `controlAgent()` helper function
- Reads error response body with `res.text()` for detailed error message
- Throws descriptive error with HTTP status code and status text
- Applied to both `FirewallModal.tsx` and `CrowdSecModal.tsx`

**Files Modified**:
- `frontend/src/components/modals/FirewallModal.tsx:43-54` - Added HTTP status check
- `frontend/src/components/modals/CrowdSecModal.tsx:45-56` - Added HTTP status check

---

#### ~~[BUG-029] FirewallModal - Missing try/catch in handleAdd / handleDelete~~ ✅ FIXED
**Severity**: 🟡 MEDIUM | **Components**: Frontend | **Status**: ✅ FIXED (v0.4.14)

**Fix Applied**:
- Wrapped `handleAdd()`, `handleDelete()`, and `handleDefaultPolicy()` in try/catch
- Clear error state at start of each handler with `setError('')`
- Display error messages to users via `setError()` with descriptive messages
- `actionLoading` state properly cleared in finally block (implicit via setActionLoading after try/catch)

**Files Modified**:
- `frontend/src/components/modals/FirewallModal.tsx:88-128` - Added try/catch to all handlers

---

#### ~~[BUG-030] CrowdSecModal - Missing try/catch in handleAdd / handleDelete~~ ✅ FIXED
**Severity**: 🟡 MEDIUM | **Components**: Frontend | **Status**: ✅ FIXED (v0.4.14)

**Fix Applied**:
- Wrapped `handleAdd()` and `handleDelete()` in try/catch
- Clear error state at start of each handler
- Display error messages to users with descriptive messages
- `actionLoading` state properly cleared after error handling

**Files Modified**:
- `frontend/src/components/modals/CrowdSecModal.tsx:88-116` - Added try/catch to all handlers

---

#### [BUG-038] /api/permissions Route Not Registered — RBACPage Completely Broken
**Severity**: 🔴 CRITICAL | **Components**: Server | **Status**: ❌ NOT FIXED

**Location**: `server/cmd/server/main.go` (missing route registration)

**Issue**: `HandleRBACPermissions` is implemented in `server/internal/api/v42.go:12` but **never registered** as an HTTP route in `main.go`. Frontend `usePermissions` hook calls `/api/permissions` for all CRUD operations. These requests hit the default catch-all handler and return 404.

Cross-reference: All other frontend API paths are registered (`/api/projects`, `/api/accounts`, `/api/deployments`, etc.) — `/api/permissions` is the only missing one.

```
// main.go registers (partial list):
http.HandleFunc("/api/projects", ...)
http.HandleFunc("/api/accounts", ...)
// Missing:
// http.HandleFunc("/api/permissions", ...)  ← NOT PRESENT
```

**Impact**: RBACPage is completely non-functional. All permission list/create/update/delete operations silently fail with 404. BUG-016 fix (edit permission modal) is effectively useless because the API itself isn't reachable.

**Fix Required**: Add to `main.go`:
```go
http.HandleFunc("/api/permissions", api.AuthMiddleware(api.HandleRBACPermissions, "admin"))
```

Also register other unregistered v42.go handlers if needed:
- `HandleServerGroups` → `/api/server-groups`

**Planned**: Immediate (v0.4.15)

---

#### [BUG-039] Unregistered API Handlers — /api/servers and /api/certificates
**Severity**: 🟡 MEDIUM | **Components**: Server | **Status**: ❌ NOT FIXED

**Location**: `server/cmd/server/main.go` (missing route registrations)

**Issue**: Several handler functions are fully implemented but not registered as HTTP routes:

From `server/internal/api/servers.go`:
- `HandleServers` → intended route `/api/servers`
- `HandleServerDetail` → intended route `/api/servers/`
- `HandleServerHeartbeat` → intended route `/api/servers/{id}/heartbeat`
- `HandleServerServices` → intended route `/api/servers/{id}/services`

From `server/internal/api/certificates.go`:
- `HandleCertificates` → intended route `/api/certificates`
- `HandleCertificateDetail`, `HandleEnrollmentKeys`, `HandleEnrollmentKeyDetail`
- `HandleCertificateStats`, `HandleEnrollmentKeyStats`, `HandleCertificateAuthority`

**Current Workaround**: Frontend uses deprecated `/api/agents` endpoint (still registered) which mirrors server listing functionality. This works but relies on a deprecated code path scheduled for removal in v1.0.

**Impact**: New `/api/servers` API is unreachable. Frontend migration from deprecated `/api/agents` to `/api/servers` is blocked. Certificate management API unavailable (no frontend calls yet, but future features will need it).

**Fix Required**: Register all handlers in `main.go` and migrate frontend `useAgents` hook to use `/api/servers` instead of deprecated `/api/agents`.

**Planned**: v0.5.0 (coordinate with BUG-008 legacy migration)

---

#### [BUG-031] ServerSettingsModal - Potential Null Dereference on activeFw
**Severity**: 🟡 MEDIUM | **Components**: Frontend | **Status**: ❌ NOT FIXED

**Location**: `frontend/src/components/modals/ServerSettingsModal.tsx:49`

**Issue**: `activeFw` is derived from `firewalls[0]` as a fallback, which is `undefined` if the list is empty. Line 49 dereferences `activeFw?.name` which is safe, but subsequent code may assume it's defined.

**Fix Required**: Add explicit guard: `if (!activeFw) return;` at the top of `handleSwitchFirewall`.

**Planned**: v0.5.0

---

#### [BUG-032] ProjectDetailPage - Missing try/catch in fetchProjectInfra
**Severity**: 🟡 MEDIUM | **Components**: Frontend | **Status**: ❌ NOT FIXED

**Location**: `frontend/src/pages/ProjectDetailPage.tsx:73-115`

**Issue**: `fetchProjectInfra()` loops over agents and calls `listSubProcesses()` without try/catch. If any call rejects mid-loop, the function crashes silently — `setLoadingInfra(false)` is never called and the infra section stays in infinite loading state.

**Fix Required**: Wrap the loop body in try/catch with `setLoadingInfra(false)` in a finally block.

**Planned**: v0.5.0

---

#### [BUG-035] Certificate Module - loadFile / saveFile Are Placeholder Stubs
**Severity**: 🟡 MEDIUM | **Components**: Server | **Status**: ❌ NOT FIXED

**Location**: `server/internal/security/certificates.go:526-535`

**Issue**: Both `loadFile()` and `saveFile()` always return `errors.New("not implemented")`:

```go
func loadFile(path string) ([]byte, error) {
    // In real implementation, use os.ReadFile
    return nil, errors.New("not implemented")
}

func saveFile(path string, data []byte) error {
    // In real implementation, use os.WriteFile
    return errors.New("not implemented")
}
```

**Impact**: CA certificates cannot be persisted to or loaded from disk. Closely related to BUG-026.

**Fix Required**: Replace stubs with `os.ReadFile` / `os.WriteFile` implementations.

**Planned**: v0.5.0 (fix together with BUG-026)

---

#### [BUG-036] Nftables Module - Port/Policy Management Not Implemented
**Severity**: 🟡 MEDIUM | **Components**: Agent | **Status**: ❌ NOT FIXED

**Location**: `agent/internal/modules/nftables.go:77-93`

**Issue**: Four critical firewall functions return "not implemented" errors:

```go
func (n *NftablesModule) OpenPort(port int, protocol string) error {
    return fmt.Errorf("nftables automated port opening is not implemented")
}
func (n *NftablesModule) ClosePort(port int, protocol string) error {
    return fmt.Errorf("nftables automated port closing is not implemented")
}
func (n *NftablesModule) DeleteRule(ruleID string) error {
    return fmt.Errorf("deleting nftables rules by ID is not natively supported yet")
}
func (n *NftablesModule) SetDefaultPolicy(policy string) error {
    return fmt.Errorf("setting default policy on nftables is not implemented")
}
```

**Impact**: Users can discover/register nftables but cannot manage firewall rules through PRISM. UFW is the only functional firewall backend.

**Fix Required**: Implement nftables rule management using `nft` CLI commands.

**Planned**: v0.5.0

---

#### [BUG-037] LogsTab - No Real-Time Log Forwarding from Agent Events
**Severity**: 🟡 MEDIUM | **Components**: Server | **Status**: ❌ NOT FIXED

**Location**: `server/cmd/server/main.go:1106-1109`

**Issue**: The `/ws/logs` WebSocket handler sends an initial batch of logs from the database, then keeps the connection alive with ping/pong. However, it does not subscribe to agent log events and does not forward new log entries to connected clients in real time. The server comment explicitly acknowledges this gap:

```go
// Note: For real-time log streaming from agents, you would need to:
// 1. Subscribe to agent log events via the WebSocket hub
// 2. Forward relevant logs to this client
// This is a basic implementation that sends initial logs and keeps connection alive
```

**Impact**: The Logs tab shows historical logs correctly but does not update when new log events arrive while the modal is open.

**Fix Required**:
- When a new agent event is saved to DB, broadcast it via `wsHub` to all log subscribers matching `agentId` + `service`
- Add subscription tracking in the log WS handler (map of `agentId:service` → connected clients)

**Planned**: v0.5.0

---

#### [BUG-019] Console.log in Production Code
**Severity**: 🟡 MEDIUM | **Components**: Frontend | **Status**: ❌ NOT FIXED

**Location**: Multiple files — at least 18 `console.log` + 9 `console.error` occurrences

Key files:
- `frontend/src/hooks/useWebSocketLogs.ts` (9x)
- `frontend/src/hooks/useWebSocketAgents.ts` (9x)
- `frontend/src/contexts/AgentsContext.tsx` (1x)
- `frontend/src/contexts/AppConfigContext.tsx` (2x console.error)
- `frontend/src/contexts/AuthContext.tsx` (1x console.error)

**Fix Required**: Remove all console.log/console.error. Add a proper logging service for debug output gated by env flag.

**Planned**: v0.5.0

---

#### [BUG-020] Error Handling - Silent Failures
**Severity**: 🟡 MEDIUM | **Components**: Frontend | **Status**: ❌ NOT FIXED

**Issue**: Many catch blocks only log error to console with no user-facing feedback.

**Fix Required**: Add `message.error(...)` in catch blocks across hooks and components.

**Planned**: v0.5.0

---

#### [BUG-021] ProcessDiscoveryModal - No Error Feedback
**Severity**: 🟡 MEDIUM | **Components**: Frontend | **Status**: ❌ NOT FIXED

**Issue**: Process discovery failures not shown to user (silently ignored after logging). Related to BUG-027.

**Fix Required**: Add error state and display `Alert` with retry button when discovery fails.

**Planned**: v0.5.0

---

#### [BUG-022] AgentsContext - Polling Fallback Without Warning
**Severity**: 🟡 MEDIUM | **Components**: Frontend | **Status**: ❌ NOT FIXED

**Issue**: When WebSocket connection fails, AgentsContext silently falls back to polling with no visual indicator shown to the user.

**Fix Required**: Add a visible status badge or banner when operating in polling fallback mode.

**Planned**: v0.5.0

---

### 🟢 LOW Priority

#### [BUG-006] Pending Agent Notification Badge
**Severity**: 🟢 LOW | **Components**: Frontend | **Status**: ❌ NOT FIXED

**Issue**: Admin sidebar doesn't show a badge count for agents awaiting approval.

**Fix Required**: Add badge to "Servers" menu item showing pending agent count.

**Planned**: v0.5.0

---

#### [BUG-023] ProfileModal - Password Change Error Messages
**Severity**: 🟢 LOW | **Components**: Frontend | **Status**: ❌ NOT FIXED

**Issue**: Generic error messages for password change failures (no distinction between wrong current password, validation failure, etc.).

**Fix Required**: Parse server error response and show specific error messages with password requirements.

**Planned**: v0.5.0

---

#### [BUG-024] Service Managers - Inconsistent Error Messages
**Severity**: 🟢 LOW | **Components**: Frontend | **Status**: ❌ NOT FIXED

**Issue**: All service manager load failures show generic "Failed to load settings" regardless of error type.

**Fix Required**: Add specific error messages per error type (network error, auth error, service unavailable, etc.).

**Planned**: v0.5.0

---

#### [BUG-025] Missing Loading States
**Severity**: 🟢 LOW | **Components**: Frontend | **Status**: ❌ NOT FIXED

**Issue**: Some async operations don't show loading state, causing UI to appear unresponsive.

**Fix Required**: Audit and add loading state to all async operations.

**Planned**: v0.5.0

---

#### [BUG-033] Loose `any[]` Typing in State Variables
**Severity**: 🟢 LOW | **Components**: Frontend | **Status**: ❌ NOT FIXED

**Location** (examples):
- `frontend/src/components/services/managers/DatabaseManager.tsx:34`
- `frontend/src/components/services/managers/RabbitMQManager.tsx:64`
- `frontend/src/components/modals/ServiceDetailModal.tsx:125,131`
- `frontend/src/pages/ProjectDetailPage.tsx:57`

**Issue**: Multiple `useState<any[]>([])` declarations defeat TypeScript type safety — no IDE autocomplete, no shape validation, runtime errors not caught at compile time.

**Fix Required**: Define proper interfaces for each state and replace `any[]`.

**Planned**: v0.5.0

---

#### [BUG-034] FirewallModal / CrowdSecModal - Missing VITE_API_URL Prefix
**Severity**: 🟢 LOW | **Components**: Frontend | **Status**: ❌ NOT FIXED

**Location**:
- `frontend/src/components/modals/FirewallModal.tsx:44`
- `frontend/src/components/modals/CrowdSecModal.tsx:46`

**Issue**: Local `controlAgent()` helpers use hardcoded relative `/api/control` instead of `${import.meta.env.VITE_API_URL || ''}/api/control` as used everywhere else. Works with default deployment but breaks in non-standard proxy/sub-path setups.

**Fix Required**: Replace with `${import.meta.env.VITE_API_URL || ''}/api/control`.

**Planned**: v0.5.0

---

## Recently Fixed (v0.4.14)

### ✅ BUG-016: RBACPage - Edit Permission
**Fix**: Implemented edit permission modal with `updatePermission` API call. Edit button populates form with existing data via `form.setFieldsValue()`.

### ✅ BUG-017: LogsTab - WebSocket Streaming (Partial)
**Fix**: Created `useWebSocketLogs` hook and `handleLogsWS` server handler. Sends initial DB batch + keeps connection alive. Real-time streaming gap tracked as BUG-037.

### ✅ BUG-014: ServiceModal - Account Management Callbacks
### ✅ BUG-015: ConfigurationTab - Config Save via Agent API
### ✅ BUG-018: sqlite.go - Account Config JSON Serialization

---

## Bug Index by Status

| Component | Active | Fixed | Total |
|-----------|--------|-------|-------|
| Frontend  | 10     | 30    | 40    |
| Server    | 5      | 3     | 8     |
| Agent     | 1      | 0     | 1     |
| **Total** | **16** | **33** | **49** |

---

## Quick Reference

**Active Bugs (16)**:

🔴 Critical (1):
- BUG-038 - /api/permissions not registered → RBACPage completely broken

🟡 Medium (10):
- BUG-019 - console.log in production code (18+ occurrences)
- BUG-020 - Silent error failures, no user-facing feedback
- BUG-021 - ProcessDiscoveryModal no error feedback
- BUG-022 - AgentsContext polling fallback without visual indicator
- BUG-031 - ServerSettingsModal potential null dereference on activeFw
- BUG-032 - ProjectDetailPage missing try/catch in fetchProjectInfra
- BUG-035 - certificates.go loadFile/saveFile are placeholder stubs
- BUG-036 - nftables OpenPort/ClosePort/SetDefaultPolicy not implemented
- BUG-037 - LogsTab no real-time log forwarding from agent events
- BUG-039 - /api/servers and /api/certificates handlers unregistered (deprecated /api/agents still used)

🟢 Low (5):
- BUG-006 - Pending agent notification badge missing
- BUG-023 - ProfileModal generic password change error messages
- BUG-024 - Service managers inconsistent error messages
- BUG-025 - Missing loading states in some async operations
- BUG-033 - Loose `any[]` typing in state variables
- BUG-034 - FirewallModal/CrowdSecModal missing VITE_API_URL prefix

**Recently Fixed**:
- ✅ BUG-026 - Certificate Authority nil pointer fix (v0.4.14)
- ✅ BUG-027 - ProcessDiscoveryModal unhandled promise rejection (v0.4.14)
- ✅ BUG-028 - FirewallModal/CrowdSecModal HTTP status check (v0.4.14)
- ✅ BUG-029 - FirewallModal missing try/catch (v0.4.14)
- ✅ BUG-030 - CrowdSecModal missing try/catch (v0.4.14)
- ✅ BUG-016 - RBACPage edit permission (v0.4.14)
- ✅ BUG-017 - LogsTab WebSocket initial streaming (v0.4.14)
- ✅ BUG-014 - ServiceModal account management callbacks
- ✅ BUG-015 - ConfigurationTab config save via agent API
- ✅ BUG-018 - sqlite.go account config JSON serialization
- ✅ BUG-013 - Project color display duplicate colors (v0.4.13)
- ✅ BUG-012 - Hardcoded styles 100% COMPLETE (v0.4.13)

**For Implementation Details**: See [IMPLEMENTED.md](./IMPLEMENTED.md)
**For Test Results**: See [TESTING.md](./TESTING.md)
**For Development Roadmap**: See [TODO.md](./TODO.md)

---

*Last Updated: 2026-04-01 (v0.4.14 — second audit: BUG-038 critical, BUG-039 medium added)*
*Next Review: v0.5.0 release*
