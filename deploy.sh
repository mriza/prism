#!/bin/bash

# PRISM Multi-Server Interactive Deployer
# Versi: 2.1 (Multi-OS & GitHub Support & Token Sync)

echo "================================================="
echo "   PRISM Interactive Target Deployment Wizard     "
echo "================================================="
echo "Skrip ini akan menginstal komponen PRISM pada server"
echo "dengan mengunduh build artifact langsung dari GitHub."
echo ""

# --- Configuration ---
GITHUB_REPO="mriza/prism" # Default repository
RELEASE_TAG="latest"      # Default tag

read -p "Masukkan URL GitHub Repo (Default: $GITHUB_REPO): " INPUT_REPO
[ -n "$INPUT_REPO" ] && GITHUB_REPO=$INPUT_REPO

read -p "Masukkan Tag/Versi (Default: $RELEASE_TAG): " INPUT_TAG
[ -n "$INPUT_TAG" ] && RELEASE_TAG=$INPUT_TAG

# --- Target Information ---
read -p "Target Server IP: " TARGET_IP
read -p "SSH Username: " TARGET_USER
read -p "SSH Password or Key Path: " TARGET_AUTH

# Helper for executing SSH/SCP
execute_remote() {
    local CMD=$1
    if [ -n "$TARGET_AUTH" ] && [ -f "$TARGET_AUTH" ]; then
        ssh -i "$TARGET_AUTH" -o StrictHostKeyChecking=no $TARGET_USER@$TARGET_IP "$CMD"
    elif [ -n "$TARGET_AUTH" ]; then
        export SSHPASS="$TARGET_AUTH"
        sshpass -e ssh -o StrictHostKeyChecking=no $TARGET_USER@$TARGET_IP "$CMD"
    else
        ssh -o StrictHostKeyChecking=no $TARGET_USER@$TARGET_IP "$CMD"
    fi
}

execute_remote_sudo() {
    local CMD=$1
    if [ -n "$TARGET_AUTH" ] && [ -f "$TARGET_AUTH" ]; then
        ssh -i "$TARGET_AUTH" -o StrictHostKeyChecking=no $TARGET_USER@$TARGET_IP "sudo $CMD"
    elif [ -n "$TARGET_AUTH" ]; then
        export SSHPASS="$TARGET_AUTH"
        sshpass -e ssh -o StrictHostKeyChecking=no $TARGET_USER@$TARGET_IP "sudo $CMD"
    else
        ssh -o StrictHostKeyChecking=no $TARGET_USER@$TARGET_IP "sudo $CMD"
    fi
}

echo "========================================="
echo "       MEMULAI PROSES DEPLOYMENT         "
echo "========================================="

# 1. Hubungkan ke server dan deteksi OS
echo "[1/4] Mendeteksi Sistem Operasi di Server..."
REMOTE_OS=$(execute_remote "grep '^ID=' /etc/os-release | cut -d= -f2 | tr -d '\"'")
echo "Server OS: $REMOTE_OS"

# 2. Persiapkan Folder
echo "[2/4] Menyiapkan environment di server..."
execute_remote "sudo mkdir -p /opt/prism/server /opt/prism/agent /opt/prism/frontend"

# 3. Unduh dari GitHub
echo "[3/4] Mengunduh artifact dari GitHub di server..."
# Link download diasumsikan mengikuti pola release GitHub
DOWNLOAD_URL="https://github.com/$GITHUB_REPO/releases/download/$RELEASE_TAG/prism_deploy.tar.gz"
if [ "$RELEASE_TAG" == "latest" ]; then
    DOWNLOAD_URL="https://github.com/$GITHUB_REPO/releases/latest/download/prism_deploy.tar.gz"
fi

execute_remote "sudo curl -L $DOWNLOAD_URL -o /tmp/prism_deploy.tar.gz"

