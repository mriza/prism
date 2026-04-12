#!/bin/bash

# PRISM Agent Installer Script
# Downloads the latest agent binary from GitHub Releases and installs it as a systemd service
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/prism/prism/main/scripts/prism_install_agent.sh -o prism_install_agent.sh
#   chmod +x prism_install_agent.sh
#   sudo ./prism_install_agent.sh

set -e

# Configuration
REPO_OWNER="prism"
REPO_NAME="prism"
BINARY_NAME="prism-agent"
SERVICE_NAME="prism-agent"
INSTALL_DIR="/opt/prism"
BIN_DIR="${INSTALL_DIR}/bin"
CONFIG_DIR="${INSTALL_DIR}/config"
DATA_DIR="${INSTALL_DIR}/data"
PRISM_USER="prism"
PRISM_GROUP="prism"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_root() {
    if [[ $EUID -ne 0 ]]; then
        log_error "This script must be run as root (use sudo)"
        exit 1
    fi
}

check_systemd() {
    if ! command -v systemctl &> /dev/null; then
        log_error "systemd is required but not found on this system"
        exit 1
    fi
}

detect_arch() {
    local arch=$(uname -m)
    case $arch in
        x86_64)  echo "amd64" ;;
        aarch64) echo "arm64" ;;
        armv7l)  echo "arm" ;;
        *)
            log_error "Unsupported architecture: $arch"
            exit 1
            ;;
    esac
}

detect_os() {
    local os=$(uname -s | tr '[:upper:]' '[:lower:]')
    case $os in
        linux) echo "linux" ;;
        *)
            log_error "Unsupported OS: $os"
            exit 1
            ;;
    esac
}

get_latest_release() {
    local release_url="https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest"
    log_info "Fetching latest release information..."

    local response
    response=$(curl -s "$release_url")

    if [[ $? -ne 0 ]]; then
        log_error "Failed to fetch release information"
        exit 1
    fi

    local tag_name
    tag_name=$(echo "$response" | grep -o '"tag_name": *"[^"]*"' | cut -d'"' -f4)

    if [[ -z "$tag_name" ]]; then
        log_error "Could not determine latest release version"
        exit 1
    fi

    echo "$tag_name"
}

download_binary() {
    local version=$1
    local arch=$(detect_arch)
    local os=$(detect_os)
    local asset_name="${BINARY_NAME}-${os}-${arch}"
    local download_url="https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/download/${version}/${asset_name}"

    log_info "Downloading ${BINARY_NAME} ${version} for ${os}/${arch}..."
    log_info "URL: ${download_url}"

    # Create install directory
    mkdir -p "$BIN_DIR"

    # Download binary
    local temp_file="/tmp/${BINARY_NAME}"
    if curl -fsSL -o "$temp_file" "$download_url"; then
        chmod +x "$temp_file"
        mv "$temp_file" "${BIN_DIR}/${BINARY_NAME}"
        log_success "Binary downloaded successfully"
    else
        log_error "Failed to download binary from ${download_url}"
        exit 1
    fi
}

create_prism_user() {
    log_info "Creating prism system user..."

    if id "$PRISM_USER" &>/dev/null; then
        log_info "User '${PRISM_USER}' already exists"
    else
        useradd --system \
            --home-dir /opt/prism \
            --shell /bin/false \
            --comment "PRISM Agent Service User" \
            "$PRISM_USER" 2>/dev/null || {
            # Fallback for systems without useradd
            adduser --system \
                --home /opt/prism \
                --shell /bin/false \
                --disabled-password \
                --comment "PRISM Agent Service User" \
                "$PRISM_USER" 2>/dev/null || {
                log_error "Failed to create prism user"
                exit 1
            }
        }
        log_success "User '${PRISM_USER}' created"
    fi
}

set_permissions() {
    log_info "Setting file permissions..."

    # Create directories
    mkdir -p "$CONFIG_DIR" "$DATA_DIR"

    # Set ownership
    chown -R "${PRISM_USER}:${PRISM_GROUP}" "$INSTALL_DIR"

    # Set permissions
    chmod 750 "$INSTALL_DIR"
    chmod 750 "$BIN_DIR"
    chmod 750 "$CONFIG_DIR"
    chmod 750 "$DATA_DIR"
    chmod 750 "${BIN_DIR}/${BINARY_NAME}"

    log_success "Permissions set"
}

