# PRISM Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [v0.4.10] - 2026-04-01

### Fixed
- **BUG-012**: Project color display - Fixed color mapping in ProjectFormModal
  - Mapped color names to Ant Design token values
  - Consistent color rendering across all project views

### Changed
- Updated version to v0.4.10
- Updated README.md with latest fixes

---

## [v0.4.9] - 2026-04-01

### Added
- **User Password Change (Self-Service)**: Users can change their own password
  - Requires current password verification
  - Password strength validation (min 8 characters)
  - Force re-login after successful change
  - Endpoint: `POST /api/users/me/change-password`
  
- **Admin Password Reset**: Admins can reset other users' passwords
  - Admin-only access (enforced by middleware)
  - No current password required
  - Endpoint: `POST /api/users/:id/reset-password`

### Changed
- Added "Change Password" button to ProfileModal
- Added "Reset Password" action to UsersPage
- Updated BUG.md, TODO.md, README.md

### Security
- All passwords hashed with bcrypt
- Password strength validation enforced
- Force re-login after password change

---

## [v0.4.8] - 2026-04-01

### Added
- **User Profile Menu Relocation**: Moved from top-right to bottom-left sidebar
  - Split bottom sidebar: user profile dropdown + logout button
  - User profile dropdown includes: My Profile, Settings, Sign Out
  - Hover effect on user profile section

### Changed
- Removed user dropdown from AppLayout header
- Added user profile section to Sidebar bottom
- Updated ProfileModal integration

---

## [v0.4.7] - 2026-04-01

### Added
- **Legacy API Deprecation Warnings** (BUG-008 Phase 1)
  - Added deprecation comments to LegacyAgent model
  - Added `X-API-Deprecation-Warning` headers to `/api/agents` responses
  - Added `X-API-Sunset: 2026-12-31` header
  - Created MIGRATION_GUIDE.md

### Changed
- Updated all `/api/agents` endpoints with deprecation warnings
- Documented migration timeline (v0.5 → v0.6 → v1.0)

### Deprecated
- `/api/agents` endpoints (use `/api/servers` instead)
- `LegacyAgent` model (use `Server` model)

---

## [v0.4.6] - 2026-04-01

### Added
- **Process Discovery Modal Integration** (BUG-011)
  - Integrated existing ProcessDiscoveryModal with ProcessesPage
  - Added modal state management
  - Auto-refresh after process registration

### Changed
- Replaced console.log TODO with actual modal integration
- Added ProcessDiscoveryModal import to ProcessesPage

---

## [v0.4.5] - 2026-04-01

### Added
- **RBAC Permission Creation** (BUG-010)
  - Created `usePermissions` hook with full CRUD
  - Integrated with RBACPage
  - Added error handling

### Changed
- Replaced console.log mockup with real API calls
- Added permission refresh after creation

---

## [v0.4.4] - 2026-04-01

### Added
- **Frontend Audit Report** (FRONTEND_AUDIT.md)
  - Comprehensive audit of frontend implementation
  - Identified mockups and placeholders
  - Implementation status: 87%

### Changed
- Updated BUG.md with audit findings
- Updated TODO.md with priorities

---

## [v0.4.3] - 2026-04-01

### Fixed
- **BUG-003**: RabbitMQ binding sync silent fail
  - Added error handling for each RabbitMQ operation
  - Set `X-RabbitMQ-Warning` header when sync fails
  
- **BUG-004**: PM2 proxy error handling
  - Added error handling that returns HTTP 500
  
- **BUG-005**: FTP service type mapping
  - Replaced string manipulation with explicit mapping

### Changed
- Updated accounts.go POST and PUT handlers
- Added bug_fixes_test.go

---

## [v0.4.2] - 2026-04-01

### Fixed
- **BUG-001**: Add Database to Existing Account
  - Server-side diff logic implemented
  - Creates new databases automatically
  - Updates user privileges

### Changed
- Updated accounts.go PUT handler
- Added database diff logic

---

## [v0.4.1] - 2026-04-01

### Fixed
- **Valkey Account Provisioning** (All 3 subtypes)
  - Extended agent switch case for valkey-cache, valkey-broker, valkey-nosql
  - Added `normalizeServiceName()` helper
  - Frontend form fields by subtype
  
- **Primary Database Field**
  - Auto-set `database = databases[0]`
  - Connection strings now include database name

### Changed
- Updated agent/cmd/agent/main.go
- Updated server/internal/api/accounts.go
- Updated frontend AccountFormModal.tsx

---

## [v0.4.0] - 2026-04-01

### Added
- Valkey service expansion (Cache, Pub/Sub, NoSQL)
- Test suite implementation (76 tests)
- Comprehensive documentation

### Changed
- Migrated to v0.4.x versioning scheme
- Updated all documentation

---

## [v4.4.1] - 2026-04-01

### Fixed
- WebSocket reconnection exponential backoff
- Runtime detection symlink resolution
- Ant Design deprecation fixes
- TypeScript strict mode cleanup

---

## [v4.4.0] - 2026-04-01

### Added
- Valkey service expansion
- Fix dropdown duplication bug
- Refined account provisioning logic

---

*For older changelog entries, see git history.*

---

[v0.4.10]: https://github.com/ORG/prism/compare/v0.4.9...v0.4.10
[v0.4.9]: https://github.com/ORG/prism/compare/v0.4.8...v0.4.9
[v0.4.8]: https://github.com/ORG/prism/compare/v0.4.7...v0.4.8
[v0.4.7]: https://github.com/ORG/prism/compare/v0.4.6...v0.4.7
[v0.4.6]: https://github.com/ORG/prism/compare/v0.4.5...v0.4.6
[v0.4.5]: https://github.com/ORG/prism/compare/v0.4.4...v0.4.5
[v0.4.4]: https://github.com/ORG/prism/compare/v0.4.3...v0.4.4
[v0.4.3]: https://github.com/ORG/prism/compare/v0.4.2...v0.4.3
[v0.4.2]: https://github.com/ORG/prism/compare/v0.4.1...v0.4.2
[v0.4.1]: https://github.com/ORG/prism/compare/v0.4.0...v0.4.1
[v0.4.0]: https://github.com/ORG/prism/compare/v4.4.1...v0.4.0
