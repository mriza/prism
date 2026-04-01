# PRISM Frontend Audit Report

> **Audit Date**: 2026-04-01
> **Version**: v0.4.4
> **Purpose**: Identify mockups, placeholders, and incomplete implementations in frontend

---

## Executive Summary

**Total Pages**: 15  
**Fully Implemented**: 12 (80%)  
**Partial Implementation**: 2 (13%)  
**Mockup/Placeholder**: 1 (7%)

---

## Pages Status

### ✅ Fully Implemented (Real API Integration)

| Page | Component | API Integration | Status |
|------|-----------|-----------------|--------|
| `DashboardPage` | Dashboard | `/api/accounts`, `/api/servers`, `/api/deployments` | ✅ Complete |
| `ProjectsPage` | Projects | `/api/projects` | ✅ Complete |
| `ProjectDetailPage` | Project Detail + Accounts | `/api/projects/:id`, `/api/accounts` | ✅ Complete |
| `AccountsPage` | Accounts | `/api/accounts` | ✅ Complete |
| `DeploymentsPage` | Deployments | `/api/deployments` | ✅ Complete |
| `ServersPage` | Servers/Agents | `/api/servers`, `/api/agents` | ✅ Complete |
| `ProcessesPage` | Process Management | `/api/control` (partial TODO) | ⚠️ Partial |
| `SecurityPage` | Firewall/CrowdSec | `/api/control` | ✅ Complete |
| `LogsPage` | Activity Logs | `/api/logs` | ✅ Complete |
| `UsersPage` | User Management | `/api/users` | ✅ Complete |
| `HealthDashboardPage` | Health Checks | `/health/full` | ✅ Complete |
| `SettingsPage` | System Settings | AppConfig Context | ✅ Complete |

### ⚠️ Partial Implementation

| Page | Issue | Status |
|------|-------|--------|
| `ProcessesPage` | Process discovery modal not implemented (line 291-292) | ⚠️ TODO exists |
| `RBACPage` | Permission CRUD form uses console.log + demo message | ❌ Mockup |

### ❌ Mockup/Placeholder

| Page | Component | Issue | Severity |
|------|-----------|-------|----------|
| `RBACPage` | Create Permission Modal | Form submission only logs to console and shows "Permission created (demo)" message | 🔴 HIGH |

---

## Detailed Findings

### [CRITICAL] RBACPage - Permission Creation Mockup

**File**: `frontend/src/pages/RBACPage.tsx`  
**Lines**: 176-178

```tsx
onFinish={(values) => {
    console.log('Create permission:', values);
    message.success('Permission created (demo)');
    setIsModalOpen(false);
}}
```

**Issue**: Permission creation form doesn't actually call API - only logs to console.

**Impact**: Users cannot create RBAC permissions despite UI being present.

**Backend Status**: API endpoint exists (`/api/permissions` in `v42.go`)

**Fix Required**: 
1. Add API call to `onFinish` handler
2. Implement permission refresh after creation
3. Add error handling

---

### [MEDIUM] ProcessesPage - Discovery Modal TODO

**File**: `frontend/src/pages/ProcessesPage.tsx`  
**Lines**: 291-292

```tsx
// TODO: Open discovery modal if needed
console.log("Setting discovery agent", agent.id);
```

**Issue**: Process discovery modal not implemented.

**Impact**: Users cannot trigger service discovery from UI.

**Backend Status**: Agent discovery functionality exists

**Fix Required**:
1. Create `ProcessDiscoveryModal` component
2. Implement discovery trigger API call
3. Add modal integration

---

## Hooks Audit

### ✅ Fully Implemented Hooks

| Hook | API Calls | Status |
|------|-----------|--------|
| `useAccounts` | `/api/accounts` (CRUD + bulk operations) | ✅ Complete |
| `useAgents` | `/api/agents`, `/api/control` | ✅ Complete |
| `useDeployments` | `/api/deployments` | ✅ Complete |
| `useProjects` | `/api/projects` | ✅ Complete |
| `useUsers` | `/api/users` | ✅ Complete |
| `useManagementCredentials` | `/api/management-credentials` | ✅ Complete |
| `useWebSocketAgents` | WebSocket `/ws/agents` | ✅ Complete |

**Note**: All hooks have proper API integration, no mock data found.

---

## Contexts Audit

### ✅ All Contexts Implemented

| Context | Purpose | Status |
|---------|---------|--------|
| `AuthContext` | Authentication & JWT | ✅ Complete |
| `AgentsContext` | Agent state management | ✅ Complete |
| `AppConfigContext` | App configuration | ✅ Complete |