# 4. Ekstrak dan Konfigurasi
echo "[4/4] Mengekstrak dan mengonfigurasi layanan..."
execute_remote << 'EOF'
    set -e
    # Deteksi OS lagi di dalam shell remote
    OS=$(grep '^ID=' /etc/os-release | cut -d= -f2 | tr -d '"')

    sudo tar -xzf /tmp/prism_deploy.tar.gz -C /tmp/

    # Pindahkan binary
    [ -f /tmp/prism-server ] && sudo mv /tmp/prism-server /opt/prism/server/prism-server
    [ -f /tmp/prism-server.conf ] && sudo mv /tmp/prism-server.conf /opt/prism/server/
    [ -f /tmp/prism-agent ] && sudo mv /tmp/prism-agent /opt/prism/agent/prism-agent
    [ -f /tmp/prism-agent.conf ] && sudo mv /tmp/prism-agent.conf /opt/prism/agent/
    [ -d /tmp/dist ] && (sudo rm -rf /opt/prism/frontend/dist; sudo mv /tmp/dist /opt/prism/frontend/dist)

    sudo chmod +x /opt/prism/server/prism-server 2>/dev/null || true
    sudo chmod +x /opt/prism/agent/prism-agent 2>/dev/null || true

    # Install systemd services
    [ -f /tmp/prism-server.service ] && sudo mv /tmp/prism-server.service /etc/systemd/system/
    [ -f /tmp/prism-agent.service ] && sudo mv /tmp/prism-agent.service /etc/systemd/system/
    sudo systemctl daemon-reload
    sudo systemctl enable prism-server 2>/dev/null || true
    sudo systemctl enable prism-agent 2>/dev/null || true

    # Nginx Configuration
    case "$OS" in
        ubuntu|debian)
            NGINX_CONF="/etc/nginx/sites-available/default"
            NGINX_LINK="/etc/nginx/sites-enabled/default"
            ;;
        fedora|rocky|almalinux|rhel)
            NGINX_CONF="/etc/nginx/conf.d/prism.conf"
            NGINX_LINK=""
            ;;
    esac

    echo "Configuring Nginx ($NGINX_CONF)..."
    sudo tee $NGINX_CONF > /dev/null << 'NGINX'
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

    if [ -n "$NGINX_LINK" ]; then
        sudo ln -sf $NGINX_CONF $NGINX_LINK
    fi

    # Firewall
    if command -v ufw >/dev/null; then
        sudo ufw allow 80/tcp 2>/dev/null || true
        sudo ufw allow 65432/tcp 2>/dev/null || true
    elif command -v firewall-cmd >/dev/null; then
        sudo firewall-cmd --permanent --add-port=80/tcp 2>/dev/null || true
        sudo firewall-cmd --permanent --add-port=65432/tcp 2>/dev/null || true
        sudo firewall-cmd --reload 2>/dev/null || true
    fi

    # Restart services
    echo "Restarting services..."
    sudo systemctl restart nginx 2>/dev/null || true
    sudo systemctl restart prism-server 2>/dev/null || true
    
    # Wait for server to initialize
    echo "Waiting for server to initialize..."
    sleep 10
    
    # Sync token
    echo "Syncing agent token with server..."
    SERVER_TOKEN=$(sudo grep "^token =" /opt/prism/server/prism-server.conf | head -1 | sed 's/token *= *//;s/^["'\'']//;s/["'\'']$//' | tr -d ' ')
    
    if [ -n "$SERVER_TOKEN" ]; then
        sudo sed -i "s|^token = .*|token = '$SERVER_TOKEN'|" /opt/prism/agent/prism-agent.conf
        echo "Token synced successfully"
        sudo systemctl restart prism-agent 2>/dev/null || true
    else
        echo "Warning: Could not sync token automatically"
    fi
    
    echo "Deployment completed!"
EOF

echo "========================================="
echo "   DEPLOYMENT SELESAI DENGAN SUKSES!     "
echo "========================================="
echo ""
echo "Akses dashboard di: http://$TARGET_IP"
echo "Server API: http://$TARGET_IP:65432"
echo ""
