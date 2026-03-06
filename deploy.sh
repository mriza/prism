#!/bin/bash

# PRISM Multi-Server Interactive Deployer
echo "================================================="
echo "   PRISM Interactive Target Deployment Wizard     "
echo "================================================="
echo "Skrip ini akan mendistribusikan masing-masing komponen"
echo "PRISM ke server yang Anda tentukan secara spesifik."
echo ""

# Helper for executing SSH/SCP based on Auth Type
execute_remote() {
    local TYPE=$1    # ssh or scp
    local SERVER=$2
    local USER=$3
    local AUTH=$4
    local CMD=$5
    local EXTRA=$6

    local SSH_CMD="ssh -o StrictHostKeyChecking=no"
    local SCP_CMD="scp -o StrictHostKeyChecking=no"

    if [ -n "$AUTH" ]; then
        if [ -f "$AUTH" ]; then
            SSH_CMD="ssh -i $AUTH -o StrictHostKeyChecking=no"
            SCP_CMD="scp -i $AUTH -o StrictHostKeyChecking=no"
        else
            export SSHPASS="$AUTH"
            SSH_CMD="sshpass -e ssh -o StrictHostKeyChecking=no"
            SCP_CMD="sshpass -e scp -o StrictHostKeyChecking=no"
        fi
    fi

    if [ "$TYPE" == "ssh" ]; then
        eval $SSH_CMD $USER@$SERVER "$CMD"
    elif [ "$TYPE" == "scp" ]; then
        eval $SCP_CMD $EXTRA $CMD
    elif [ "$TYPE" == "scp_dest" ]; then
        # For sending files: CMD is local file, EXTRA is remote path
        eval $SCP_CMD $EXTRA $CMD $USER@$SERVER:$EXTRA
    fi
}

echo "Pilih Topologi Deployment:"
echo "[1] Single Server (Hub, Frontend, dan Agent ke 1 IP yang sama)"
echo "[2] Distributed Servers (Setiap komponen ke IP yang berbeda-beda)"
read -p "Pilih [1/2]: " TOPO_TYPE
echo ""

if [ "$TOPO_TYPE" == "1" ]; then
    read -p "Target IP for All Components: " ALL_IP
    read -p "SSH Username ($ALL_IP): " ALL_USER
    read -p "SSH Password or Key Path (Leave blank for default SSH keys): " ALL_AUTH
    echo ""
fi

# Ask which components to deploy
# --- HUB ---
read -p "Apakah Anda ingin mendeploy BACKEND (HUB)? [y/N]: " DEPLOY_HUB
if [[ "$DEPLOY_HUB" =~ ^[Yy]$ ]]; then
    if [ "$TOPO_TYPE" == "1" ]; then
        HUB_IP=$ALL_IP; HUB_USER=$ALL_USER; HUB_AUTH=$ALL_AUTH
    else
        echo "--- [1] BACKEND (HUB) DEPLOYMENT ---"
        read -p "Target IP for Hub Server: " HUB_IP
        read -p "SSH Username for Hub ($HUB_IP): " HUB_USER
        read -p "SSH Password or Key Path: " HUB_AUTH
        echo ""
    fi
else
    HUB_IP=""
fi

# --- FRONTEND ---
read -p "Apakah Anda ingin mendeploy FRONTEND (WEB UI)? [y/N]: " DEPLOY_FE
if [[ "$DEPLOY_FE" =~ ^[Yy]$ ]]; then
    if [ "$TOPO_TYPE" == "1" ]; then
        FE_IP=$ALL_IP; FE_USER=$ALL_USER; FE_AUTH=$ALL_AUTH
    else
        echo "--- [2] FRONTEND (WEB UI) DEPLOYMENT ---"
        read -p "Target IP for Frontend Server: " FE_IP
        read -p "SSH Username for Frontend ($FE_IP): " FE_USER
        read -p "SSH Password or Key Path: " FE_AUTH
        echo ""
    fi
else
    FE_IP=""
fi

# --- AGENT ---
read -p "Apakah Anda ingin mendeploy AGENT? [y/N]: " DEPLOY_AGENT
if [[ "$DEPLOY_AGENT" =~ ^[Yy]$ ]]; then
    if [ "$TOPO_TYPE" == "1" ]; then
        AGENT_IP=$ALL_IP; AGENT_USER=$ALL_USER; AGENT_AUTH=$ALL_AUTH
    else
        echo "--- [3] AGENT DEPLOYMENT ---"
        read -p "Target IP for Agent Server: " AGENT_IP
        read -p "SSH Username for Agent ($AGENT_IP): " AGENT_USER
        read -p "SSH Password or Key Path: " AGENT_AUTH
        echo ""
    fi