create_systemd_service() {
    log_info "Creating systemd service..."

    local service_file="/etc/systemd/system/${SERVICE_NAME}.service"

    cat > "$service_file" << EOF
[Unit]
Description=PRISM Agent - Infrastructure Management
Documentation=https://github.com/${REPO_OWNER}/${REPO_NAME}
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=${PRISM_USER}
Group=${PRISM_GROUP}
ExecStart=${BIN_DIR}/${BINARY_NAME} --config ${CONFIG_DIR}/agent.toml
Restart=on-failure
RestartSec=5
StartLimitInterval=60s
StartLimitBurst=3

# Security settings
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=${DATA_DIR} ${CONFIG_DIR}
PrivateTmp=true

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=${SERVICE_NAME}

[Install]
WantedBy=multi-user.target
EOF

    log_success "Systemd service created at ${service_file}"
}

create_default_config() {
    local config_file="${CONFIG_DIR}/agent.toml"

    if [[ -f "$config_file" ]]; then
        log_info "Configuration file already exists at ${config_file}"
        return
    fi

    log_info "Creating default configuration..."

    cat > "$config_file" << 'EOF'
# PRISM Agent Configuration

[agent]
# Hub URL - The WebSocket endpoint of your PRISM Hub
hub_url = "ws://localhost:8080"

# Enrollment key - One-time use key for registration
enrollment_key = ""

# Agent ID - Auto-generated if empty
agent_id = ""

[logging]
# Log level: debug, info, warn, error
level = "info"

# Log file path (empty for stdout only)
file = ""

[system]
# Heartbeat interval in seconds
heartbeat_interval = 15

# Service discovery interval in seconds
discovery_interval = 60
EOF

    chown "${PRISM_USER}:${PRISM_GROUP}" "$config_file"
    chmod 640 "$config_file"

    log_success "Default configuration created at ${config_file}"
    log_warn "Please update the hub_url and enrollment_key in ${config_file}"
}

enable_and_start_service() {
    log_info "Enabling and starting ${SERVICE_NAME} service..."

    # Reload systemd daemon
    systemctl daemon-reload

    # Enable service (start on boot)
    systemctl enable "$SERVICE_NAME"

    # Start service
    if systemctl start "$SERVICE_NAME"; then
        log_success "${SERVICE_NAME} service started successfully"
    else
        log_warn "Failed to start service. You may need to configure it first."
        log_warn "Check logs with: journalctl -u ${SERVICE_NAME} -f"
    fi
}

print_next_steps() {
    echo ""
    log_success "=========================================="
    log_success "  PRISM Agent Installation Complete!"
    log_success "=========================================="
    echo ""
    echo "Next steps:"
    echo ""
    echo "1. Edit the configuration file:"
    echo "   sudo nano ${CONFIG_DIR}/agent.toml"
    echo ""
    echo "2. Update the following settings:"
    echo "   - hub_url: WebSocket URL of your PRISM Hub"
    echo "   - enrollment_key: One-time registration key from the Hub"
    echo ""
    echo "3. Restart the agent:"
    echo "   sudo systemctl restart ${SERVICE_NAME}"
    echo ""
    echo "4. Check the agent status:"
    echo "   sudo systemctl status ${SERVICE_NAME}"
    echo ""
    echo "5. View logs:"
    echo "   journalctl -u ${SERVICE_NAME} -f"
    echo ""
    echo "6. Register with Hub (if not using config file):"
    echo "   prism-agent register --hub <hub-url> --key <enrollment-key>"
    echo ""
    echo "Documentation: https://github.com/${REPO_OWNER}/${REPO_NAME}"
    echo ""
}

# Main installation flow
main() {
    echo ""
    log_info "=========================================="
    log_info "  PRISM Agent Installer"
    log_info "=========================================="
    echo ""

    # Pre-flight checks
    check_root
    check_systemd

    # Get latest release
    local version
    version=$(get_latest_release)
    log_info "Latest version: ${version}"

    # Download binary
    download_binary "$version"

    # Create user
    create_prism_user

    # Set permissions
    set_permissions

    # Create service
    create_systemd_service

    # Create config
    create_default_config

    # Enable and start
    enable_and_start_service

    # Print next steps
    print_next_steps
}

# Run main
main
