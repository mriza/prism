# PRISM Deployment Guide

> **Version**: v0.5.1+
> **Last Updated**: 2026-04-11

This guide covers all deployment scenarios for PRISM, from local development to production.

---

## Table of Contents

1. [Overview](#overview)
2. [Scenario 1: Localhost Development](#scenario-1-localhost-development)
3. [Scenario 2: Single Server Deployment](#scenario-2-single-server-deployment)
4. [Scenario 3: VM Deployment](#scenario-3-vm-deployment)
5. [Scenario 4: Production with Separate Domains](#scenario-4-production-with-separate-domains)
6. [Docker Deployment](#docker-deployment)
7. [Configuration Reference](#configuration-reference)
8. [Troubleshooting](#troubleshooting)

---

## Overview

PRISM supports four main deployment scenarios:

| Scenario | Use Case | FE Location | BE Location | Complexity |
|----------|----------|-------------|-------------|------------|
| **1. Localhost** | Development | Same as BE | Same host | ⭐ |
| **2. Single Server** | Staging/Internal | Same server | Same server, different port | ⭐⭐ |
| **3. VM** | Testing/QA | Developer machine | VM (different IP) | ⭐⭐⭐ |
| **4. Production** | Production | Separate domain | Separate domain | ⭐⭐⭐⭐ |

---

## Scenario 1: Localhost Development

**Use Case**: Local development and testing

**Architecture**:
```
Browser → localhost:5173 (FE dev server)
              ↓
         localhost:65432 (BE server)
```

### Frontend Configuration (`.env.local`)
```env
VITE_API_URL=http://localhost:65432
```

### Server Configuration (`prism-server.conf`)
```toml
[server]
host = "127.0.0.1"
port = 65432

[cors]
allowed_origins = ["http://localhost:5173", "http://localhost:3000"]

[auth]
jwt_secret = "dev-secret-change-me"
token = "dev-agent-token-change-me"
```

### Agent Configuration (`prism-agent.conf`)
```toml
[hub]
url = "ws://localhost:65432/agent/connect"
token = "dev-agent-token-change-me"
```

### Running
```bash
# Terminal 1: Start server
cd server && go run cmd/server/main.go

# Terminal 2: Start frontend dev server
cd frontend && npm run dev

# Terminal 3: Start agent (optional)
cd agent && go run cmd/agent/main.go
```

---

## Scenario 2: Single Server Deployment

**Use Case**: Staging or internal deployment on a single server

**Architecture**:
```
Browser → https://prism.internal:80 (Nginx serves FE)
              ↓
         https://prism.internal:8080/api (BE server)
```

### Nginx Configuration
```nginx
server {
    listen 80;
    server_name prism.internal;

    # Frontend (static files)
    location / {
        root /opt/prism/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    # Backend API (reverse proxy)
    location /api/ {
        proxy_pass http://127.0.0.1:65432;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket for agents
    location /agent/ {
        proxy_pass http://127.0.0.1:65432;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
    }

    # WebSocket for frontend
    location /ws/ {
        proxy_pass http://127.0.0.1:65432;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
    }
}
```

### Frontend Configuration (`.env.production`)
```env
# Leave empty - use same-origin relative paths
VITE_API_URL=
```

### Server Configuration (`prism-server.conf`)
```toml
[server]
host = "0.0.0.0"
port = 65432

[cors]
allowed_origins = ["https://prism.internal"]

[frontend]
base_url = "https://prism.internal"

[auth]
jwt_secret = "<generate-with-openssl-rand-hex-32>"
token = "<generate-with-openssl-rand-hex-32>"
```

### Agent Configuration (`prism-agent.conf`)
```toml
[hub]
url = "ws://localhost:65432/agent/connect"
token = "<copy-from-server-config>"
```

### Deployment Steps
```bash
# 1. Build frontend
cd frontend && npm run build

# 2. Build server
cd server && go build -o /opt/prism/bin/prism-server cmd/server/main.go

# 3. Create systemd service
sudo cp server/prism-server.service /etc/systemd/system/

# 4. Start services
sudo systemctl daemon-reload
sudo systemctl enable --now prism-server
```

---

## Scenario 3: VM Deployment

**Use Case**: Development/testing with VM

**Architecture**:
```
Browser (dev machine) → http://192.168.122.230:80 (VM Nginx serves FE)
                            ↓
                       http://192.168.122.230:8080 (VM BE server)
```

### Frontend Configuration (`.env.local` on dev machine)
```env
VITE_API_URL=http://192.168.122.230:8080
```

### Server Configuration (`/opt/prism/config/prism-server.conf` on VM)
```toml
[server]
host = "0.0.0.0"
port = 8080

[cors]
allowed_origins = ["http://192.168.122.1:5173", "http://192.168.122.1:3000", "http://192.168.122.230:80"]

[frontend]
base_url = "http://192.168.122.1:5173"

[auth]
jwt_secret = "<generate-with-openssl>"
token = "<generate-with-openssl>"
```

### Agent Configuration (`/opt/prism/config/prism-agent.conf` on VM)
```toml
[hub]
url = "ws://127.0.0.1:8080/agent/connect"
token = "<copy-from-server-config>"
```

### VM Setup Script
```bash
# On VM
sudo apt-get update
sudo apt-get install -y nginx

# Copy binaries
scp prism-server prism@192.168.122.230:/opt/prism/bin/
scp -r frontend/dist/* prism@192.168.122.230:/var/www/html/

# Start services
sudo systemctl restart nginx
sudo systemctl restart prism-server
```

---

## Scenario 4: Production with Separate Domains (Caddy)

**Use Case**: Production deployment dengan Caddy sebagai reverse proxy untuk FE dan BE

**Architecture**:
```
Browser → https://prism.example.com (FE - Caddy serves static files)
              ↓ (CORS requests)
         https://api.prism.example.com (BE - Caddy reverse proxy)
              ↓ (WebSocket - automatic with Caddy)
         wss://api.prism.example.com/agent/connect (Agent WebSocket)
```

### Why Caddy?

Caddy memiliki keunggulan untuk production deployment:
- **Automatic HTTPS** - Auto-provision Let's Encrypt certificates
- **Zero-config SSL** - Tidak perlu manual setup sertifikat
- **WebSocket support** - Otomatis handle WebSocket upgrade
- **Simple configuration** - Lebih simple dari Nginx
- **HTTP/2 & HTTP/3** - Otomatis enabled

### Caddy Configuration (Frontend Domain)

**File**: `/etc/caddy/Caddyfile`

```caddy
prism.example.com {
    # Frontend static files
    root * /var/www/prism-frontend
    
    # SPA routing
    try_files {path} /index.html
    
    # Static file serving
    file_server
    
    # Security headers
    header {
        X-Frame-Options "SAMEORIGIN"
        X-Content-Type-Options "nosniff"
        X-XSS-Protection "1; mode=block"
        Strict-Transport-Security "max-age=31536000; includeSubDomains"
        Referrer-Policy "strict-origin-when-cross-origin"
    }
    
    # Gzip compression
    encode gzip
}
```

### Caddy Configuration (Backend Domain)

**File**: `/etc/caddy/Caddyfile` (tambahkan di file yang sama atau terpisah)

```caddy
api.prism.example.com {
    # API endpoints - reverse proxy ke backend server
    reverse_proxy /api/* 127.0.0.1:65432 {
        header_up Host {host}
        header_up X-Real-IP {remote}
        header_up X-Forwarded-For {remote}
        header_up X-Forwarded-Proto {scheme}
        
        # Health check
        health_uri /health
        health_interval 30s
        health_timeout 10s
    }
    
    # WebSocket endpoints (Caddy otomatis handle upgrade)
    reverse_proxy /ws/* 127.0.0.1:65432 {
        header_up Host {host}
        header_up X-Real-IP {remote}
        header_up Upgrade {http.upgrade}
        header_up Connection "Upgrade"
    }
    
    # Agent WebSocket endpoint
    reverse_proxy /agent/* 127.0.0.1:65432 {
        header_up Host {host}
        header_up X-Real-IP {remote}
        header_up Upgrade {http.upgrade}
        header_up Connection "Upgrade"
        
        # Longer timeout untuk WebSocket connections
        transport http {
            keepalive 600s
            keepalive_idle_conns 100
            keepalive_idle_conns_per_host 10
        }
    }
    
    # Security headers
    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains"
        X-Content-Type-Options "nosniff"
        X-Frame-Options "DENY"
    }
}
```

### Alternative: Single Caddyfile untuk Kedua Domain

Jika FE dan BE di server yang sama:

```caddy
{
    # Global options
    email admin@example.com
    acme_ca https://acme-v02.api.letsencrypt.org/directory
}

# Frontend
prism.example.com {
    root * /var/www/prism-frontend
    try_files {path} /index.html
    file_server
    encode gzip
    
    header {
        X-Frame-Options "SAMEORIGIN"
        X-Content-Type-Options "nosniff"
        Strict-Transport-Security "max-age=31536000; includeSubDomains"
    }
    
    # Proxy API requests ke backend (opsional - jika ingin same-origin)
    # reverse_proxy /api/* 127.0.0.1:65432
    # reverse_proxy /ws/* 127.0.0.1:65432
    # reverse_proxy /agent/* 127.0.0.1:65432
}

# Backend API
api.prism.example.com {
    reverse_proxy /api/* 127.0.0.1:65432 {
        header_up Host {host}
        header_up X-Real-IP {remote}
        header_up X-Forwarded-For {remote}
    }
    
    # WebSocket endpoints (otomatis handle upgrade)
    reverse_proxy /ws/* 127.0.0.1:65432 {
        header_up Upgrade {http.upgrade}
        header_up Connection "Upgrade"
    }
    
    reverse_proxy /agent/* 127.0.0.1:65432 {
        header_up Upgrade {http.upgrade}
        header_up Connection "Upgrade"
        transport http {
            keepalive 600s
        }
    }
    
    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains"
        X-Content-Type-Options "nosniff"
    }
}
```

### Frontend Configuration (`.env.production`)
```env
VITE_API_URL=https://api.prism.example.com
# Optional: Explicit WS URL (auto-derived from API URL if not set)
# VITE_WS_URL=wss://api.prism.example.com
```

### Server Configuration (`prism-server.conf`)
```toml
[server]
host = "0.0.0.0"
port = 65432

[cors]
allowed_origins = ["https://prism.example.com", "https://admin.prism.example.com"]
allow_credentials = true
max_age = 86400

[frontend]
base_url = "https://prism.example.com"

[auth]
jwt_secret = "<generate-with-openssl-rand-hex-32>"
token = "<generate-with-openssl-rand-hex-32>"

[log]
level = "warn"
format = "json"
file = "/var/log/prism-server.log"
```

### Agent Configuration (on each managed server)
```toml
[hub]
url = "wss://api.prism.example.com/agent/connect"
token = "<copy-from-server-config>"

[log]
level = "info"
format = "json"
file = "/var/log/prism-agent.log"
```

### Deployment Steps with Caddy

```bash
# 1. Install Caddy
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install caddy

# 2. Build frontend
cd frontend && npm run build

# 3. Deploy frontend static files
sudo mkdir -p /var/www/prism-frontend
sudo cp -r dist/* /var/www/prism-frontend/
sudo chown -R caddy:caddy /var/www/prism-frontend

# 4. Configure Caddy
sudo nano /etc/caddy/Caddyfile
# (paste configuration dari atas)

# 5. Build and start server
cd server && go build -o /opt/prism/bin/prism-server cmd/server/main.go
sudo systemctl enable --now prism-server

# 6. Start Caddy
sudo systemctl reload caddy

# 7. Verify (Caddy otomatis provision SSL)
curl -I https://prism.example.com
curl -I https://api.prism.example.com/health
```

### Caddy Advantages untuk Production

| Feature | Nginx | Caddy |
|---------|-------|-------|
| SSL Setup | Manual (certbot) | **Automatic** |
| WebSocket | Manual upgrade headers | **Automatic** |
| HTTP/2 | Manual config | **Automatic** |
| HTTP/3 (QUIC) | Complex setup | **Automatic** |
| Config Syntax | Complex directives | **Simple & clean** |
| Auto-renew SSL | cron job needed | **Built-in** |
| Config Validation | `nginx -t` | `caddy validate` |
| Hot Reload | `nginx -s reload` | `caddy reload` |

### Caddy Configuration Tips

**1. Load Balancing (jika multiple backend instances)**:
```caddy
api.prism.example.com {
    reverse_proxy /api/* 127.0.0.1:65432 127.0.0.1:65433 127.0.0.1:65434 {
        lb_policy round_robin
        health_uri /health
        health_interval 30s
    }
}
```

**2. Rate Limiting dengan Caddy**:
```caddy
api.prism.example.com {
    # Requires caddy-rate-limit plugin
    rate_limit {
        zone api_limit {
            key {remote}
            requests 60
            window 1m
        }
    }
    
    reverse_proxy 127.0.0.1:65432
}
```

**3. Compression (automatic with Caddy)**:
```caddy
prism.example.com {
    encode gzip zstd  # Caddy support gzip + zstd
    file_server
}
```

**4. Logging**:
```caddy
{
    log {
        output file /var/log/caddy/access.log {
            roll_size 100mb
            roll_keep 10
            roll_keep_for 720h
        }
    }
}

api.prism.example.com {
    log {
        output file /var/log/caddy/api.log
        format json
    }
    
    reverse_proxy 127.0.0.1:65432
}
```

---

## Docker Deployment

For local development and testing with Docker:

### Quick Start
```bash
# Build and start all services
docker compose up -d

# View logs
docker compose logs -f

# Stop all services
docker compose down
```

### Docker Compose Configuration
```yaml
# docker-compose.yml (see project root)
services:
  hub:
    build:
      context: .
      dockerfile: Dockerfile.server
    ports:
      - "8080:8080"
    volumes:
      - hub-data:/opt/prism/data
      - ./config/prism-server.conf:/opt/prism/config/server.toml
    environment:
      - PRISM_AUTH_TOKEN=dev-token-123

  agent:
    build:
      context: .
      dockerfile: Dockerfile.agent
    volumes:
      - ./config/prism-agent.conf:/opt/prism/config/agent.toml
    depends_on:
      - hub

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    ports:
      - "3000:80"
    depends_on:
      - hub
```

---

## Configuration Reference

### Frontend Environment Variables

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `VITE_API_URL` | Backend API URL | Empty (same origin) | `https://api.example.com` |
| `VITE_WS_URL` | WebSocket URL | Auto-derived from API | `wss://ws.example.com` |
| `VITE_APP_TITLE` | Application title | `PRISM Dashboard` | `My PRISM` |
| `VITE_DEBUG_LOGGING` | Enable debug logs | `false` | `true` |

### Server Configuration

| Key | Description | Default | Example |
|-----|-------------|---------|---------|
| `server.host` | Bind address | `0.0.0.0` | `127.0.0.1` |
| `server.port` | Server port | `65432` | `8080` |
| `cors.allowed_origins` | Allowed CORS origins | `["*"]` | `["https://example.com"]` |
| `frontend.base_url` | Frontend URL | Empty | `https://prism.example.com` |
| `auth.jwt_secret` | JWT signing secret | Auto-generated | `<32-hex-chars>` |
| `auth.token` | Agent auth token | Auto-generated | `<32-hex-chars>` |
| `log.level` | Log level | `info` | `debug`, `warn`, `error` |
| `log.format` | Log format | `json` | `text` |

---

## Troubleshooting

### CORS Issues

**Symptom**: Browser console shows CORS errors like:
```
Access to fetch at 'https://api.example.com/api/login' from origin 'https://prism.example.com' has been blocked by CORS policy
```

**Solution**:
1. Add frontend domain to `cors.allowed_origins` in server config
2. Ensure protocol matches (http vs https)
3. Restart server after config changes

### WebSocket Connection Failures

**Symptom**: "WebSocket connection failed" errors

**Solution**:
1. Check `VITE_API_URL` or `VITE_WS_URL` are correct
2. **Caddy**: WebSocket upgrade otomatis, pastikan tidak ada config yang override
3. **Nginx**: Pastikan `proxy_set_header Upgrade` dan `Connection "Upgrade"` ada
4. Check SSL certificates match (wss:// requires valid certs)
5. Verify firewall allows WebSocket connections (port 443)

**Caddy-specific troubleshooting**:
```bash
# Check Caddy logs for WebSocket issues
sudo journalctl -u caddy -f --grep "websocket"

# Verify Caddy config
caddy validate --config /etc/caddy/Caddyfile

# Reload Caddy after config changes
sudo caddy reload --config /etc/caddy/Caddyfile
```

### Agent Not Connecting

**Symptom**: Agent shows as "pending" or "offline"

**Solution**:
1. Verify `hub.url` in agent config points to correct server
2. Check `hub.token` matches server's `auth.token`
3. Check firewall allows agent to reach hub (port 8080 or configured port)
4. Check agent logs: `journalctl -u prism-agent -f`

### Configuration Not Applied

**Symptom**: Changes to config file not taking effect

**Solution**:
1. Restart the service: `sudo systemctl restart prism-server`
2. Check config file path and permissions: `ls -l /opt/prism/config/prism-server.conf`
3. Verify config syntax: `cat /opt/prism/config/prism-server.conf`

---

## Migration Guide

### From v0.4.x to v0.5.x

1. **Update configuration format**:
   - Old: Simple key-value config
   - New: TOML format with sections (see examples above)

2. **Add CORS configuration**:
   - Required for cross-origin deployments
   - See scenario-specific examples

3. **Update environment variables**:
   - Frontend now uses `VITE_API_URL` instead of hardcoded URLs
   - See `.env.example` for all options

4. **Restart all services** after configuration changes

---

**Last Updated**: 2026-04-11
**Version**: v0.5.1
**Maintained By**: PRISM Development Team
