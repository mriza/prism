#!/bin/bash
set -e

# Target Configuration
VM_IP="192.168.122.215" # Assuming this from standard QEMU default or previous runs, will check if needed
VM_USER="prism"
VM_PASS="prism123"
DST_DIR="/opt/prism"

echo "==================================="
echo " PRISM Auto-Deploy to VM           "
echo "==================================="

# 1. Build Server
echo "[1/4] Building Server..."
cd /home/mriza/Projects/prism/server
go build -o prism-server cmd/server/main.go
echo "Server built."

# 2. Build Agent
echo "[2/4] Building Agent..."
cd /home/mriza/Projects/prism/agent
go build -o prism-agent cmd/agent/*.go
echo "Agent built."

# We assume the VM is named prism-all-in-one in QEMU.
# Dynamically resolving the IP to use for Frontend build and deployment.
VM_IP=$(virsh -c qemu:///system domifaddr prism-all-in-one | grep -E -o "([0-9]{1,3}[\.]){3}[0-9]{1,3}" | head -n 1)

if [ -z "$VM_IP" ]; then
    echo "ERROR: Could not find IP for VM prism-all-in-one. Ensure it is running."
    exit 1
fi
echo "Detected VM IP: $VM_IP"

# 3. Build Frontend
echo "[3/4] Building Frontend..."
cd /home/mriza/Projects/prism/frontend
# Build using relative paths (no VITE_HUB_URL)
npm run build
echo "Frontend built."

# 4. Package and Deploy
echo "[4/4] Packaging and Deploying..."
cd /home/mriza/Projects/prism
rm -f prism_deploy.tar.gz
# Include the built frontend 'dist' directory
tar -czf prism_deploy.tar.gz -C server prism-server -C ../agent prism-agent -C ../frontend dist

export SSHPASS="$VM_PASS"

echo "Deploying to VM at IP: $VM_IP"

# Transfer Tarball
sshpass -e scp -o StrictHostKeyChecking=no prism_deploy.tar.gz ${VM_USER}@${VM_IP}:/tmp/prism_deploy.tar.gz

# Extract and Restart Services on VM
sshpass -e ssh -o StrictHostKeyChecking=no ${VM_USER}@${VM_IP} << EOF
    sudo -S <<< "$VM_PASS" mkdir -p $DST_DIR/server $DST_DIR/agent $DST_DIR/frontend
    
    echo "Extracting payload..."
    sudo -S <<< "$VM_PASS" tar -xzf /tmp/prism_deploy.tar.gz -C /tmp/
    
    echo "Placing binaries..."
    sudo -S <<< "$VM_PASS" mv /tmp/prism-server $DST_DIR/server/
    sudo -S <<< "$VM_PASS" mv /tmp/prism-agent $DST_DIR/agent/
    sudo -S <<< "$VM_PASS" rm -rf $DST_DIR/frontend/dist
    sudo -S <<< "$VM_PASS" mv /tmp/dist $DST_DIR/frontend/dist
    
    sudo -S <<< "$VM_PASS" chmod +x $DST_DIR/server/prism-server
    sudo -S <<< "$VM_PASS" chmod +x $DST_DIR/agent/prism-agent
    
    echo "Fixing permissions for prism user..."
    sudo -S <<< "$VM_PASS" chown -R $VM_USER:$VM_USER $DST_DIR
    sudo -S <<< "$VM_PASS" chmod -R 775 $DST_DIR
    
    echo "Configuring Nginx Reverse Proxy..."
    sudo -S <<< "$VM_PASS" tee /etc/nginx/sites-available/default > /dev/null << 'NGINX'
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    root /opt/prism/frontend/dist;
    index index.html;
    server_name _;
    
    # Static files routing
    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # API Reverse Proxy
    location /api/ {
        proxy_pass http://127.0.0.1:65432;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # Internal Agent WebSocket Proxy
    location /agent/connect {
        proxy_pass http://127.0.0.1:65432;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host \$host;
    }
}
NGINX

    # Ensure only the default site is enabled to prevent conflicts
    echo "Linking Nginx sites..."
    sudo -S <<< "$VM_PASS" rm -f /etc/nginx/sites-enabled/*
    sudo -S <<< "$VM_PASS" ln -s /etc/nginx/sites-available/default /etc/nginx/sites-enabled/default
    
    echo "Restarting services..."
    sudo -S <<< "$VM_PASS" systemctl restart prism-server || echo "Failed to restart server"
    sudo -S <<< "$VM_PASS" systemctl restart prism-agent || echo "Failed to restart agent"
    sudo -S <<< "$VM_PASS" systemctl restart nginx || echo "Failed to restart nginx"
    
    echo "Deployment successful."
EOF

echo "All components deployed successfully!"
