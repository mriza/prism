#!/bin/bash

# PRISM Deployment Script
# Downloads and installs PRISM from GitHub Releases
# Usage: ./deploy.sh [version]
#   version: 'latest', 'stable', or specific version (e.g., 'v0.5.0')

set -e

# Configuration
REPO="mriza/prism"
INSTALL_DIR="/opt/prism"
BACKUP_DIR="/opt/prism-backup"
SYSTEMD_DIR="/etc/systemd/system"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
VERSION="latest"
COMPONENTS="all"  # all, server, agent, or frontend
DRY_RUN=false
FORCE=false
SKIP_BACKUP=false

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

show_help() {
    cat << EOF
PRISM Deployment Script

Usage: $0 [OPTIONS] [VERSION]

Arguments:
  VERSION           Version to install (default: latest)
                    Use 'latest', 'stable', or specific version (e.g., v0.5.0)

Options:
  -c, --component   Component to install: server, agent, frontend, or all (default: all)
  -d, --dry-run     Show what would be done without making changes
  -f, --force       Force installation even if component is already installed
  --skip-backup     Skip backup of existing installation
  -h, --help        Show this help message

Examples:
  $0                          # Install latest version of all components
  $0 v0.5.0                   # Install specific version
  $0 -c server                # Install only server component
  $0 -c all --dry-run         # Dry run for all components
  $0 latest --force           # Force install latest version

EOF
}

# Parse command line arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -c|--component)
                COMPONENTS="$2"
                shift 2
                ;;
            -d|--dry-run)
                DRY_RUN=true
                shift
                ;;
            -f|--force)
                FORCE=true
                shift
                ;;
            --skip-backup)
                SKIP_BACKUP=true
                shift
                ;;
            -h|--help)
                show_help
                exit 0
                ;;
            *)
                VERSION="$1"
                shift
                ;;
        esac
    done
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check if running as root
    if [ "$EUID" -ne 0 ]; then
        log_error "Please run as root (use sudo)"
        exit 1
    fi
    
    # Check if curl is installed
    if ! command -v curl &> /dev/null; then
        log_error "curl is not installed. Please install curl first."
        exit 1
    fi
    
    # Check if jq is installed
    if ! command -v jq &> /dev/null; then
        log_error "jq is not installed. Please install jq."
        log_info "Install with: sudo apt install jq (Ubuntu/Debian)"
        exit 1
    fi
    
    log_success "Prerequisites check passed!"
}

# Get latest version from GitHub
get_latest_version() {
    log_info "Fetching latest version from GitHub..."
    
    if [ "$VERSION" = "latest" ]; then
        LATEST_VERSION=$(curl -s "https://api.github.com/repos/$REPO/releases/latest" | jq -r '.tag_name')
        log_info "Latest version: $LATEST_VERSION"
        VERSION="$LATEST_VERSION"
    elif [ "$VERSION" = "stable" ]; then
        # Get latest non-prerelease version
        STABLE_VERSION=$(curl -s "https://api.github.com/repos/$REPO/releases" | jq -r '[.[] | select(.prerelease == false)] | .[0].tag_name')
        log_info "Latest stable version: $STABLE_VERSION"
        VERSION="$STABLE_VERSION"
    fi
    
    log_info "Installing version: $VERSION"
}

# Download file from GitHub release
download_release() {
    local filename="$1"
    local destination="$2"
    
    log_info "Downloading $filename..."
    
    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY RUN] Would download $filename to $destination"
        return 0
    fi
    
    # Get download URL from GitHub API
    DOWNLOAD_URL=$(curl -s "https://api.github.com/repos/$REPO/releases/tags/$VERSION" | \
        jq -r ".assets[] | select(.name == \"$filename\") | .browser_download_url")
    
    if [ -z "$DOWNLOAD_URL" ] || [ "$DOWNLOAD_URL" = "null" ]; then
        log_error "Asset $filename not found in release $VERSION"
        return 1
    fi
    
    # Download file
    curl -L -o "$destination" "$DOWNLOAD_URL"
    
    log_success "Downloaded $filename"
}

# Backup existing installation
backup_installation() {
    if [ "$SKIP_BACKUP" = true ]; then
        log_info "Skipping backup as requested"
        return
    fi
    
    if [ ! -d "$INSTALL_DIR" ]; then
        log_info "No existing installation found, skipping backup"
        return
    fi
    
    log_info "Creating backup at $BACKUP_DIR..."
    
    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY RUN] Would backup $INSTALL_DIR to $BACKUP_DIR"
        return
    fi
    
    # Create timestamped backup
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    BACKUP_PATH="$BACKUP_DIR-$TIMESTAMP"
    
    mkdir -p "$(dirname "$BACKUP_PATH")"
    cp -r "$INSTALL_DIR" "$BACKUP_PATH"
    
    log_success "Backup created: $BACKUP_PATH"
}

# Install server component
install_server() {
    log_info "Installing PRISM Server..."
    
    local tarball="prism-server-$VERSION-linux-amd64.tar.gz"
    local temp_dir=$(mktemp -d)
    
    # Download
    download_release "$tarball" "$temp_dir/$tarball"
    
    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY RUN] Would extract and install server"
        rm -rf "$temp_dir"
        return
    fi
    
    # Extract
    tar -xzf "$temp_dir/$tarball" -C "$temp_dir"
    
    # Create installation directory
    mkdir -p "$INSTALL_DIR/bin"
    
    # Install binary
    mv "$temp_dir/prism-server-$VERSION" "$INSTALL_DIR/bin/prism-server"
    chmod +x "$INSTALL_DIR/bin/prism-server"
    
    # Create symlink
    ln -sf "$INSTALL_DIR/bin/prism-server" /usr/local/bin/prism-server
    
    # Create systemd service
    cat > "$SYSTEMD_DIR/prism-server.service" << EOF
