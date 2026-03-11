#!/bin/bash

# PRISM Services Installer
# Supports: Debian, Ubuntu, Fedora, Rocky Linux, AlmaLinux
# Versi: 2.2 (Flat Menu - Individual Service Selection)

set -e

# --- Color Definitions ---
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}    PRISM Services Installer Wizard      ${NC}"
echo -e "${GREEN}=========================================${NC}"

# --- OS Detection ---
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
    VER=$VERSION_ID
else
    echo -e "${RED}Error: Cannot detect OS. /etc/os-release not found.${NC}"
    exit 1
fi

echo -e "Detected OS: ${YELLOW}$NAME $VERSION_ID${NC}"

# --- Package Manager abstraction ---
case "$OS" in
    ubuntu|debian)
        PKG_MANAGER="apt-get"
        PKG_INSTALL="$PKG_MANAGER install -y"
        PKG_UPDATE="$PKG_MANAGER update"
        FIREWALL="ufw"
        ;;
    fedora|rocky|almalinux|rhel)
        PKG_MANAGER="dnf"
        PKG_INSTALL="$PKG_MANAGER install -y"
        PKG_UPDATE="$PKG_MANAGER check-update || true"
        FIREWALL="firewalld"
        ;;
    *)
        echo -e "${RED}Unsupported OS: $OS${NC}"
        exit 1
        ;;
esac

# --- Initialization ---
echo -e "Updating package repository..."
sudo $PKG_UPDATE

# --- Helper Functions ---
install_package() {
    local PKG=$1
    echo -e "Installing ${YELLOW}$PKG${NC}..."
    sudo $PKG_INSTALL $PKG
}

configure_firewall() {
    local PORT=$1
    if [ "$FIREWALL" == "ufw" ]; then
        if hash ufw 2>/dev/null; then
            sudo ufw allow $PORT/tcp
        fi
    else
        if hash firewall-cmd 2>/dev/null; then
            sudo firewall-cmd --permanent --add-port=$PORT/tcp
            sudo firewall-cmd --reload
        fi
    fi
}

# --- Service Setup Functions ---

setup_vsftpd() {
    echo -e "${GREEN}Configuring VSFTPD for Virtual Users...${NC}"
    case "$OS" in
        ubuntu|debian) install_package "vsftpd libpam-db-util" ;;
        fedora|rocky|almalinux) install_package "vsftpd libdb-utils" ;;
    esac
    sudo mkdir -p /etc/vsftpd/user_config /var/ftp/virtual_users
    if ! id "ftpuser" &>/dev/null; then sudo useradd -r -s /sbin/nologin -d /var/ftp ftpuser; fi
    sudo chown ftpuser:ftpuser /var/ftp
    echo -e "auth required pam_userdb.so db=/etc/vsftpd/virtual_users\naccount required pam_userdb.so db=/etc/vsftpd/virtual_users" | sudo tee /etc/pam.d/vsftpd.virtual > /dev/null
    sudo tee /etc/vsftpd/vsftpd.conf > /dev/null <<EOF
anonymous_enable=NO
local_enable=YES
write_enable=YES
local_umask=022
dirmessage_enable=YES
xferlog_enable=YES
connect_from_port_20=YES
xferlog_std_format=YES
listen=YES
listen_ipv6=NO
pam_service_name=vsftpd.virtual
userlist_enable=YES
tcp_wrappers=YES
guest_enable=YES
guest_username=ftpuser
user_config_dir=/etc/vsftpd/user_config
virtual_use_local_privs=YES
pasv_enable=YES
pasv_min_port=40000
pasv_max_port=40100
EOF
    configure_firewall 21 && configure_firewall "40000-40100"
    sudo systemctl enable --now vsftpd
}

setup_sftpgo() {
    echo -e "${GREEN}Installing SFTPGo...${NC}"
    case "$OS" in
        ubuntu|debian)
            sudo apt-get install -y debian-keyring debian-archive-keyring apt-transport-https
            curl -1sLf 'https://dl.cloudsmith.io/public/sftpgo/sftpgo/cfg/gpg/gpg.107ED3645C06A982.key' | sudo gpg --dearmor -o /usr/share/keyrings/sftpgo-archive-keyring.gpg
            curl -1sLf "https://dl.cloudsmith.io/public/sftpgo/sftpgo/cfg/setup/config.deb.txt?distro=$OS&codename=$(lsb_release -cs)" | sudo tee /etc/apt/sources.list.d/sftpgo.list
            sudo apt-get update && install_package "sftpgo"
            ;;
        fedora|rocky|almalinux)
            curl -1sLf 'https://dl.cloudsmith.io/public/sftpgo/sftpgo/cfg/setup/config.rpm.txt?distro=el&codename=9' | sudo bash
            install_package "sftpgo"
            ;;
    esac
    configure_firewall 8080 && configure_firewall 2022
    sudo systemctl enable --now sftpgo
}

