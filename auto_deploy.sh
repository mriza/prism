#!/bin/bash
set -e

# ============================================================================
# PRISM Auto-Deploy Script
# ============================================================================

VM_IP="${VM_IP:-}"
VM_USER="${VM_USER:-prism}"
VM_PASS="${VM_PASS:-}"
DST_DIR="/opt/prism"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "==================================="
echo " PRISM Auto-Deploy to VM           "
echo "==================================="

# Prompt for credentials
if [ -z "$VM_IP" ]; then
    if command -v virsh >/dev/null 2>&1; then
        DETECTED_IP=$(virsh -c qemu:///system domifaddr prism-all-in-one 2>/dev/null | grep -E -o "([0-9]{1,3}[\.]){3}[0-9]{1,3}" | head -n 1) || true
        [ -n "$DETECTED_IP" ] && VM_IP=$DETECTED_IP && echo "Detected VM IP: $VM_IP"
    fi
    [ -z "$VM_IP" ] && read -p "Enter VM IP address: " VM_IP
fi

if [ -z "$VM_USER" ]; then
    read -p "Enter VM username (default: prism): " VM_USER
    VM_USER=${VM_USER:-prism}
fi

if [ -z "$VM_PASS" ]; then
    read -s -p "Enter VM password: " VM_PASS
    echo ""
fi

if [ -z "$VM_PASS" ]; then
    echo "Error: Password is required"
    exit 1
fi

export SSHPASS="$VM_PASS"

# Build Server
echo ""
echo "[1/4] Building Server..."
cd "$SCRIPT_DIR/server"
go build -o prism-server cmd/server/main.go || { echo "✗ Server build failed!"; exit 1; }
echo "✓ Server built successfully"

# Build Agent
echo ""
echo "[2/4] Building Agent..."
cd "$SCRIPT_DIR/agent"
go build -o prism-agent cmd/agent/main.go cmd/agent/handlers.go || { echo "✗ Agent build failed!"; exit 1; }
echo "✓ Agent built successfully"

# Build Frontend
echo ""
echo "[3/4] Building Frontend..."
cd "$SCRIPT_DIR/frontend"
npm run build || { echo "✗ Frontend build failed!"; exit 1; }
echo "✓ Frontend built successfully"

# Package
echo ""
echo "[4/4] Packaging and Deploying..."
cd "$SCRIPT_DIR"
rm -f prism_deploy.tar.gz
tar -czf prism_deploy.tar.gz \
    -C "$SCRIPT_DIR/server" prism-server prism-server.service prism-server.conf \
    -C "$SCRIPT_DIR/agent" prism-agent prism-agent.conf prism-agent.service \
    -C "$SCRIPT_DIR/frontend" dist
echo "✓ Deployment package created"

echo ""
echo "Deploying to VM at IP: $VM_IP as user: $VM_USER"
echo ""

# Transfer package
echo "Transferring package..."
sshpass -e scp -o StrictHostKeyChecking=no prism_deploy.tar.gz ${VM_USER}@${VM_IP}:/tmp/prism_deploy.tar.gz

# Create install script
cat > /tmp/install_prism.sh << 'INSTALLSCRIPT'
#!/bin/bash
set -e

DST_DIR="/opt/prism"
VM_USER="$1"

echo "Creating directories..."
mkdir -p $DST_DIR/server $DST_DIR/agent $DST_DIR/frontend

echo "Extracting payload..."
tar -xzf /tmp/prism_deploy.tar.gz -C /tmp/

echo "Placing binaries and config..."
mv /tmp/prism-server $DST_DIR/server/
mv /tmp/prism-server.conf $DST_DIR/server/
mv /tmp/prism-agent $DST_DIR/agent/
mv /tmp/prism-agent.conf $DST_DIR/agent/
rm -rf $DST_DIR/frontend/dist
mv /tmp/dist $DST_DIR/frontend/dist

echo "Installing systemd services..."
mv /tmp/prism-server.service /etc/systemd/system/
mv /tmp/prism-agent.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable prism-server
systemctl enable prism-agent

echo "Fixing permissions..."
chown -R $VM_USER:$VM_USER $DST_DIR
chmod -R 775 $DST_DIR
chmod +x $DST_DIR/server/prism-server
chmod +x $DST_DIR/agent/prism-agent

echo "Configuring Nginx..."
cat > /etc/nginx/sites-available/default << 'NGINX'
server {
    listen 80;
    root /opt/prism/frontend/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:65432;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /agent/connect {
        proxy_pass http://127.0.0.1:65432;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
    }
}
NGINX

ln -sf /etc/nginx/sites-available/default /etc/nginx/sites-enabled/default

echo "Configuring firewall..."
ufw allow 80/tcp 2>/dev/null || true
ufw allow 65432/tcp 2>/dev/null || true

echo "Restarting services..."
systemctl restart prism-server || echo "Failed to restart server"

echo "Waiting for server to initialize (10s)..."
sleep 10

echo "Syncing agent token with server..."
SERVER_TOKEN=$(grep "^token =" /opt/prism/server/prism-server.conf | head -1 | sed 's/token *= *//;s/^["'\'']//;s/["'\'']$//' | tr -d ' ')
echo "Server token: ${SERVER_TOKEN:0:5}..."

if [ -n "$SERVER_TOKEN" ]; then
    sed -i "s|^token = .*|token = '$SERVER_TOKEN'|" /opt/prism/agent/prism-agent.conf
    echo "✓ Token synced successfully"
    
    AGENT_TOKEN=$(grep "^token =" /opt/prism/agent/prism-agent.conf | head -1 | sed 's/token *= *//;s/^["'\'']//;s/["'\'']$//' | tr -d ' ')
    if [ "$AGENT_TOKEN" = "$SERVER_TOKEN" ]; then
        echo "✓ Token verification successful"
    else
        echo "⚠ Retrying token sync..."
        sed -i "s|^token = .*|token = '$SERVER_TOKEN'|" /opt/prism/agent/prism-agent.conf
    fi
else
    echo "✗ Could not get server token"
fi

systemctl restart prism-agent || echo "Failed to restart agent"
systemctl restart nginx || echo "Failed to restart nginx"

echo ""
echo "========================================="
echo "  Deployment completed successfully!"
echo "========================================="
echo ""
echo "Services status:"
systemctl is-active prism-server 2>/dev/null || echo "  - prism-server: inactive"
systemctl is-active prism-agent 2>/dev/null || echo "  - prism-agent: inactive"
systemctl is-active nginx 2>/dev/null || echo "  - nginx: inactive"
echo ""
echo "Access the dashboard at: http://$VM_IP"
echo "Server API: http://$VM_IP:65432"
echo ""
INSTALLSCRIPT

# Transfer install script
echo "Transferring install script..."
sshpass -e scp -o StrictHostKeyChecking=no /tmp/install_prism.sh ${VM_USER}@${VM_IP}:/tmp/install_prism.sh

# Execute install script with sudo
echo "Executing installation..."
sshpass -e ssh -o StrictHostKeyChecking=no ${VM_USER}@${VM_IP} "chmod +x /tmp/install_prism.sh && echo '$VM_PASS' | sudo -S /tmp/install_prism.sh $VM_USER"

# Cleanup
rm -f /tmp/install_prism.sh

echo ""
echo "✓ Deployment complete!"