else
    AGENT_IP=""
fi

echo "================================================="
echo "               STARTING DEPLOYMENT               "
echo "================================================="

# --- 1. DEPLOY HUB ---
if [ -n "$HUB_IP" ]; then
    echo "[->] Building Hub Server..."
    cd server || exit
    go build -o server_bin cmd/server/main.go
    cd ..

    echo "[->] Transferring Hub to $HUB_IP..."
    if [ -n "$HUB_AUTH" ] && [ ! -f "$HUB_AUTH" ]; then
        export SSHPASS="$HUB_AUTH"
        sshpass -e scp -o StrictHostKeyChecking=no server/server_bin $HUB_USER@$HUB_IP:/tmp/prism-server
        sshpass -e ssh -o StrictHostKeyChecking=no $HUB_USER@$HUB_IP "sudo -S <<< '$HUB_AUTH' mkdir -p /opt/prism/server && sudo -S <<< '$HUB_AUTH' mv /tmp/prism-server /opt/prism/server/prism-server && sudo -S <<< '$HUB_AUTH' chmod +x /opt/prism/server/prism-server && sudo -S <<< '$HUB_AUTH' ufw allow 65432/tcp && sudo -S <<< '$HUB_AUTH' systemctl restart prism-server"
    elif [ -f "$HUB_AUTH" ]; then
        scp -i "$HUB_AUTH" -o StrictHostKeyChecking=no server/server_bin $HUB_USER@$HUB_IP:/tmp/prism-server
        ssh -i "$HUB_AUTH" -o StrictHostKeyChecking=no $HUB_USER@$HUB_IP "sudo mkdir -p /opt/prism/server && sudo mv /tmp/prism-server /opt/prism/server/prism-server && sudo chmod +x /opt/prism/server/prism-server && sudo ufw allow 65432/tcp && sudo systemctl restart prism-server"
    else
        scp -o StrictHostKeyChecking=no server/server_bin $HUB_USER@$HUB_IP:/tmp/prism-server
        ssh -o StrictHostKeyChecking=no $HUB_USER@$HUB_IP "sudo mkdir -p /opt/prism/server && sudo mv /tmp/prism-server /opt/prism/server/prism-server && sudo chmod +x /opt/prism/server/prism-server && sudo ufw allow 65432/tcp && sudo systemctl restart prism-server"
    fi
    echo "[!] Hub successfully deployed to $HUB_IP!"
else
    echo "[SKIPPED] Hub Deployment"
fi

echo ""

# --- 2. DEPLOY FRONTEND ---
if [ -n "$FE_IP" ]; then
    echo "[->] Configuring Frontend..."
    cd frontend || exit
    
    # Inject dynamic Hub URL pointing to the newly configured HUB_IP
    if [ -n "$HUB_IP" ]; then
        echo "Updating .env.production to point to http://$HUB_IP:65432"
        echo "VITE_HUB_URL=http://$HUB_IP:65432" > .env.production
    fi

    echo "[->] Building Frontend..."
    npm run build
    cd ..

    echo "[->] Transferring Frontend to $FE_IP..."
    if [ -n "$FE_AUTH" ] && [ ! -f "$FE_AUTH" ]; then
        export SSHPASS="$FE_AUTH"
        sshpass -e scp -r -o StrictHostKeyChecking=no frontend/dist $FE_USER@$FE_IP:/tmp/dist
        sshpass -e ssh -o StrictHostKeyChecking=no $FE_USER@$FE_IP "sudo -S <<< '$FE_AUTH' mkdir -p /opt/prism/frontend && sudo -S <<< '$FE_AUTH' rm -rf /opt/prism/frontend/dist && sudo -S <<< '$FE_AUTH' mv /tmp/dist /opt/prism/frontend/dist"
    elif [ -f "$FE_AUTH" ]; then
        scp -i "$FE_AUTH" -r -o StrictHostKeyChecking=no frontend/dist $FE_USER@$FE_IP:/tmp/dist
        ssh -i "$FE_AUTH" -o StrictHostKeyChecking=no $FE_USER@$FE_IP "sudo mkdir -p /opt/prism/frontend && sudo rm -rf /opt/prism/frontend/dist && sudo mv /tmp/dist /opt/prism/frontend/dist"
    else
        scp -r -o StrictHostKeyChecking=no frontend/dist $FE_USER@$FE_IP:/tmp/dist
        ssh -o StrictHostKeyChecking=no $FE_USER@$FE_IP "sudo mkdir -p /opt/prism/frontend && sudo rm -rf /opt/prism/frontend/dist && sudo mv /tmp/dist /opt/prism/frontend/dist"
    fi
    echo "[!] Frontend successfully deployed to $FE_IP (/opt/prism/frontend/dist)!"
