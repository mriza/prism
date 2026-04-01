# PRISM Bug Report

> **Last Updated**: 2026-04-01 (v0.4.13 — audit corrections applied)
>
> **Purpose**: Active bug registry - only unfixed bugs listed here.
>
> **For Fixed Bugs**: See [IMPLEMENTED.md](./IMPLEMENTED.md)
> **For Test Results**: See [TESTING.md](./TESTING.md)

---

## Current Status

| Status | Count | Description |
|--------|-------|-------------|
| ✅ Fixed | 26 | 23 from v0.4.13 and earlier + BUG-014, BUG-015, BUG-018 |
| ❌ Active | 11 | Integration bugs + certificate placeholder |

**Summary**:
- **Total Bugs Tracked**: 37
- **Resolution Rate**: 70.3% (26/37)
- **Critical/High Priority**: 2 (BUG-016, BUG-017)
- **Medium/Low Priority**: 9

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

#### [BUG-016] RBACPage - Edit Permission Not Implemented
**Severity**: 🟠 HIGH | **Components**: Frontend | **Status**: ❌ NOT FIXED

**Location**: `frontend/src/pages/RBACPage.tsx:87`

**Issue**: Edit permission button shows TODO message.

**Impact**: Users cannot edit existing permissions, must delete and recreate.

**Fix Required**: Implement edit permission modal with update API call.

**Planned**: Short term (2 weeks)

---

#### [BUG-017] LogsTab - WebSocket Stream Not Implemented
**Severity**: 🟠 HIGH | **Components**: Frontend + Server + Agent | **Status**: ❌ NOT FIXED

**Location**: `frontend/src/components/services/LogsTab.tsx:47`

**Issue**: Logs tab uses mock data, WebSocket streaming not implemented.

**Impact**: Users cannot view real-time service logs.

**Fix Required**: Implement WebSocket connection for log streaming.

**Planned**: Short term (2 weeks)

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

**Impact**: Any request to `/api/certificates` endpoints that calls `getCertificateAuthority()` will cause a nil pointer dereference panic, crashing the server goroutine for that request.

**Additional**: `server/internal/security/certificates.go:528,534` also contains placeholder comments for certificate operations.

**Fix Required**:
- Initialize `CertificateAuthority` at server startup (in `cmd/server/main.go`)
- Store the CA instance in server context or as a package-level singleton
- Pass it to the certificate API handlers (or retrieve from context)
- Add nil-check guard in `getCertificateAuthority()` as a safety fallback

**Planned**: Short term (v0.5.0)

---

#### [BUG-019] Console.log in Production Code
**Severity**: 🟡 MEDIUM | **Components**: Frontend | **Status**: ❌ NOT FIXED

**Location**: 22 occurrences across codebase

**Issue**: Console.log statements left in production code.

**Fix Required**: Remove all console.log, implement proper logging service.

**Planned**: Medium term (v0.5.0)

---

#### [BUG-020] Error Handling - Silent Failures
**Severity**: 🟡 MEDIUM | **Components**: Frontend | **Status**: ❌ NOT FIXED

**Issue**: Many catch blocks only log error, no user feedback.

**Fix Required**: Add user-facing error messages and retry logic.

**Planned**: Medium term (v0.5.0)

---

#### [BUG-021] ProcessDiscoveryModal - No Error Feedback
**Severity**: 🟡 MEDIUM | **Components**: Frontend | **Status**: ❌ NOT FIXED

**Issue**: Process discovery failures not shown to user.

**Fix Required**: Add error state and retry button to modal.

**Planned**: Medium term (v0.5.0)

---

#### [BUG-022] AgentsContext - Polling Fallback Without Warning
**Severity**: 🟡 MEDIUM | **Components**: Frontend | **Status**: ❌ NOT FIXED

**Issue**: WebSocket fallback to polling happens silently.

**Fix Required**: Add visual indicator when WebSocket disconnected.

**Planned**: Medium term (v0.5.0)

---

### 🟢 LOW Priority

#### [BUG-006] Pending Agent Notification Badge
**Severity**: 🟢 LOW | **Components**: Frontend | **Status**: ❌ NOT FIXED

**Issue**: Admin dashboard doesn't show badge count for agents awaiting approval.

**Fix Required**: Add badge to "Servers" menu item showing pending count.

**Planned**: v0.5.0 (low priority)

---