[Unit]
Description=PRISM Server
After=network.target

[Service]
Type=simple
User=root
ExecStart=$INSTALL_DIR/bin/prism-server
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
    
    # Reload systemd
    systemctl daemon-reload
    
    log_success "PRISM Server installed successfully!"
    log_info "Enable with: systemctl enable prism-server"
    log_info "Start with: systemctl start prism-server"
    
    rm -rf "$temp_dir"
}

# Install agent component
install_agent() {
    log_info "Installing PRISM Agent..."
    
    local tarball="prism-agent-$VERSION-linux-amd64.tar.gz"
    local temp_dir=$(mktemp -d)
    
    # Download
    download_release "$tarball" "$temp_dir/$tarball"
    
    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY RUN] Would extract and install agent"
        rm -rf "$temp_dir"
        return
    fi
    
    # Extract
    tar -xzf "$temp_dir/$tarball" -C "$temp_dir"
    
    # Create installation directory
    mkdir -p "$INSTALL_DIR/bin"
    
    # Install binary
    mv "$temp_dir/prism-agent-$VERSION" "$INSTALL_DIR/bin/prism-agent"
    chmod +x "$INSTALL_DIR/bin/prism-agent"
    
    # Create symlink
    ln -sf "$INSTALL_DIR/bin/prism-agent" /usr/local/bin/prism-agent
    
    # Create config directory
    mkdir -p "$INSTALL_DIR/etc"
    
    # Create default config if not exists
    if [ ! -f "$INSTALL_DIR/etc/agent.yaml" ]; then
        cat > "$INSTALL_DIR/etc/agent.yaml" << EOF
# PRISM Agent Configuration
server_url: "http://localhost:8080"
agent_name: "$(hostname)"
log_level: "info"
EOF
    fi
    
    # Create systemd service
    cat > "$SYSTEMD_DIR/prism-agent.service" << EOF
[Unit]
Description=PRISM Agent
After=network.target prism-server.service

[Service]
Type=simple
User=root
ExecStart=$INSTALL_DIR/bin/prism-agent --config $INSTALL_DIR/etc/agent.yaml
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
    
    # Reload systemd
    systemctl daemon-reload
    
    log_success "PRISM Agent installed successfully!"
    log_info "Configure: $INSTALL_DIR/etc/agent.yaml"
    log_info "Enable with: systemctl enable prism-agent"
    log_info "Start with: systemctl start prism-agent"
    
    rm -rf "$temp_dir"
}

# Install frontend component
install_frontend() {
    log_info "Installing PRISM Frontend..."
    
    local tarball="prism-frontend-$VERSION.tar.gz"
    local temp_dir=$(mktemp -d)
    local web_root="/var/www/prism"
    
    # Download
    download_release "$tarball" "$temp_dir/$tarball"
    
    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY RUN] Would extract and install frontend to $web_root"
        rm -rf "$temp_dir"
        return
    fi
    
    # Extract
    tar -xzf "$temp_dir/$tarball" -C "$temp_dir"
    
    # Create web root
    mkdir -p "$web_root"
    
    # Install files
    cp -r "$temp_dir/"* "$web_root/"
    
    # Set permissions
    chown -R www-data:www-data "$web_root"
    chmod -R 755 "$web_root"
    
    log_success "PRISM Frontend installed to $web_root!"
    log_info "Configure your web server to serve files from $web_root"
    
    rm -rf "$temp_dir"
}

# Verify installation
verify_installation() {
    log_info "Verifying installation..."
    
    if [[ "$COMPONENTS" == "all" || "$COMPONENTS" == "server" ]]; then
        if command -v prism-server &> /dev/null; then
            local server_version=$(prism-server --version 2>/dev/null || echo "unknown")
            log_success "Server installed: $server_version"
        else
            log_warn "Server not found in PATH"
        fi
    fi
    
    if [[ "$COMPONENTS" == "all" || "$COMPONENTS" == "agent" ]]; then
        if command -v prism-agent &> /dev/null; then
            local agent_version=$(prism-agent --version 2>/dev/null || echo "unknown")
            log_success "Agent installed: $agent_version"
        else
            log_warn "Agent not found in PATH"
        fi
    fi
}

# Main execution
main() {
    echo "========================================"
    echo "  PRISM Deployment Script"
    echo "  Repository: $REPO"
    echo "========================================"
    echo ""
    
    parse_args "$@"
    check_prerequisites
    get_latest_version
    
    if [ "$DRY_RUN" = true ]; then
        echo ""
        log_warn "DRY RUN MODE - No changes will be made"
        echo ""
    fi
    
    backup_installation
    
    case "$COMPONENTS" in
        all)
            install_server
            install_agent
            install_frontend
            ;;
        server)
            install_server
            ;;
        agent)
            install_agent
            ;;
        frontend)
            install_frontend
            ;;
        *)
            log_error "Unknown component: $COMPONENTS"
            exit 1
            ;;
    esac
    
    verify_installation
    
    echo ""
    echo "========================================"
    log_success "Deployment completed successfully!"
    echo "========================================"
    echo ""
    echo "Next steps:"
    echo "  1. Configure: $INSTALL_DIR/etc/agent.yaml"
    echo "  2. Enable services:"
    echo "     sudo systemctl enable prism-server prism-agent"
    echo "  3. Start services:"
    echo "     sudo systemctl start prism-server prism-agent"
    echo "  4. Check status:"
    echo "     sudo systemctl status prism-server prism-agent"
    echo ""
}

main "$@"
