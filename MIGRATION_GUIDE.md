# PRISM Migration Guide: agents → servers

> **Version**: v0.4.6 (2026-04-01)  
> **Status**: Phase 1 - Deprecation Warnings  
> **Tracking**: BUG-008

---

## Overview

PRISM v4.x introduced a new `servers` table to replace the legacy `agents` table from v3.x. This guide helps you migrate from the legacy `agents` API to the new `servers` API.

**Timeline**:
- **v0.4.6** (Current): Deprecation warnings added
- **v0.6.0**: Data migration tools provided
- **v1.0.0**: Legacy `agents` table removed

---

## What's Changing

### Legacy API (Deprecated)

```
GET    /api/agents           - List all agents
POST   /api/agents/:id/approve  - Approve pending agent
DELETE /api/agents/:id      - Delete agent
```

### New API (Recommended)

```
GET    /api/servers          - List all servers
POST   /api/servers/:id/approve  - Approve pending server
DELETE /api/servers/:id     - Delete server
PUT    /api/servers/:id      - Update server details
```

---

## Breaking Changes

### Response Format Changes

**Legacy `/api/agents` Response**:
```json
{
  "id": "agent-1",
  "name": "Production Server",
  "hostname": "prod-01",
  "osInfo": "Ubuntu 22.04",
  "status": "approved",
  "lastSeen": "2026-04-01T00:00:00Z",
  "createdAt": "2026-01-01T00:00:00Z"
}
```

**New `/api/servers` Response**:
```json
{
  "id": "server-1",
  "name": "Production Server",
  "description": "Main production server",
  "hostname": "prod-01",
  "ipAddress": "192.168.1.100",
  "os": "linux",
  "osInfo": "Ubuntu 22.04",
  "status": "active",
  "agentVersion": "v0.4.6",
  "lastHeartbeat": "2026-04-01T00:00:00Z",
  "runtimes": [
    { "name": "Node.js", "version": "20.5.0", "path": "/usr/bin/node" }
  ],
  "createdAt": "2026-01-01T00:00:00Z",
  "updatedAt": "2026-04-01T00:00:00Z"
}
```

### Key Differences

| Field | Legacy (`agents`) | New (`servers`) | Notes |
|-------|------------------|-----------------|-------|
| `id` | `agent-xxx` | `server-xxx` | Different prefix |
| `status` | `pending/approved/rejected` | `pending/approved/active/offline` | More granular |
| `osInfo` | ✅ | ✅ | Same |
| `description` | ✅ | ✅ | Same |
| `ipAddress` | ❌ | ✅ | New field |
| `runtimes` | ❌ | ✅ | New field |
| `agentVersion` | ❌ | ✅ | New field |
| `lastHeartbeat` | ❌ | ✅ | Replaces `lastSeen` |

---

## Migration Steps

### For API Consumers

#### Step 1: Update API Endpoints

**Before**:
```javascript
const response = await fetch('/api/agents', {
  headers: { 'Authorization': `Bearer ${token}` }
});
```

**After**:
```javascript
const response = await fetch('/api/servers', {
  headers: { 'Authorization': `Bearer ${token}` }
});
```

#### Step 2: Update Response Handling

**Before**:
```javascript
const agents = await response.json();
agents.forEach(agent => {
  console.log(`${agent.name} - ${agent.status}`);
});
```

**After**:
```javascript
const servers = await response.json();
servers.forEach(server => {
  console.log(`${server.name} - ${server.status}`);
  // New fields available:
  console.log(`  Runtimes: ${server.runtimes?.length || 0}`);
  console.log(`  Agent Version: ${server.agentVersion}`);
});
```

#### Step 3: Update Status Checks

**Before**:
```javascript
if (agent.status === 'approved') {
  // Agent is active
}
```

**After**:
```javascript
if (server.status === 'active' || server.status === 'online') {
  // Server is active
}
```

---

## For Developers

### Code Changes Required

#### 1. Update Model Imports

**Before**:
```go
import "prism-server/internal/models"

var agent models.LegacyAgent
```

**After**:
```go
import "prism-server/internal/models"

var server models.Server
```

#### 2. Update Database Queries

**Before**:
```go
agents, err := db.GetAgents()
```

**After**:
```go
servers, err := db.GetServers()
```

#### 3. Update API Calls

**Before**:
```go
res, err := http.Get("/api/agents")
```

**After**:
```go
res, err := http.Get("/api/servers")
```

---

## Deprecation Warnings

Starting from v0.4.6, all `/api/agents` endpoints return deprecation headers:

```
X-API-Deprecation-Warning: The /api/agents endpoint is deprecated and will be removed in v1.0. Use /api/servers instead. See MIGRATION_GUIDE.md.
X-API-Sunset: 2026-12-31
```

### Detecting Deprecation Warnings

```javascript
const response = await fetch('/api/agents');
const deprecationWarning = response.headers.get('X-API-Deprecation-Warning');
const sunsetDate = response.headers.get('X-API-Sunset');

if (deprecationWarning) {
  console.warn('DEPRECATION:', deprecationWarning);
  console.warn('This endpoint will be removed on:', sunsetDate);
}
```

---

## Timeline

### v0.4.6 (Current - 2026-04-01)
- ✅ Deprecation warnings added
- ✅ Documentation published
- ✅ Both APIs functional

### v0.5.0 (2026-06-01)
- 📋 Add deprecation warnings to logs
- 📋 Migration tools provided
- 📋 Both APIs functional

### v0.6.0 (2026-09-01)
- 🔄 Automatic data migration from `agents` → `servers`
- 🔄 Feature flag to disable legacy API
- 📋 Both APIs functional (legacy behind flag)

### v1.0.0 (2026-12-31)
- ❌ Legacy `agents` table removed
- ❌ `/api/agents` endpoints removed
- ❌ `LegacyAgent` model removed
- ✅ Only `servers` API available

---

## Support

### Migration Issues

If you encounter issues during migration:

1. Check the [BUG-008](./BUG.md#bug-008-legacy-table-redundancy) tracking issue
2. Review the [IMPLEMENTED.md](./IMPLEMENTED.md) for API details
3. Open a GitHub issue with `[MIGRATION]` tag

### Rollback Plan

If you need to rollback to v0.4.x:

1. Both `agents` and `servers` tables coexist until v1.0
2. Sync layer ensures data consistency
3. No data loss during rollback

---

## FAQ

**Q: Will my existing integrations break immediately?**  
A: No. The legacy `/api/agents` endpoints will continue to work until v1.0.0. However, you should plan to migrate before v1.0.0 release.

**Q: Do I need to migrate my data manually?**  
A: No. In v0.6.0, an automatic migration script will copy data from `agents` → `servers`. Manual migration is not required.

**Q: Can I use both APIs during migration?**  
A: Yes. Both APIs are fully functional and synchronized until v1.0.0.

**Q: What happens if I don't migrate?**  
A: In v1.0.0, the `/api/agents` endpoints will be removed. Your integrations will break if not migrated.

---

## Related Documentation

- [BUG-008: Legacy Table Redundancy](./BUG.md#bug-008-legacy-table-redundancy)
- [IMPLEMENTED.md - Server Models](./IMPLEMENTED.md#data-models)
- [TODO.md - Migration Plan](./TODO.md#legacy-table-unification-agents--servers)

---

*Last Updated: 2026-04-01 (v0.4.6)*  
*Next Update: v0.5.0 - Migration tools*
