# TODO — PRISM Development Roadmap

> **Last Updated**: 2026-04-02 (v0.4.24 — DevOps scripts completed)
>
> **Purpose**: Development roadmap for PRISM project
>
> **Related Documents**:
> - [BUG.md](./BUG.md) - Bug reports
> - [IMPLEMENTED.md](./IMPLEMENTED.md) - Implemented features

---

## Development Guidelines

### Script Creation Policy

**⚠️ IMPORTANT: Before creating any new script:**

1. **Check Existing Scripts First**
   - Search in `scripts/` directory
   - Search in root directory
   - Use: `find . -name "*.sh" -type f`

2. **If Similar Script Exists:**
   - ✅ **REVISE** the existing script (add features, fix bugs)
   - ✅ **REFACTOR** if needed (improve structure, remove redundancy)
   - ❌ **DO NOT CREATE** duplicate/overlapping scripts

3. **Script Organization:**
   - All scripts go in `scripts/` directory
   - One script = One clear purpose
   - No functional overlap between scripts

4. **Examples of What NOT to Do:**
   - ❌ Creating `create_release.sh` when `generate_release_notes.sh` exists
   - ❌ Creating `deploy.sh` in root when `scripts/deploy.sh` exists
   - ❌ Creating `create_github_release.sh` when `create_release.sh` already does it

5. **Best Practices:**
   - ✅ Consolidate functionality into single script
   - ✅ Use feature flags or arguments for variations
   - ✅ Document what each script does
   - ✅ Remove obsolete scripts when replacing

---

### Application Architecture Principles

