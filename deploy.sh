#!/bin/bash

# PRISM Deployment Script
# Downloads and deploys PRISM components from GitHub Releases
# Usage: sudo ./deploy.sh

set -e

# Configuration
REPO="mriza/prism"
BASE_DIR="/opt/prism"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
check_root() {
    if [ "$EUID" -ne 0 ]; then
        log_error "This script must be run as root (use sudo)"
        exit 1
    fi
}

# Check basic requirements
check_requirements() {
    log_info "Checking requirements..."
    
    local missing=()
    
    # Check curl
    if ! command -v curl &> /dev/null; then
        missing+=("curl")
    fi
    
    # Check jq
    if ! command -v jq &> /dev/null; then
        missing+=("jq")
    fi
    
    # Check tar
    if ! command -v tar &> /dev/null; then
        missing+=("tar")
    fi
    
    if [ ${#missing[@]} -gt 0 ]; then
        log_error "Missing required tools: ${missing[*]}"
        log_info "Please install them first:"
        log_info "  Ubuntu/Debian: sudo apt install ${missing[*]}"
        log_info "  CentOS/RHEL: sudo yum install ${missing[*]}"
        exit 1
    fi
    
    log_success "Requirements check passed!"
}

# Get current user (not root)
get_current_user() {
    # Get the actual user who invoked sudo
    if [ -n "$SUDO_USER" ]; then
        echo "$SUDO_USER"
    else
        echo "$USER"
    fi
}

# Get latest version from GitHub
get_version() {
    local version_type="${1:-latest}"
    
    log_info "Fetching version information from GitHub..."
    
    if [ "$version_type" = "latest" ]; then
        VERSION=$(curl -s "https://api.github.com/repos/$REPO/releases/latest" | jq -r '.tag_name')
        log_info "Latest version: $VERSION"
    elif [ "$version_type" = "stable" ]; then
        VERSION=$(curl -s "https://api.github.com/repos/$REPO/releases" | jq -r '[.[] | select(.prerelease == false)] | .[0].tag_name')
        log_info "Latest stable version: $VERSION"
    else
        VERSION="$version_type"
        log_info "Using specified version: $VERSION"
    fi
}

# Select component to deploy
select_component() {
    echo ""
    echo "Select component to deploy:"
    echo "  1) Server"
    echo "  2) Agent"
    echo "  3) Frontend"
    echo "  4) All components"
    echo ""
    
    while true; do
        read -p "Enter choice [1-4]: " choice
        case $choice in
            1)
                COMPONENTS="server"
                break
                ;;
            2)
                COMPONENTS="agent"
                break
                ;;
            3)
                COMPONENTS="frontend"
                break
                ;;
            4)
                COMPONENTS="all"
                break
                ;;
            *)
                log_error "Invalid choice. Please enter 1-4."
                ;;
        esac
    done
    
    log_info "Selected component(s): $COMPONENTS"
}

# Select version type
select_version() {
    echo ""
    echo "Select version to deploy:"
    echo "  1) Latest (including pre-release)"
    echo "  2) Latest stable"
    echo "  3) Specific version"
    echo ""
    
    while true; do
        read -p "Enter choice [1-3]: " choice
        case $choice in
            1)
                get_version "latest"
                break
                ;;
            2)
                get_version "stable"
                break
                ;;
            3)
                read -p "Enter version (e.g., v0.5.0): " ver
                VERSION="$ver"
                log_info "Using version: $VERSION"
                break
                ;;
            *)
                log_error "Invalid choice. Please enter 1-3."
                ;;
        esac
    done
}

# Download file from GitHub release
download_asset() {
    local filename="$1"
    local destination="$2"
    
    log_info "Downloading $filename..."
    
    # Get download URL from GitHub API
    local download_url
    download_url=$(curl -s "https://api.github.com/repos/$REPO/releases/tags/$VERSION" | \
        jq -r ".assets[] | select(.name == \"$filename\") | .browser_download_url")
    
    if [ -z "$download_url" ] || [ "$download_url" = "null" ]; then
        log_error "Asset '$filename' not found in release $VERSION"
        return 1
    fi
    
    # Download file
    if ! curl -sL -o "$destination" "$download_url"; then
        log_error "Failed to download $filename"
        return 1
    fi
    
    log_success "Downloaded $filename"
}