#### [BUG-023] ProfileModal - Password Change Error Messages
**Severity**: 🟢 LOW | **Components**: Frontend | **Status**: ❌ NOT FIXED

**Issue**: Generic error messages for password change failures.

**Fix Required**: Add specific error messages and password requirements.

**Planned**: v0.5.0

---

#### [BUG-024] Service Managers - Inconsistent Error Messages
**Severity**: 🟢 LOW | **Components**: Frontend | **Status**: ❌ NOT FIXED

**Issue**: Generic "Failed to load settings" for all errors.

**Fix Required**: Add specific error messages per error type.

**Planned**: v0.5.0

---

#### [BUG-025] Missing Loading States
**Severity**: 🟢 LOW | **Components**: Frontend | **Status**: ❌ NOT FIXED

**Issue**: Some operations don't show loading state.

**Fix Required**: Add loading state to all async operations.

**Planned**: v0.5.0

---

## Recently Fixed (v0.4.13)

### ✅ BUG-013: Project Color Display - Duplicate Colors
**Severity**: 🟢 LOW | **Status**: ✅ FIXED (v0.4.13)

**Solution**: Reduced color palette from 8 to 6 truly distinct colors.

**Color Mapping** (6 distinct colors):
- **primary** → Blue (token.colorPrimary)
- **secondary** → Purple (token.colorLink)
- **success** → Green (token.colorSuccess)
- **warning** → Orange (token.colorWarning)
- **error** → Red (token.colorError)
- **neutral** → Gray (token.colorTextSecondary)

**Removed Colors**:
- ~~accent~~ (duplicate of warning)
- ~~info~~ (duplicate of primary)

**Files Fixed**:
- `frontend/src/types/index.ts` - Reduced PROJECT_COLORS to 6
- `frontend/src/pages/ProjectsPage.tsx` - Updated color mapping
- `frontend/src/pages/DashboardPage.tsx` - Updated color mapping

**Result**: Each project color now displays with a truly distinct visual color!

---

### ✅ BUG-012: Widespread Hardcoded Styles Violation
**Severity**: 🟡 MEDIUM | **Status**: ✅ COMPLETE (v0.4.13)

**Result**: All 1,433+ hardcoded style violations fixed across 60+ files!

**Impact**:
- ✅ Consistent design system usage across ENTIRE codebase
- ✅ Dark mode 100% ready
- ✅ Theme customization effortless
- ✅ Code maintainability maximized
- ✅ Build successful - All tests passing

**Files Fixed**: 60+ files (100% complete)

---

## Bug Index by Status

| Component | Active | Fixed | Total |
|-----------|--------|-------|-------|
| Frontend | 12 | 22 | 34 |
| Server | 2 | 1 | 3 |
| **Total** | **14** | **23** | **37** |

---

## Quick Reference

**Active Bugs (11)**:
- 🟠 BUG-016 - RBACPage edit permission not implemented
- 🟠 BUG-017 - LogsTab uses mock data, WebSocket streaming missing
- 🟡 BUG-019 - console.log in production code (8 occurrences)
- 🟡 BUG-020 - Silent error failures, no user-facing feedback
- 🟡 BUG-021 - ProcessDiscoveryModal no error feedback
- 🟡 BUG-022 - AgentsContext polling fallback without visual indicator
- 🟡 BUG-026 - getCertificateAuthority() returns nil (potential panic)
- 🟢 BUG-006 - Pending agent notification badge missing
- 🟢 BUG-023 - ProfileModal generic password change error messages
- 🟢 BUG-024 - Service managers inconsistent error messages
- 🟢 BUG-025 - Missing loading states in some async operations

**Recently Fixed**:
- ✅ BUG-014 - ServiceDetailModal account management callbacks
- ✅ BUG-015 - ConfigurationTab config save via service_get/update_config
- ✅ BUG-018 - sqlite.go account config JSON serialization
- ✅ BUG-013 - Project color display duplicate colors (v0.4.13)
- ✅ BUG-012 - Hardcoded styles 100% COMPLETE (v0.4.13)

**For Implementation Details**: See [IMPLEMENTED.md](./IMPLEMENTED.md)
**For Test Results**: See [TESTING.md](./TESTING.md)
**For Development Roadmap**: See [TODO.md](./TODO.md)

---

*Last Updated: 2026-04-01 (v0.4.13 — audit corrections applied)*
*Next Review: v0.5.0 release*
