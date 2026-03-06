#!/bin/bash
set -e

REMOTE_USER="mriza"
REMOTE_HOST="192.168.122.120"
REMOTE_PASS="123"
REMOTE_DIR="/home/mriza/fitz"

echo "Deploying to $REMOTE_USER@$REMOTE_HOST..."

# Check if sshpass is installed
if ! command -v sshpass &> /dev/null; then
    echo "sshpass could not be found. Please install it with 'sudo apt install sshpass'"
    exit 1
fi

export SSHPASS="$REMOTE_PASS"

# Helper to run remote command
remote_exec() {
    sshpass -e ssh -o StrictHostKeyChecking=no "$REMOTE_USER@$REMOTE_HOST" "$1"
}

# Helper to run remote Sudo command
remote_sudo() {
    sshpass -e ssh -o StrictHostKeyChecking=no "$REMOTE_USER@$REMOTE_HOST" "echo '$REMOTE_PASS' | sudo -S $1"
}

# 1. Create Directories
echo "Creating remote directories..."
remote_sudo "mkdir -p $REMOTE_DIR/{server,agent,frontend}"
remote_sudo "chown -R $REMOTE_USER:$REMOTE_USER $REMOTE_DIR"

# 2. Sync Source Code (Exclude huge dirs if possible, but user said node/go is there, so we build there)
# We'll rely on rsync if available, else scp
echo "Syncing source code..."
sshpass -e rsync -av --exclude 'node_modules' --exclude 'dist' --exclude '.git' ./server/ "$REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/server/"
sshpass -e rsync -av --exclude 'dist' --exclude '.git' ./agent/ "$REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/agent/"
sshpass -e rsync -av --exclude 'node_modules' --exclude 'dist' --exclude '.git' ./frontend/ "$REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/frontend/"

# 3. Remote Build
echo "Building on remote server..."
remote_exec "cd $REMOTE_DIR/server && /usr/local/go/bin/go build -o fitz-server cmd/server/main.go"
remote_exec "cd $REMOTE_DIR/agent && /usr/local/go/bin/go build -o fitz-agent cmd/agent/main.go cmd/agent/handlers.go"
remote_exec "cd $REMOTE_DIR/frontend && npm install && npm run build"

# 4. Setup Static Files for Server
remote_exec "ln -sfn $REMOTE_DIR/frontend/dist $REMOTE_DIR/server/dist"

# 5. Install Systemd Services
echo "Updating Systemd Services..."
# Fix paths in service files if needed or rely on hardcoded /home/mriza/fitz
# We uploaded them with source to $REMOTE_DIR/server/fitz-server.service
remote_sudo "cp $REMOTE_DIR/server/fitz-server.service /etc/systemd/system/"
remote_sudo "cp $REMOTE_DIR/agent/fitz-agent.service /etc/systemd/system/"
remote_sudo "systemctl daemon-reload"

# 6. Restart Services
echo "Restarting Services..."
remote_sudo "systemctl enable --now fitz-server"
remote_sudo "systemctl enable --now fitz-agent"
remote_sudo "systemctl restart fitz-server fitz-agent"

echo "Deployment Complete!"
echo "Server URL: http://$REMOTE_HOST:65432"