# Deploy server component
deploy_server() {
    log_info "Deploying Server..."
    
    local component_dir="$BASE_DIR/server"
    local tarball="/tmp/prism-server-$VERSION-linux-amd64.tar.gz"
    
    # Create directory
    mkdir -p "$component_dir"
    
    # Download
    if ! download_asset "prism-server-$VERSION-linux-amd64.tar.gz" "$tarball"; then
        return 1
    fi
    
    # Extract
    tar -xzf "$tarball" -C "$component_dir" --strip-components=0
    rm "$tarball"
    
    # Find and rename binary
    local binary=$(find "$component_dir" -name "prism-server-*" -type f | head -1)
    if [ -n "$binary" ]; then
        mv "$binary" "$component_dir/prism-server"
        chmod +x "$component_dir/prism-server"
    fi
    
    log_success "Server deployed to $component_dir"
}

# Deploy agent component
deploy_agent() {
    log_info "Deploying Agent..."
    
    local component_dir="$BASE_DIR/agent"
    local tarball="/tmp/prism-agent-$VERSION-linux-amd64.tar.gz"
    
    # Create directory
    mkdir -p "$component_dir"
    
    # Download
    if ! download_asset "prism-agent-$VERSION-linux-amd64.tar.gz" "$tarball"; then
        return 1
    fi
    
    # Extract
    tar -xzf "$tarball" -C "$component_dir" --strip-components=0
    rm "$tarball"
    
    # Find and rename binary
    local binary=$(find "$component_dir" -name "prism-agent-*" -type f | head -1)
    if [ -n "$binary" ]; then
        mv "$binary" "$component_dir/prism-agent"
        chmod +x "$component_dir/prism-agent"
    fi
    
    # Create config directory
    mkdir -p "$component_dir/config"
    
    # Create default config if not exists
    if [ ! -f "$component_dir/config/agent.yaml" ]; then
        cat > "$component_dir/config/agent.yaml" << EOF
# PRISM Agent Configuration
server_url: "http://localhost:8080"
agent_name: "$(hostname)"
log_level: "info"
EOF
        log_info "Created default config: $component_dir/config/agent.yaml"
    fi
    
    log_success "Agent deployed to $component_dir"
}

# Deploy frontend component
deploy_frontend() {
    log_info "Deploying Frontend..."
    
    local component_dir="$BASE_DIR/frontend"
    local tarball="/tmp/prism-frontend-$VERSION.tar.gz"
    
    # Check if Node.js is available for future builds
    if ! command -v node &> /dev/null; then
        log_warn "Node.js not found. You won't be able to rebuild frontend from source."
        log_info "Install Node.js 18+ from: https://nodejs.org/"
    fi
    
    # Create directory
    mkdir -p "$component_dir"
    
    # Download
    if ! download_asset "prism-frontend-$VERSION.tar.gz" "$tarball"; then
        return 1
    fi
    
    # Extract
    tar -xzf "$tarball" -C "$component_dir"
    rm "$tarball"
    
    log_success "Frontend deployed to $component_dir"
    log_info "Configure your web server to serve files from $component_dir"
}

# Create systemd service for server
create_server_service() {
    local run_user="$1"
    local service_file="/etc/systemd/system/prism-server.service"
    
    log_info "Creating systemd service for Server..."
    
    cat > "$service_file" << EOF
[Unit]
Description=PRISM Server
After=network.target

[Service]
Type=simple
User=$run_user
Group=$run_user
WorkingDirectory=$BASE_DIR/server
ExecStart=$BASE_DIR/server/prism-server
Restart=on-failure
RestartSec=5

# Environment
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF
    
    log_success "Created systemd service: $service_file"
}

# Create systemd service for agent
create_agent_service() {
    local run_user="$1"
    local service_file="/etc/systemd/system/prism-agent.service"
    
    log_info "Creating systemd service for Agent..."
    
    cat > "$service_file" << EOF
[Unit]
Description=PRISM Agent
After=network.target

[Service]
Type=simple
User=$run_user
Group=$run_user
WorkingDirectory=$BASE_DIR/agent
ExecStart=$BASE_DIR/agent/prism-agent --config $BASE_DIR/agent/config/agent.yaml
Restart=on-failure
RestartSec=5

# Environment
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF
    
    log_success "Created systemd service: $service_file"
}

