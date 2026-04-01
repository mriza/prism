# PRISM Bug Report

> **Last Updated**: 2026-04-01 (v0.4.13)
>
> **Purpose**: Active bug registry - only unfixed bugs listed here.
>
> **For Fixed Bugs**: See [IMPLEMENTED.md](./IMPLEMENTED.md)
> **For Test Results**: See [TESTING.md](./TESTING.md)

---

## Current Status

| Status | Count | Description |
|--------|-------|-------------|
| ✅ Fixed | 23 | All bugs resolved in v0.4.13 and earlier |
| ❌ Active | 13 | New integration bugs discovered (2 critical, 3 high) |

**Summary**:
- **Total Bugs Tracked**: 36
- **Resolution Rate**: 63.9% (23/36)
- **Critical/High Priority**: 5 (needs immediate attention)
- **Medium/Low Priority**: 8

---

## Active Bugs

### 🔴 CRITICAL Priority

#### [BUG-014] ServiceDetailModal - Account Management Actions Not Implemented
**Severity**: 🔴 CRITICAL | **Components**: Frontend | **Status**: ❌ NOT FIXED

**Location**: `frontend/src/components/ServiceModal.tsx:276-278`

**Issue**: Account management callbacks are empty TODOs in service detail modal.

**Impact**:
- Users cannot create/edit/delete accounts from service detail view
- Critical workflow broken for service management

**Fix Required**:
- Implement onCreateAccount, onEditAccount, onDeleteAccount callbacks
- Navigate to AccountFormModal with pre-filled service info

**Planned**: Immediate (This week)

---

#### [BUG-015] ConfigurationTab - Configuration Update Not Implemented
**Severity**: 🔴 CRITICAL | **Components**: Frontend + Server + Agent | **Status**: ❌ NOT FIXED

**Location**: `frontend/src/components/services/ConfigurationTab.tsx:102`

**Issue**: Configuration save is console.log only, no API implementation.

**Impact**:
- Users cannot save service configurations
- Critical feature completely broken
- Data entered by users is lost

**Fix Required**:
- Add API endpoint: POST /api/control with configuration update action
- Implement server-side handler to forward to agent
- Implement agent-side configuration update

**Planned**: Immediate (This week)

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

#### [BUG-018] Server Database Configuration - TODO Comments
**Severity**: 🟠 HIGH | **Components**: Server | **Status**: ❌ NOT FIXED

**Location**: `server/internal/db/sqlite/sqlite.go:600,690`

**Issue**: Account configuration storage has TODO placeholders.

**Impact**: Account configurations not properly stored, potential data loss.

**Fix Required**: Implement config map to JSON conversion and parsing.

**Planned**: Short term (2 weeks)

---

### 🟡 MEDIUM Priority

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
| Frontend | 1 | 22 | 23 |
| Server | 0 | 1 | 1 |
| **Total** | **1** | **23** | **24** |

---

## Quick Reference

**Active Bugs**:
- ⚠️ BUG-006 - Pending agent notification badge - Low priority

**Recently Fixed (v0.4.13)**:
- ✅ BUG-013 - Project color display duplicate colors
- ✅ BUG-012 - Hardcoded styles (1,433+ violations) - 100% COMPLETE

**For Implementation Details**: See [IMPLEMENTED.md](./IMPLEMENTED.md)
**For Test Results**: See [TESTING.md](./TESTING.md)
**For Development Roadmap**: See [TODO.md](./TODO.md)

---

*Last Updated: 2026-04-01 (v0.4.13)*
*Next Review: v0.5.0 release*