setup_mongodb() {
    echo -e "${GREEN}Setting up MongoDB Official Repository...${NC}"
    case "$OS" in
        ubuntu)
            sudo apt-get install -y gnupg curl
            curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor
            echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu $(lsb_release -cs)/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
            sudo apt-get update && install_package "mongodb-org"
            ;;
        debian)
            sudo apt-get install -y gnupg curl
            curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor
            echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/debian $(lsb_release -cs)/mongodb-org/7.0 main" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
            sudo apt-get update && install_package "mongodb-org"
            ;;
        fedora|rocky|almalinux)
            sudo tee /etc/yum.repos.d/mongodb-org-7.0.repo <<EOF
[mongodb-org-7.0]
name=MongoDB Repository
baseurl=https://repo.mongodb.org/yum/redhat/9/mongodb-org/7.0/x86_64/
gpgcheck=1
enabled=1
gpgkey=https://www.mongodb.org/static/pgp/server-7.0.asc
EOF
            install_package "mongodb-org"
            ;;
    esac
    sudo systemctl enable --now mongod
    configure_firewall 27017
}

setup_minio() {
    echo -e "${GREEN}Installing MinIO Binary...${NC}"
    sudo wget https://dl.min.io/server/minio/release/linux-amd64/minio -O /usr/local/bin/minio
    sudo chmod +x /usr/local/bin/minio
    sudo mkdir -p /etc/minio /var/lib/minio
    configure_firewall 9000 && configure_firewall 9001
}

setup_garage() {
    echo -e "${GREEN}Installing Garage S3 Binary...${NC}"
    sudo wget https://garagehq.rocks/_/linux-amd64/garage -O /usr/local/bin/garage
    sudo chmod +x /usr/local/bin/garage
    configure_firewall 3900 && configure_firewall 3901
}

setup_caddy() {
    case "$OS" in
        ubuntu|debian)
            sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
            curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
            curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.list' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
            sudo apt update && install_package "caddy"
            ;;
        fedora|rocky|almalinux)
            sudo dnf install -y 'dnf-command(copr)'
            sudo dnf copr enable -y @caddy/caddy
            install_package "caddy"
            ;;
    esac
    sudo systemctl enable --now caddy
    configure_firewall 80 && configure_firewall 443
}

setup_nodejs() {
    echo -e "${GREEN}Installing Node.js with 'n' for version management...${NC}"
    if ! hash node 2>/dev/null; then
        case "$OS" in
            ubuntu|debian)
                curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
                install_package "nodejs"
                ;;
            fedora|rocky|almalinux|rhel)
                sudo dnf module enable nodejs:20 -y 2>/dev/null || true
                install_package "nodejs"
                ;;
        esac
    fi
    sudo npm install -g n
    sudo n stable
    echo -e "Node.js version: $(node -v)"
}

# --- Main Menu (Flat) ---
while true; do
    echo -e "\n${YELLOW}PILIH LAYANAN UNTUK DIINSTAL:${NC}"
    echo " 1) MariaDB / MySQL"
    echo " 2) PostgreSQL"
    echo " 3) MongoDB (Official)"
    echo " 4) RabbitMQ"
    echo " 5) Mosquitto (MQTT)"
    echo " 6) MinIO (S3)"
    echo " 7) Garage (S3)"
    echo " 8) VSFTPD (Virtual Users)"
    echo " 9) SFTPGo"
    echo "10) Caddy Server"
    echo "11) Nginx"
    echo "12) Node.js + npm + n (System-wide)"
    echo "13) PM2"
    echo "14) Supervisor"
    echo " q) Selesai / Keluar"
    read -p "Masukkan pilihan [1-14, q]: " CHOICE
    
    case "$CHOICE" in
        1) install_package "mariadb-server"; sudo systemctl enable --now mariadb; configure_firewall 3306 ;;
        2) 
            install_package "postgresql-server" 2>/dev/null || install_package "postgresql"
            [ "$PKG_MANAGER" == "dnf" ] && sudo postgresql-setup --initdb || true
            sudo systemctl enable --now postgresql; configure_firewall 5432 ;;
        3) setup_mongodb ;;
        4) install_package "rabbitmq-server"; sudo systemctl enable --now rabbitmq-server; configure_firewall 5672; configure_firewall 15672 ;;
        5) install_package "mosquitto"; sudo systemctl enable --now mosquitto; configure_firewall 1883 ;;
        6) setup_minio ;;
        7) setup_garage ;;
        8) setup_vsftpd ;;
        9) setup_sftpgo ;;
        10) setup_caddy ;;
        11) install_package "nginx"; sudo systemctl enable --now nginx; configure_firewall 80; configure_firewall 443 ;;
        12) setup_nodejs ;;
        13) sudo npm install -g pm2 ;;
        14) install_package "supervisor"; sudo systemctl enable --now supervisor ;;
        q) break ;;
        *) echo "Pilihan tidak valid." ;;
    esac
done

echo -e "${GREEN}Proses instalasi selesai.${NC}"