# Enable and start services
manage_services() {
    echo ""
    echo "Service Management:"
    echo "  1) Enable and start services now"
    echo "  2) Only enable services (start on boot)"
    echo "  3) Do nothing (manual setup)"
    echo ""
    
    read -p "Enter choice [1-3]: " choice
    case $choice in
        1)
            log_info "Reloading systemd daemon..."
            systemctl daemon-reload
            
            if [[ "$COMPONENTS" == "all" || "$COMPONENTS" == "server" ]]; then
                log_info "Enabling and starting prism-server..."
                systemctl enable prism-server
                systemctl start prism-server
            fi
            
            if [[ "$COMPONENTS" == "all" || "$COMPONENTS" == "agent" ]]; then
                log_info "Enabling and starting prism-agent..."
                systemctl enable prism-agent
                systemctl start prism-agent
            fi
            
            log_success "Services enabled and started!"
            ;;
        2)
            log_info "Reloading systemd daemon..."
            systemctl daemon-reload
            
            if [[ "$COMPONENTS" == "all" || "$COMPONENTS" == "server" ]]; then
                log_info "Enabling prism-server..."
                systemctl enable prism-server
            fi
            
            if [[ "$COMPONENTS" == "all" || "$COMPONENTS" == "agent" ]]; then
                log_info "Enabling prism-agent..."
                systemctl enable prism-agent
            fi
            
            log_success "Services enabled! Start them manually with:"
            log_info "  systemctl start prism-server"
            log_info "  systemctl start prism-agent"
            ;;
        3)
            log_info "Skipping service setup. You can enable them later with:"
            log_info "  sudo systemctl daemon-reload"
            log_info "  sudo systemctl enable prism-server"
            log_info "  sudo systemctl start prism-server"
            ;;
        *)
            log_warn "Invalid choice, skipping service setup"
            ;;
    esac
}

# Show deployment summary
show_summary() {
    echo ""
    echo "========================================"
    log_success "Deployment completed successfully!"
    echo "========================================"
    echo ""
    echo "Installation paths:"
    if [[ "$COMPONENTS" == "all" || "$COMPONENTS" == "server" ]]; then
        echo "  Server:  $BASE_DIR/server/"
        echo "           Binary: $BASE_DIR/server/prism-server"
    fi
    if [[ "$COMPONENTS" == "all" || "$COMPONENTS" == "agent" ]]; then
        echo "  Agent:   $BASE_DIR/agent/"
        echo "           Binary: $BASE_DIR/agent/prism-agent"
        echo "           Config: $BASE_DIR/agent/config/agent.yaml"
    fi
    if [[ "$COMPONENTS" == "all" || "$COMPONENTS" == "frontend" ]]; then
        echo "  Frontend: $BASE_DIR/frontend/"
    fi
    echo ""
    echo "Next steps:"
    echo "  1. Configure Agent: $BASE_DIR/agent/config/agent.yaml"
    echo "  2. Check service status: systemctl status prism-server prism-agent"
    echo "  3. View logs: journalctl -u prism-server -f"
    echo ""
}

# Main execution
main() {
    echo "========================================"
    echo "  PRISM Deployment Script"
    echo "  Repository: $REPO"
    echo "========================================"
    echo ""
    
    check_root
    check_requirements
    
    RUN_USER=$(get_current_user)
    log_info "Running as user: $RUN_USER"
    
    select_component
    select_version
    
    echo ""
    log_info "Starting deployment..."
    echo ""
    
    case "$COMPONENTS" in
        all)
            deploy_server && create_server_service "$RUN_USER"
            echo ""
            deploy_agent && create_agent_service "$RUN_USER"
            echo ""
            deploy_frontend
            manage_services
            ;;
        server)
            deploy_server && create_server_service "$RUN_USER"
            manage_services
            ;;
        agent)
            deploy_agent && create_agent_service "$RUN_USER"
            manage_services
            ;;
        frontend)
            deploy_frontend
            ;;
        *)
            log_error "Unknown component: $COMPONENTS"
            exit 1
            ;;
    esac
    
    show_summary
}

main
