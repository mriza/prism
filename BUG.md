# PRISM Bug Report

> **Last Updated**: 2026-04-01 (v0.4.14 — post-merge audit)
>
> **Purpose**: Active bug registry - only unfixed bugs listed here.
>
> **For Fixed Bugs**: See [IMPLEMENTED.md](./IMPLEMENTED.md)
> **For Test Results**: See [TESTING.md](./TESTING.md)

---

## Current Status

| Status | Count | Description |
|--------|-------|-------------|
| ✅ Fixed | 28 | 23 from v0.4.13 and earlier + BUG-014, BUG-015, BUG-016, BUG-017, BUG-018 |
| ❌ Active | 19 | 9 existing + 10 new from post-merge audit |

**Summary**:
- **Total Bugs Tracked**: 47
- **Resolution Rate**: 59.6% (28/47)
- **Critical/High Priority**: 0
- **Medium Priority**: 14 (BUG-019, 020, 021, 022, 026, 027, 028, 029, 030, 031, 032, 035, 036, 037)
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

#### [BUG-026] Certificate Authority - getCertificateAuthority() Returns Nil
**Severity**: 🟡 MEDIUM | **Components**: Server | **Status**: ❌ NOT FIXED

**Location**: `server/internal/api/certificates.go:401-404`

**Issue**: `getCertificateAuthority()` is a placeholder that always returns `nil`. Two call sites at lines 62 and 379 dereference this value without nil-checks.

```go
func getCertificateAuthority() *security.CertificateAuthority {
    // This is a placeholder - in real implementation, CA should be initialized
    // at server startup and stored in a global variable or context
    return nil
}
```

**Impact**: Any request to `/api/certificates` endpoints will cause a nil pointer dereference panic, crashing the server goroutine for that request.

**Fix Required**:
- Initialize `CertificateAuthority` at server startup (in `cmd/server/main.go`)
- Store the CA instance in server context or as a package-level singleton
- Pass it to the certificate API handlers (or retrieve from context)
- Add nil-check guard in `getCertificateAuthority()` as a safety fallback

**Planned**: v0.5.0

---

#### [BUG-027] ProcessDiscoveryModal - Unhandled Promise Rejection
**Severity**: 🟡 MEDIUM | **Components**: Frontend | **Status**: ❌ NOT FIXED

**Location**: `frontend/src/components/modals/ProcessDiscoveryModal.tsx:53-69`

**Issue**: `listSystemdUnits()` is called without a `.catch()` or `try/catch`. If the promise rejects, the rejection is unhandled and `loading` state never resets, leaving the modal stuck with an infinite spinner.

```tsx
listSystemdUnits(agentId).then(raw => {
    if (raw) { /* ... */ }
    setLoading(false);  // never called on rejection
});
// No .catch() handler
```

**Fix Required**: Wrap in try/catch or add `.catch(err => { setError(err.message); setLoading(false); })`.

**Planned**: v0.5.0

---

#### [BUG-028] FirewallModal / CrowdSecModal - No HTTP Status Check in controlAgent
**Severity**: 🟡 MEDIUM | **Components**: Frontend | **Status**: ❌ NOT FIXED

**Location**:
- `frontend/src/components/modals/FirewallModal.tsx:43-50`
- `frontend/src/components/modals/CrowdSecModal.tsx:45-51`

**Issue**: The local `controlAgent()` helper calls `fetch()` but never checks `res.ok` before calling `res.json()`. An HTTP 4xx or 5xx response is silently treated as success.

```tsx
const res = await fetch(`/api/control`, { ... });
return res.json();  // no res.ok check
```

**Fix Required**: Add `if (!res.ok) throw new Error(...)` before `return res.json()`.

**Planned**: v0.5.0

---

#### [BUG-029] FirewallModal - Missing try/catch in handleAdd / handleDelete
**Severity**: 🟡 MEDIUM | **Components**: Frontend | **Status**: ❌ NOT FIXED

**Location**: `frontend/src/components/modals/FirewallModal.tsx:86-102`

**Issue**: `handleAdd()` and `handleDelete()` have no try/catch. If `controlAgent()` or `fetchRules()` throws, the error is unhandled, `actionLoading` is never cleared, and the user sees no feedback.

**Fix Required**: Wrap async bodies in try/catch with `message.error(...)` and `setActionLoading('')` in finally block.

**Planned**: v0.5.0

---

#### [BUG-030] CrowdSecModal - Missing try/catch in handleAdd / handleDelete
**Severity**: 🟡 MEDIUM | **Components**: Frontend | **Status**: ❌ NOT FIXED

**Location**: `frontend/src/components/modals/CrowdSecModal.tsx:86-104`

**Issue**: Same pattern as BUG-029 — `handleAdd()` and `handleDelete()` lack error handling.

**Fix Required**: Same as BUG-029.

**Planned**: v0.5.0

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
| Frontend  | 15     | 25    | 40    |
| Server    | 3      | 3     | 6     |
| Agent     | 1      | 0     | 1     |
| **Total** | **19** | **28** | **47** |

---

## Quick Reference

**Active Bugs (19)**:

🟡 Medium (14):
- BUG-019 - console.log in production code (18+ occurrences)
- BUG-020 - Silent error failures, no user-facing feedback
- BUG-021 - ProcessDiscoveryModal no error feedback
- BUG-022 - AgentsContext polling fallback without visual indicator
- BUG-026 - getCertificateAuthority() returns nil (potential panic)
- BUG-027 - ProcessDiscoveryModal unhandled promise rejection (infinite spinner)
- BUG-028 - FirewallModal/CrowdSecModal no HTTP status check in controlAgent
- BUG-029 - FirewallModal missing try/catch in handleAdd/handleDelete
- BUG-030 - CrowdSecModal missing try/catch in handleAdd/handleDelete
- BUG-031 - ServerSettingsModal potential null dereference on activeFw
- BUG-032 - ProjectDetailPage missing try/catch in fetchProjectInfra
- BUG-035 - certificates.go loadFile/saveFile are placeholder stubs
- BUG-036 - nftables OpenPort/ClosePort/SetDefaultPolicy not implemented
- BUG-037 - LogsTab no real-time log forwarding from agent events

🟢 Low (5):
- BUG-006 - Pending agent notification badge missing
- BUG-023 - ProfileModal generic password change error messages
- BUG-024 - Service managers inconsistent error messages
- BUG-025 - Missing loading states in some async operations
- BUG-033 - Loose `any[]` typing in state variables
- BUG-034 - FirewallModal/CrowdSecModal missing VITE_API_URL prefix

**Recently Fixed**:
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

*Last Updated: 2026-04-01 (v0.4.14 — post-merge audit, 10 new bugs added)*
*Next Review: v0.5.0 release*
