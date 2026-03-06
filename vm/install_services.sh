#!/bin/bash
set -e

echo "Updating system packages..."
sudo apt-get update
sudo apt-get upgrade -y

echo "Installing requisite tools..."
sudo apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl wget gnupg software-properties-common ufw

echo "Installing Go, Nginx, MySQL, PostgreSQL, RabbitMQ, vsftpd..."
sudo apt-get install -y golang-go nginx mysql-server postgresql rabbitmq-server vsftpd

echo "Installing Node.js and PM2..."
if ! command -v pm2 &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
    sudo npm install -y -g pm2
fi

echo "Installing Caddy..."
if ! command -v caddy &> /dev/null; then
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
    sudo apt-get update
    sudo apt-get install -y caddy
fi

echo "Installing MongoDB..."
if ! command -v mongod &> /dev/null; then
    curl -fsSL https://www.mongodb.org/static/pgp/server-8.0.asc | sudo gpg -o /usr/share/keyrings/mongodb-server-8.0.gpg --dearmor
    echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-8.0.gpg ] https://repo.mongodb.org/apt/ubuntu noble/mongodb-org/8.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-8.0.list
    sudo apt-get update
    sudo apt-get install -y mongodb-org || echo "MongoDB install failed - continuing..."
    sudo systemctl start mongod || true
    sudo systemctl enable mongod || true
fi

echo "Installing MinIO server and client..."
if ! command -v minio &> /dev/null; then
    wget -qO minio https://dl.min.io/server/minio/release/linux-amd64/minio
    chmod +x minio
    sudo mv minio /usr/local/bin/
    
    wget -qO mc https://dl.min.io/client/mc/release/linux-amd64/mc
    chmod +x mc
    sudo mv mc /usr/local/bin/

    echo "Configuring MinIO service..."
    sudo useradd -r minio-user -s /sbin/nologin || true
    sudo mkdir -p /var/minio/data
    sudo chown minio-user:minio-user /var/minio/data

    cat << 'EOF' | sudo tee /etc/systemd/system/minio.service
[Unit]
Description=MinIO
Documentation=https://min.io/docs/minio/linux/index.html
Wants=network-online.target
After=network-online.target
AssertFileIsExecutable=/usr/local/bin/minio

[Service]
WorkingDirectory=/usr/local
User=minio-user
Group=minio-user
EnvironmentFile=-/etc/default/minio
ExecStart=/usr/local/bin/minio server $MINIO_OPTS $MINIO_VOLUMES
Restart=always
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
EOF

    cat << 'EOF' | sudo tee /etc/default/minio
MINIO_ROOT_USER=admin
MINIO_ROOT_PASSWORD=password
MINIO_OPTS="--console-address :9001"
MINIO_VOLUMES="/var/minio/data"
EOF

    sudo systemctl daemon-reload
    sudo systemctl start minio
    sudo systemctl enable minio
fi

echo "All services installed successfully!"