---

## Components Audit

### Modals with Full Implementation

- ✅ `AccountFormModal` - Dynamic form with Valkey subtypes
- ✅ `DeploymentFormModal` - Git deployment form
- ✅ `FirewallModal` - Firewall rule management
- ✅ `CrowdSecModal` - CrowdSec ban management
- ✅ `ApproveServerModal` - Agent approval
- ✅ `ServiceDetailModal` - Service details
- ✅ `ServerSettingsModal` - Server configuration
- ✅ `ProjectFormModal` - Project CRUD
- ✅ `UserFormModal` - User management
- ✅ `ProfileModal` - User profile
- ✅ `ProcessDiscoveryModal` - Process discovery
- ⚠️ `AddDatabaseModal` - Add database to existing account (NEW v0.4.4)

---

## API Endpoints Coverage

### Implemented Endpoints

| Endpoint | Frontend Usage | Status |
|----------|----------------|--------|
| `/api/auth/login` | LoginPage | ✅ Used |
| `/api/accounts` | AccountsPage, ProjectDetailPage | ✅ Used |
| `/api/projects` | ProjectsPage, ProjectDetailPage | ✅ Used |
| `/api/deployments` | DeploymentsPage | ✅ Used |
| `/api/servers` | ServersPage | ✅ Used |
| `/api/agents` | ServersPage, useAgents | ✅ Used |
| `/api/users` | UsersPage | ✅ Used |
| `/api/logs` | LogsPage | ✅ Used |
| `/api/management-credentials` | (Hook exists, page TBD) | ⚠️ Partial |
| `/api/permissions` | RBACPage | ⚠️ Read-only (Create is mockup) |
| `/api/settings` | SettingsPage | ✅ Used (via context) |
| `/health/full` | HealthDashboardPage | ✅ Used |
| `/api/control` | SecurityPage, ProcessesPage | ✅ Used |
| `/ws/agents` | useWebSocketAgents | ✅ Used |

---

## Recommendations

### Immediate Actions (v0.5.0)

1. **Fix RBACPage Permission Creation** ✅ COMPLETED v0.4.5
   - ✅ Replaced console.log with actual API call
   - ✅ Created `usePermissions` hook
   - ✅ Implemented permission creation with error handling

2. **Implement Process Discovery Modal** ✅ COMPLETED v0.4.6
   - ✅ Integrated existing `ProcessDiscoveryModal` component
   - ✅ Added modal state management
   - ✅ Auto-refresh after process registration

### User-Requested Features (v0.5.0)

1. **User Password Change (Self-Service)**
   - Allow users to change their own password
   - Add "Change Password" in user profile menu
   - Validate current password before update

2. **Admin Change User Password**
   - Allow admins to reset other users' passwords
   - Add "Reset Password" action in UsersPage
   - No current password required for admin

3. **User Profile Menu Relocation**
   - Move from top-right to bottom-left sidebar
   - Split logout area: user icon + logout button
   - User icon click opens profile menu

### Future Enhancements

1. **Management Credentials Page**
   - Hook exists but no dedicated page
   - Consider adding management credentials UI

2. **RBAC Full Implementation**
   - Role assignment UI
   - Permission grouping
   - Server group access control

---

## Test Coverage

| Component | Test Files | Status |
|-----------|------------|--------|
| Pages | `ServersPage.test.tsx` | ✅ Basic tests |
| Modals | `AccountFormModal.test.tsx` | ⚠️ Partial (broken) |
| Hooks | `useAccounts.test.tsx.bak`, `useAgents.test.tsx.bak` | ❌ Broken (TypeScript errors) |

**Note**: Test files temporarily disabled due to TypeScript compilation errors (see BUG-009).

---

## Conclusion

**Overall Frontend Status**: 90% Implemented (↑ from 88%)

- Most pages have full API integration
- ✅ RBAC permission creation fixed (v0.4.5)
- ✅ Process discovery modal integrated (v0.4.6)
- All hooks properly implemented
- 3 user-requested features added to backlog
- Test coverage needs improvement

**Priority Fixes**:
1. 🟡 Frontend test files TypeScript errors (BUG-009)
2. 🟢 User-requested features (password change, UI relocation)
3. 🔵 Technical debt (legacy table unification - BUG-008)

---

*Audit conducted: 2026-04-01*
*Last update: v0.4.6 - Process Discovery Modal integrated*
*Next audit: v0.5.0*
