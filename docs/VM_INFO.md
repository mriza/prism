# PRISM VM Information

> **Created**: 2026-04-12
> **Last Updated**: 2026-04-12 (v0.7.2 Deployed)
> **Purpose**: Testing & POC Deployment
> **Status**: ✅ FULLY DEPLOYED - v0.7.2 (All Bugs Fixed)

---

## Quick Access

| Property | Value |
|----------|-------|
| **IP Address** | `192.168.122.121` |
| **Frontend** | http://192.168.122.121 |
| **API** | http://192.168.122.121/api/ |
| **Health** | http://192.168.122.121/health |
| **SSH** | `ssh prism@192.168.122.121` |

---

## VM Specifications

| Property | Value |
|----------|-------|
| **Name** | prism-vm |
| **OS** | Debian 12 Bookworm (Cloud Image) |
| **vCPU** | 2 |
| **RAM** | 8 GB |
| **Disk** | 80 GB (qcow2, thin-provisioned) |
| **Network** | NAT (libvirt default) |
| **Hypervisor** | QEMU/KVM (qemu:///system) |

---

## Access Information

| Property | Value |
|----------|-------|
| **IP Address** | `192.168.122.121` |
| **Username** | `prism` |
| **Password** | `prism123` |
| **SSH** | `ssh prism@192.168.122.121` |
| **Sudo** | Passwordless (NOPASSWD:ALL) |

---

## Deployed Services

| Service | Status | Port | Details |
|---------|--------|------|---------|
| **PRISM Server** | ✅ Active | 65432 | Hub/Server (Go + SQLite) |
| **PRISM Agent** | ✅ Active | - | Local agent (auto-connect to server) |
| **Nginx** | ✅ Active | 80 | Reverse proxy + frontend |
| **Frontend** | ✅ Active | 80 | React SPA (built & deployed) |

### Service URLs

| URL | Purpose |
|-----|---------|
| `http://192.168.122.121/` | Frontend Dashboard |
| `http://192.168.122.121/api/` | REST API |
| `http://192.168.122.121/health` | Health Check |
| `http://192.168.122.121/ws/` | WebSocket (frontend) |
| `http://192.168.122.121/agent/` | WebSocket (agent) |

### Default Credentials

| Role | Username | Password |
|------|----------|----------|
| Admin | `admin` | `admin123` |

---

## File Locations

| Component | Path |
|-----------|------|
| **Server Binary** | `/opt/prism/bin/prism-server` |
| **Agent Binary** | `/opt/prism/bin/prism-agent` |
| **Server Config** | `/opt/prism/config/server.toml` |
| **Agent Config** | `/opt/prism/config/agent.toml` |
| **Database** | `/opt/prism/data/prism.db` |
| **Frontend Files** | `/var/www/prism-frontend/` |

---

## Management Commands

```bash
# Check all services status
ssh prism@192.168.122.121 "sudo systemctl status prism-server prism-agent nginx"

# View server logs
ssh prism@192.168.122.121 "sudo journalctl -u prism-server -f"

# View agent logs
ssh prism@192.168.122.121 "sudo journalctl -u prism-agent -f"

# Restart services
ssh prism@192.168.122.121 "sudo systemctl restart prism-server prism-agent nginx"

# Stop services
ssh prism@192.168.122.121 "sudo systemctl stop prism-server prism-agent nginx"

# Update server binary (from host)
scp server/prism-server prism@192.168.122.121:/tmp/
ssh prism@192.168.122.121 "sudo mv /tmp/prism-server /opt/prism/bin/ && sudo systemctl restart prism-server"

# Update frontend (from host)
cd frontend && npm run build
scp -r dist/* prism@192.168.122.121:/tmp/frontend/
ssh prism@192.168.122.121 "sudo cp -r /tmp/frontend/* /var/www/prism-frontend/"
```

### VM Management (from host)

```bash
# Start VM
virsh -c qemu:///system start prism-vm

# Stop VM
virsh -c qemu:///system shutdown prism-vm

# Get IP
virsh -c qemu:///system domifaddr prism-vm

# Console
virsh -c qemu:///system console prism-vm
```

---

## Nginx Configuration

```nginx
server {
    listen 80;
    server_name 192.168.122.121;
    root /var/www/prism-frontend;

    # Frontend SPA
    location / {
        try_files $uri $uri/ /index.html;
    }

    # REST API
    location /api/ {
        proxy_pass http://127.0.0.1:65432;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Health Check
    location /health {
        proxy_pass http://127.0.0.1:65432;
        proxy_set_header Host $host;
    }

    # WebSocket - Frontend
    location /ws/ {
        proxy_pass http://127.0.0.1:65432;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
    }

    # WebSocket - Agent
    location /agent/ {
        proxy_pass http://127.0.0.1:65432;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
    }
}
```

---

## Deployment Workflow

### From Host Machine

```bash
# 1. Build all components
cd server && go build -o prism-server cmd/server/main.go
cd ../agent && go build -o prism-agent cmd/agent/*.go
cd ../frontend && npm run build

# 2. Push to VM
scp server/prism-server prism@192.168.122.121:/tmp/
scp agent/prism-agent prism@192.168.122.121:/tmp/
scp -r frontend/dist/* prism@192.168.122.121:/tmp/frontend/

# 3. Deploy on VM
ssh prism@192.168.122.121 << 'DEPLOY'
sudo mv /tmp/prism-server /opt/prism/bin/
sudo mv /tmp/prism-agent /opt/prism/bin/
sudo chmod +x /opt/prism/bin/*
sudo cp -r /tmp/frontend/* /var/www/prism-frontend/
sudo systemctl restart prism-server prism-agent nginx
DEPLOY
```

---

## Network Architecture

```
Host Machine (192.168.122.1)
    │
    │ virbr0 (NAT bridge)
    │
    └── VM (192.168.122.121)
            │
            ├── Nginx (:80) ← User access point
            │   ├── / → Frontend SPA
            │   ├── /api/ → Server (:65432)
            │   ├── /health → Server (:65432)
            │   ├── /ws/ → Server WebSocket
            │   └── /agent/ → Server WebSocket
            │
            ├── PRISM Server (:65432)
            │   ├── REST API
            │   ├── WebSocket Hub
            │   └── SQLite Database
            │
            └── PRISM Agent
                └── Connects to Server via ws://127.0.0.1:65432
```

---

## Troubleshooting

### Frontend not loading
```bash
ssh prism@192.168.122.121 "sudo systemctl status nginx"
ssh prism@192.168.122.121 "ls -la /var/www/prism-frontend/"
```

### API not responding
```bash
ssh prism@192.168.122.121 "sudo systemctl status prism-server"
ssh prism@192.168.122.121 "curl -s http://127.0.0.1:65432/health"
ssh prism@192.168.122.121 "sudo journalctl -u prism-server -n 20"
```

### Agent not connecting
```bash
ssh prism@192.168.122.121 "sudo systemctl status prism-agent"
ssh prism@192.168.122.121 "sudo journalctl -u prism-agent -n 20"
ssh prism@192.168.122.121 "cat /opt/prism/config/agent.toml"
```

### Update deployment
```bash
# Build from host
cd /home/mriza/Projects/prism && ./scripts/deploy-to-vm.sh
```

---

**Last Updated**: 2026-04-12
**Deployment Version**: v0.5.1
**Managed By**: PRISM Development Team
