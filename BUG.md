# PRISM Bug Report

> **Last Updated**: 2026-04-02 (v0.4.24 — All bugs fixed, 100% resolution rate)
>
> **Purpose**: Active bug registry for PRISM project
>
> **Related Documents**:
> - [TODO.md](./TODO.md) - Development roadmap
> - [IMPLEMENTED.md](./IMPLEMENTED.md) - Implemented features

---

## Current Status

| Status | Count | Description |
|--------|-------|-------------|
| ✅ Fixed | 61 | ALL BUGS FIXED! |
| ❌ Active | 0 | Zero! Clean codebase! |

**Summary**:
- **Total Bugs Tracked**: 61
- **Resolution Rate**: 100% (61/61) 🏆
- **Critical/High Priority**: 0 (All resolved)
- **Medium Priority**: 0 (All resolved)
- **Low Priority**: 0 (All resolved)

---

## Active Bugs

**NONE! All bugs have been fixed!** 🎉

All future issues will be tracked as they are discovered.

---

## Code Audit Tasks (v0.5.0)

**🔍 Find and Eliminate Duplicate/Redundant Functions**

**Status**: 🟡 PENDING AUDIT | **Priority**: Medium | **Target**: v0.5.0

**Description**: 
Audit entire codebase to find duplicate or redundant functions, then consolidate them following DRY principles.

**⚠️ IMPORTANT: Distinguish Between:**

1. **❌ Actual Duplicates** (Remove/Consolidate):
   - Same function logic in multiple places
   - Copy-paste code blocks
   - Two functions with different names but same implementation
   - Overlapping API endpoints

2. **✅ Intentional Entry Points** (Keep):
   - Multiple buttons/links opening same modal
   - Multiple menu items navigating to same page
   - Different routes rendering same component
   - Wrapper functions for backward compatibility
   - Aliased exports for convenience

**Audit Areas:**

### Frontend (React/TypeScript)

- [ ] Search for duplicate event handlers
- [ ] Find duplicate API calls (fetch/axios)
- [ ] Identify duplicate utility functions
- [ ] Check for duplicate form submissions
- [ ] Find duplicate components
- [ ] Identify duplicate modals (same modal, different trigger)

**Commands:**
```bash
# Find duplicate function names
grep -rn "const.*=.*(" frontend/src/ | grep -v node_modules | cut -d'=' -f1 | sort | uniq -d

# Find duplicate API calls
grep -rn "fetch\|axios" frontend/src/ | grep -v node_modules

# Find large components (>200 lines)
find frontend/src -name "*.tsx" -exec awk 'END{print FILENAME, NR}' {} \; | sort -k2 -rn | head -20
```

### Backend - Server (Go)

- [ ] Search for duplicate database queries
- [ ] Find duplicate API handlers
- [ ] Identify duplicate business logic
- [ ] Check for duplicate validation
- [ ] Find duplicate utility functions
- [ ] Identify duplicate middleware

**Commands:**
```bash
# Find duplicate function names
grep -rn "^func " server/ | cut -d'(' -f1 | sort | uniq -d

# Find duplicate API routes
grep -rn "http.HandleFunc" server/cmd/server/ | awk '{print $2}' | sort | uniq -d

# Find large functions (>50 lines)
find server -name "*.go" -exec awk '/^func /{func=$0; start=NR} /^}$/{if(NR-start>50) print FILENAME": "func, "lines:", NR-start}' {} \;
```

### Backend - Agent (Go)

- [ ] Search for duplicate module functions
- [ ] Find duplicate command handlers
- [ ] Identify duplicate service discovery logic
- [ ] Check for duplicate configuration loading

**Commands:**
```bash
# Same as Server commands above, but for agent/ directory
```

### Database Layer

- [ ] Find duplicate queries
- [ ] Identify duplicate models
- [ ] Check for duplicate migrations
- [ ] Find duplicate helper functions

---

**Documentation Process:**

For each duplicate found:

1. **Create Bug Report** in BUG.md:
   ```markdown
   #### [BUG-XXX] Duplicate Function: [Function Name]
   **Severity**: 🟡 MEDIUM | **Components**: [Frontend/Server/Agent]
   **Locations**: 
   - File1.tsx:line1
   - File2.tsx:line2
   **Recommendation**: Consolidate into [primary location]
   **Entry Points**: [List intentional links/buttons - DO NOT REMOVE]
   ```

2. **Document**:
   - Location of ALL duplicates
   - Which one to keep as primary
   - Migration path (update imports, update tests)
   - Intentional entry points (preserve these!)

3. **Priority Classification**:
   - 🔴 **Critical**: Duplicate business logic (data inconsistency risk)
   - 🟠 **High**: Duplicate API endpoints (confusing for consumers)
   - 🟡 **Medium**: Duplicate utility functions (maintenance overhead)
   - 🟢 **Low**: Duplicate UI components (cosmetic only)

---

**Examples:**

**❌ BAD - Actual Duplicate (Remove):**
```go
// server/internal/api/users.go
func GetUserByID(id string) (*User, error) {
    // ... 20 lines of logic
}

// server/internal/api/accounts.go  
func GetUserByID(id string) (*User, error) {
    // ... EXACT SAME 20 lines of logic
}
// ACTION: Consolidate into shared package
```

**✅ GOOD - Intentional Entry Point (Keep):**
```tsx
// Multiple buttons, same handler - this is FINE!
<Button onClick={handleDelete}>Delete</Button>
<MenuItem onClick={handleDelete}>Delete Account</MenuItem>
<IconButton icon={<DeleteOutlined />} onClick={handleDelete} />
// All call same handleDelete() - no duplication!
```

---

**Target Completion**: v0.5.0
**Estimated Effort**: 2-3 weeks for audit, 4-6 weeks for consolidation
**Risk**: Low (if intentional entry points are preserved)

---

## Recently Fixed

### v0.4.24 - DevOps Automation (2026-04-02)
- ✅ Service Activity Logs tab verified functional
- ✅ GitHub Release Script created
- ✅ Deployment Script created

### v0.4.23 - Error Handling & Type Safety (2026-04-02)
- ✅ BUG-019: Removed last console.error from production code
- ✅ BUG-033: Fixed loose any[] typing with proper interfaces
- ✅ BUG-020: Verified error handling in all hooks
- ✅ BUG-021: Verified ProcessDiscoveryModal error feedback
- ✅ BUG-023: Verified password change error messages
- ✅ BUG-024: Verified service managers error messages
- ✅ BUG-025: Verified loading states

### v0.4.22 - Font Weight/Size Standardization (2026-04-02)
- ✅ BUG-044: Fixed 36 hardcoded fontWeight/fontSize instances

---

## Historical Bug Summary (v0.4.14 - v0.4.21)

### v0.4.21 - Font Weight Standardization
- ✅ Fixed 26 hardcoded fontWeight instances across 6 pages
- ✅ LoginPage, DashboardPage, SecurityPage, ProjectDetailPage, ServersPage, UsersPage

### v0.4.20 - Font Size Improvements
- ✅ Increased fontSizeSM → fontSize in 7 pages + 2 modals

### v0.4.19 - Hardcoded Styles Cleanup
- ✅ Removed unnecessary inline styles from ApplicationsPage

### v0.4.17 - ALL ORIGINAL BUGS FIXED
- ✅ BUG-001 to BUG-050 - All resolved!
- ✅ 100% bug resolution rate achieved

---

## Bug Index by Component

| Component | Active | Fixed | Total |
|-----------|--------|-------|-------|
| Frontend  | 0      | 52    | 52    |
| Server    | 0      | 7     | 7     |
| Agent     | 0      | 2     | 2     |
| **Total** | **0**  | **61**| **61**|

---

## Quick Reference

**All bugs resolved!** Future issues will be tracked here as they are discovered.

For implementation details, see [IMPLEMENTED.md](./IMPLEMENTED.md)

For upcoming features, see [TODO.md](./TODO.md)
