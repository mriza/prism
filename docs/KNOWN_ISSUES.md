# Known Issues - VM Deployment

**Date**: 2026-04-02  
**Status**: ⚠️ **KNOWN ISSUE**

---

## Issue: Firewall Actions Not Recognized

### Symptom
- Firewall action endpoint `/api/control` returns 404
- Firewall actions (allow, deny, delete) not working on VM
- Other endpoints working fine

### Root Cause
**Binary version mismatch**:
- Local binary: Latest (includes `/api/control` endpoint)
- VM binary: Old version (Apr 2 01:51) - missing `/api/control` endpoint

**Why**: Deploy script (`deploy-to-vm.sh`) successfully copies files but VM requires sudo password for service management, which blocks automatic service restart with new binary.

### Affected Endpoints
- `/api/control` - Service control (firewall actions)
- `/api/control/import` - Service import

### Workaround

**Manual Update** (requires VM sudo password):
```bash
# 1. Copy new binary to VM
scp server/prism-server prism@192.168.122.230:/tmp/

# 2. SSH to VM
ssh prism@192.168.122.230

# 3. Update binary (requires sudo password)
sudo systemctl stop prism-server
sudo cp /tmp/prism-server /opt/prism/server/
sudo chmod +x /opt/prism/server/prism-server
sudo systemctl start prism-server

# 4. Verify
curl http://localhost:8080/api/control
# Should return 405 (Method Not Allowed) instead of 404
```

### Solution Options

**Option 1: Configure Passwordless Sudo** (Recommended)
On VM, add to `/etc/sudoers.d/prism-nopasswd`:
```
prism ALL=(ALL) NOPASSWD:ALL
```

**Option 2: Manual Deployment**
Manually copy and restart server when needed (see workaround above)

**Option 3: Fix Deploy Script**
Update `deploy-to-vm.sh` to handle sudo password properly

---

## Other Working Features

✅ **Frontend**: Accessible on port 80 (Nginx)  
✅ **Server**: Running (old binary)  
✅ **Agent**: Running  
✅ **Most API endpoints**: Working  
✅ **E2E Infrastructure**: Ready  

**Only Affected**: `/api/control` endpoint (firewall actions)

---

## Impact

**Low Impact**:
- Core functionality working
- Most features accessible
- E2E testing infrastructure ready
- Only firewall control actions affected

**Note**: This is a **deployment issue**, not a code issue. The endpoint exists in the latest codebase.

---

**Status**: ⚠️ **KNOWN - WORKAROUND AVAILABLE**  
**Priority**: 🟡 MEDIUM  
**Fix**: Configure passwordless sudo on VM or manual update
