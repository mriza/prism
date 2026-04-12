#!/bin/bash

# PRISM Local to VM Deployment Script
# Deploys local PRISM build to VM via scp
# Usage: ./scripts/deploy-to-vm.sh

set -e

# Configuration
VM_USER="prism"
VM_HOST="192.168.122.230"
VM_PASSWORD="prism123"
VM_INSTALL_DIR="/opt/prism"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

# Export password for SSH_ASKPASS
export SSHPASS="$VM_PASSWORD"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

echo "========================================"
echo "  PRISM Deployment to VM"
echo "  Target: ${VM_USER}@${VM_HOST}"
echo "========================================"
echo ""

# Check VM is accessible
log_info "Checking VM connectivity..."
if ping -c 1 -W 2 ${VM_HOST} &> /dev/null; then
    log_success "VM is accessible"
else
    log_error "VM is not accessible. Please start VM first:"
    echo "  virsh -c qemu:///system start prism-all-in-one"
    exit 1
fi

# Build frontend
log_info "Building frontend..."
cd "$ROOT_DIR/frontend"
npm run build
log_success "Frontend built successfully"

# Build server
log_info "Building server..."
cd "$ROOT_DIR/server"
go build -o prism-server ./cmd/server
log_success "Server built successfully"

# Build agent
log_info "Building agent..."
cd "$ROOT_DIR/agent"
go build -o prism-agent ./cmd/agent
log_success "Agent built successfully"

# Create temp directory for deployment package
log_info "Creating deployment package..."
DEPLOY_DIR=$(mktemp -d)
mkdir -p "$DEPLOY_DIR/server"
mkdir -p "$DEPLOY_DIR/agent"
mkdir -p "$DEPLOY_DIR/frontend"

# Copy binaries
cp "$ROOT_DIR/server/prism-server" "$DEPLOY_DIR/server/"
cp "$ROOT_DIR/agent/prism-agent" "$DEPLOY_DIR/agent/"
cp -r "$ROOT_DIR/frontend/dist/"* "$DEPLOY_DIR/frontend/"

# Create tarball
DEPLOY_PACKAGE="$DEPLOY_DIR/prism-deploy.tar.gz"
cd "$DEPLOY_DIR"
tar -czf "$DEPLOY_PACKAGE" server/ agent/ frontend/
log_success "Deployment package created: $DEPLOY_PACKAGE"

# Copy to VM using sshpass
log_info "Copying deployment package to VM..."
sshpass -p "$VM_PASSWORD" scp "$DEPLOY_PACKAGE" ${VM_USER}@${VM_HOST}:/tmp/
log_success "Package copied to VM"

# Deploy on VM
log_info "Deploying on VM..."
sshpass -p "$VM_PASSWORD" ssh ${VM_USER}@${VM_HOST} << 'EOF'
    echo "   Extracting package..."
    sudo mkdir -p /opt/prism
    sudo tar -xzf /tmp/prism-deploy.tar.gz -C /opt/prism/
    
    echo "   Setting permissions..."
    sudo chmod +x /opt/prism/server/prism-server
    sudo chmod +x /opt/prism/agent/prism-agent
    sudo chown -R prism:prism /opt/prism
    
    echo "   Stopping existing services..."
    sudo systemctl stop prism-server 2>/dev/null || true
    sudo systemctl stop prism-agent 2>/dev/null || true
    
    echo "   Creating systemd services..."
    
    # Server service
    sudo tee /etc/systemd/system/prism-server.service > /dev/null << 'SYSTEMD'
[Unit]
Description=PRISM Server
After=network.target

[Service]
Type=simple
User=prism
WorkingDirectory=/opt/prism/server
ExecStart=/opt/prism/server/prism-server
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
SYSTEMD

    # Agent service
    sudo tee /etc/systemd/system/prism-agent.service > /dev/null << 'SYSTEMD'
[Unit]
Description=PRISM Agent
After=network.target prism-server.service

[Service]
Type=simple
User=prism
WorkingDirectory=/opt/prism/agent
ExecStart=/opt/prism/agent/prism-agent
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
SYSTEMD

    echo "   Starting services..."
    sudo systemctl daemon-reload
    sudo systemctl enable prism-server
    sudo systemctl enable prism-agent
    sudo systemctl start prism-server
    sudo systemctl start prism-agent
    
    echo "   Cleaning up..."
    rm -f /tmp/prism-deploy.tar.gz
EOF

log_success "Deployment completed on VM!"

# Cleanup
rm -rf "$DEPLOY_DIR"

# Verify deployment
log_info "Verifying deployment..."
sleep 3

if sshpass -p "$VM_PASSWORD" ssh ${VM_USER}@${VM_HOST} "systemctl is-active prism-server" &> /dev/null; then
    log_success "PRISM Server is running"
else
    log_warn "PRISM Server may not be running yet"
fi

if sshpass -p "$VM_PASSWORD" ssh ${VM_USER}@${VM_HOST} "systemctl is-active prism-agent" &> /dev/null; then
    log_success "PRISM Agent is running"
else
    log_warn "PRISM Agent may not be running yet"
fi

# Check frontend (port 80 for Nginx)
log_info "Checking frontend..."
if curl -s -o /dev/null -w "%{http_code}" http://${VM_HOST} | grep -E "200|304"; then
    log_success "Frontend is accessible (Port 80)"
else
    log_warn "Frontend may still be starting up"
fi

echo ""
echo "========================================"
log_success "Deployment Complete!"
echo "========================================"
echo ""
echo "VM: ${VM_HOST} (Port 80 - Nginx)"
echo "Frontend: http://${VM_HOST}/"
echo ""
echo "Services:"
echo "  - PRISM Server: Running"
echo "  - PRISM Agent: Running"
echo ""
echo "Next steps:"
echo "  1. Run E2E tests: cd tests/e2e && npm run test:vm"
echo "  2. Check logs: ssh ${VM_USER}@${VM_HOST} 'journalctl -u prism-server -f'"
echo ""