else
    echo "[SKIPPED] Frontend Deployment"
fi

echo ""

# --- 3. DEPLOY AGENT ---
if [ -n "$AGENT_IP" ]; then
    echo "[->] Building Agent..."
    cd agent || exit
    go build -o agent_bin cmd/agent/*.go
    cd ..
    
    # We ask for a secret HUB Token locally if HUB_IP is set.
    AGENT_HUB_URL="ws://$HUB_IP:65432/agent/connect"
    if [ -z "$HUB_IP" ]; then
        read -p "Hub IP wasn't provided earlier. Enter full Hub Socket URL (e.g. ws://10.0.0.1:65432/agent/connect): " AGENT_HUB_URL
    fi
    read -p "Enter securing HUB_TOKEN for this Agent to register: " AGENT_HUB_TOKEN
    
    echo "[->] Transferring Agent logic to $AGENT_IP..."
    if [ -n "$AGENT_AUTH" ]; then
        if [ -f "$AGENT_AUTH" ]; then
            SSH_CMD="ssh -i $AGENT_AUTH -o StrictHostKeyChecking=no"
            SCP_CMD="scp -i $AGENT_AUTH -o StrictHostKeyChecking=no"
            HAS_PASS=false
        else
            export SSHPASS="$AGENT_AUTH"
            SSH_CMD="sshpass -e ssh -o StrictHostKeyChecking=no"
            SCP_CMD="sshpass -e scp -o StrictHostKeyChecking=no"
            HAS_PASS=true
        fi
    else
        SSH_CMD="ssh -o StrictHostKeyChecking=no"
        SCP_CMD="scp -o StrictHostKeyChecking=no"
        HAS_PASS=false
    fi

    $SCP_CMD agent/agent_bin $AGENT_USER@$AGENT_IP:/tmp/prism-agent

    echo "[->] Generating Systemd configuration and provisioning environment..."
    eval $SSH_CMD $AGENT_USER@$AGENT_IP << EOF
        if [ "$HAS_PASS" = true ]; then
            SUDO_CMD="sudo -S <<< '$AGENT_AUTH'"
        else
            SUDO_CMD="sudo"
        fi
        
        eval \$SUDO_CMD mkdir -p /opt/prism/agent
        eval \$SUDO_CMD mv /tmp/prism-agent /opt/prism/agent/prism-agent
        eval \$SUDO_CMD chmod +x /opt/prism/agent/prism-agent
        eval \$SUDO_CMD mkdir -p /etc/prism
        cd /etc/prism
        eval \$SUDO_CMD /opt/prism/agent/prism-agent -generate-config
        eval \$SUDO_CMD sed -i 's|URL = ".*"|URL = "$AGENT_HUB_URL"|g' /etc/prism/prism-agent.conf
        eval \$SUDO_CMD sed -i "s|Token = .*|Token = '$AGENT_HUB_TOKEN'|g" /etc/prism/prism-agent.conf
        
        eval \$SUDO_CMD bash -c 'cat > /etc/systemd/system/prism-agent.service <<SERVICE_EOF
[Unit]
Description=PRISM Node Agent
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/prism/agent
ExecStart=/opt/prism/agent/prism-agent -config=/etc/prism/prism-agent.conf
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
SERVICE_EOF'
        eval \$SUDO_CMD systemctl daemon-reload
        eval \$SUDO_CMD systemctl enable prism-agent
        eval \$SUDO_CMD systemctl restart prism-agent
EOF
    echo "[!] Agent successfully provisioned on $AGENT_IP!"
else
    echo "[SKIPPED] Agent Deployment"
fi

echo "================================================="
echo "   DEPLOYMENT WIZARD COMPLETED!                  "
echo "================================================="
