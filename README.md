# PRISM — Infrastructure Manager

PRISM is a lightweight infrastructure management platform for managing services, databases, firewalls, and security across multiple servers.

## Key Features

- **Multi-Server Services Management**: Monitor and manage services across your entire fleet.
- **Remote Configuration**: Edit service configuration files (Nginx, VSFTPD, Caddy, MySQL, Postgres) directly from the dashboard.
- **VSFTPD Virtual Users**: Implement FTP virtual users with Btrfs quotas and system-wide default settings.
- **Multi-OS Support**: Deployment and installation scripts compatible with Debian, Ubuntu, Fedora, and RHEL-based systems.
- **Security & Firewall**: Manage firewall rules and CrowdSec integration per server.
- **Theming**: Modern UI with Light (Corporate) and Dark (Business) mode support via DaisyUI.

## Components

- **Hub (Server)** — Central Go-based control server with REST API and WebSocket relay.
- **Agent** — Lightweight Go agent running on managed servers, providing auto-discovery and remote execution.
- **Frontend** — Professional React + Vite dashboard with DaisyUI and Lucide icons.

## Quick Start

```bash
# 1. Build Hub
cd server && go build -o prism-server cmd/server/main.go

# 2. Build Agent
cd agent && go build -o prism-agent cmd/agent/*.go

# 3. Build Frontend
cd frontend && npm install && npm run build

# 4. Auto Deployment
./auto_deploy.sh
```

## Deployment Helpers
- `auto_deploy.sh`: Automated build and deployment to a target VM via SSH.
- `services_installer.sh`: Interactive CLI to install and configure 14+ services individually.
- `deploy.sh`: Interactive script for manual server deployment from GitHub artifacts.

## License

MIT