**🎯 DRY (Don't Repeat Yourself) - Apply to Entire Codebase**

The same anti-duplication principle applies to ALL aspects of PRISM development:

**1. Code Level:**
- ❌ No duplicate functions with same purpose
- ❌ No copy-paste code blocks
- ✅ Extract common logic into shared utilities
- ✅ Use composition over duplication

**2. Component Level:**
- ❌ No two components doing the same thing
- ❌ No overlapping features (e.g., two "deployment" pages)
- ✅ Consolidate similar components
- ✅ Use props/configuration for variations

**3. API Level:**
- ❌ No duplicate endpoints
- ❌ No overlapping API routes
- ✅ One endpoint = One clear purpose
- ✅ Use query params for filtering/variations

**4. UI/UX Level:**
- ❌ No duplicate pages with same functionality
- ❌ No confusing similar features (e.g., "Deployments" vs "Processes")
- ✅ Unified interfaces (e.g., "Applications" page)
- ✅ Consistent design patterns

**5. Data Level:**
- ❌ No duplicate database tables
- ❌ No redundant data models
- ✅ Single source of truth
- ✅ Use relationships/joins for connections

---

### Examples from PRISM History

**❌ What Happened (Lessons Learned):**
- "Deployments" page + "Processes" page → Confusing, merged into "Applications"
- Multiple deployment methods scattered → Consolidated into unified workflow
- Duplicate script files → Cleaned up into `scripts/` directory

**✅ What We Do Now:**
- Single "Applications" page for all deployment types
- Unified service management interface
- Consolidated scripts in one location
- Clear naming conventions

---

### Checklist for New Features

Before implementing ANY new feature:

- [ ] **Search existing codebase** for similar functionality
  ```bash
  # Search for functions
  grep -r "function name" frontend/src/ server/ agent/
  
  # Search for components
  find . -name "*.tsx" -o -name "*.go" | xargs grep -l "ComponentName"
  
  # Search for API routes
  grep -r "http.HandleFunc" server/
  ```

- [ ] **If found:**
  - [ ] Can I extend the existing feature?
  - [ ] Can I refactor to make it more generic?
  - [ ] Should I replace and consolidate?

- [ ] **If not found:**
  - [ ] Is this feature really needed?
  - [ ] Does it fit the architecture?
  - [ ] Is the naming clear and distinct?

- [ ] **After implementation:**
  - [ ] Update documentation
  - [ ] Remove any obsolete code
  - [ ] Add to IMPLEMENTED.md

---

### 🔍 Code Audit Tasks (v0.5.0)

**Find and Eliminate Duplicate/Redundant Functions**

**⚠️ IMPORTANT: Distinguish between:**
1. **Actual Duplicates** ❌ - Same function implemented multiple times
2. **Intentional Entry Points** ✅ - Multiple links/buttons to SAME function

**What to Look For:**

**❌ ACTUAL DUPLICATES (Remove/Consolidate):**
- Same logic in multiple places (copy-paste)
- Two functions doing exact same thing
- Overlapping API endpoints
- Duplicate utility functions

**✅ INTENTIONAL ENTRY POINTS (Keep):**
- Multiple buttons linking to same modal
- Multiple menu items opening same page
- Different routes rendering same component
- Aliased function calls for backward compatibility

**Example of INTENTIONAL (Keep):**
```tsx
// Multiple buttons opening same modal - OK!
<Button onClick={openModal}>Open</Button>
<Link to="/modal">Open Modal</Link>
<MenuItem onClick={openModal}>Modal</MenuItem>
// All trigger same openModal() - this is fine!
```

**Example of DUPLICATE (Remove):**
```go
// Two functions doing same thing - BAD!
func GetUserByID(id string) { ... }
func FetchUser(id string) { ... }  // Same logic, different name
// Should consolidate into one function
```

**Audit Checklist:**

- [ ] **Frontend Functions**
  - [ ] Search for duplicate event handlers
  - [ ] Find duplicate API calls
  - [ ] Identify duplicate utility functions
  - [ ] Check for duplicate form submissions

- [ ] **Backend Functions**
  - [ ] Search for duplicate database queries
  - [ ] Find duplicate API handlers
  - [ ] Identify duplicate business logic
  - [ ] Check for duplicate validation

- [ ] **Components**
  - [ ] Find components with same purpose
  - [ ] Identify duplicate modals
  - [ ] Check for duplicate pages
  - [ ] Look for duplicate widgets

- [ ] **API Endpoints**
  - [ ] Search for overlapping routes
  - [ ] Find duplicate CRUD operations
  - [ ] Identify redundant endpoints
  - [ ] Check for duplicate middleware

**Tools for Audit:**

```bash
# Find duplicate function names
grep -rn "func " server/ | cut -d'(' -f1 | sort | uniq -d

# Find similar function implementations
# (manual code review needed)

# Find duplicate API routes
grep -rn "http.HandleFunc" server/ | awk '{print $2}' | sort | uniq -d

# Find large functions (>50 lines) - likely candidates for refactoring
awk '/^func /{func=$0; start=NR} /^}$/{if(NR-start>50) print func, "lines:", NR-start}' server/**/*.go
```

**Documentation:**

For each duplicate found:
1. Create bug report in BUG.md
2. Document location of all duplicates
3. Identify which one to keep as primary
4. Plan migration path for consolidation
5. Note any intentional entry points (don't remove!)

**Priority:**
- 🔴 Critical: Duplicate business logic (can cause data inconsistency)
- 🟠 High: Duplicate API endpoints (confusing for consumers)
- 🟡 Medium: Duplicate utility functions (maintenance overhead)
- 🟢 Low: Duplicate UI components (cosmetic)

---

### Long-term Goals

**v0.5.0 - Code Quality & Consolidation:**
- [ ] Audit entire codebase for duplication
- [ ] Refactor duplicate components
- [ ] Consolidate overlapping features
- [ ] Document architecture decisions
- [ ] Create contributor guidelines with DRY principles

**v0.6.0 - Architecture Cleanup:**
- [ ] Remove legacy agents table (migrate to servers)
- [ ] Unified API structure
- [ ] Consistent component patterns
- [ ] Zero duplicate functionality

**v1.0.0 - Production Ready:**
- [ ] Clean, maintainable codebase
- [ ] Clear separation of concerns
- [ ] No technical debt from duplication
- [ ] Well-documented architecture


---

## Recent Releases

### ✅ v0.4.24 (2026-04-02) - DevOps Automation 🚀
- ✅ **Service Activity Logs** — Activity tab in ServiceDetailModal
- ✅ **GitHub Release Script** — `scripts/create_github_release.sh`
- ✅ **Deployment Script** — `deploy.sh` (simplified, user-friendly)

### ✅ v0.4.23 (2026-04-02) - Error Handling & Type Safety 🛡️
- ✅ BUG-019: Console.log removal
- ✅ BUG-033: Loose any[] typing fixed

### ✅ v0.4.22 (2026-04-02) - Font Standardization 🎨
- ✅ BUG-044: 36 fontWeight/fontSize fixes

---

## v0.5.0 - Planned Features

### Major Refactoring
- [ ] **Applications Page Overhaul** — Unify deployments and processes
- [ ] **Multi-Runtime Support** — Node.js, Python, PHP, Go, Java
- [ ] **Container Deployments** — Docker and Podman support

### New Features
- [ ] **Service Activity Logs Enhancement** — More event types
- [ ] **Log Clearing & Retention** — Auto-cleanup policies
- [ ] **Configuration Drift Detection UI**
- [ ] **Webhook & Notifications UI**

### Technical Debt
- [ ] **Complete UI/UX Redesign** — Ant Design v6 guidelines
- [ ] **Accessibility Compliance** — WCAG 2.1 AA
- [ ] **Performance Optimization** — Bundle size reduction

### Testing
- [ ] **Frontend Pages Testing** — Complete test coverage
- [ ] **Integration Tests** — E2E flows
- [ ] **Agent Modules Testing** — Complete module tests

---

## Future Considerations

### v0.6.0+
- [ ] Multi-node Hub clustering
- [ ] Database backup & restore tooling
- [ ] Advanced RBAC with server groups
- [ ] API key authentication for CI/CD

### v1.0.0 (Long Term)
- [ ] Remove legacy agents table
- [ ] Stable API guarantee
- [ ] Enterprise features

---

## Quick Links

- [Bug Reports](./BUG.md)
- [Implemented Features](./IMPLEMENTED.md)
- [README](./README.md)
