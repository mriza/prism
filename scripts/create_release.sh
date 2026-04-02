#!/bin/bash

# PRISM Release Creator
# Creates a new release and prepares deployment artifacts
# Usage: ./create_release.sh v0.5.0

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$SCRIPT_DIR"
RELEASE_DIR="$ROOT_DIR/.release"
REPO="mriza/prism"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Check version argument
if [ -z "$1" ]; then
    log_error "Usage: $0 <version>"
    log_error "Example: $0 v0.5.0"
    exit 1
fi

VERSION="$1"

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    local missing=()
    
    # Check git
    if ! command -v git &> /dev/null; then
        missing+=("git")
    fi
    
    # Check Go (for server and agent)
    if ! command -v go &> /dev/null; then
        log_warn "Go not found - server and agent will not be built"
        BUILD_GO=false
    else
        BUILD_GO=true
    fi
    
    # Check Node.js (for frontend)
    if ! command -v node &> /dev/null; then
        log_warn "Node.js not found - frontend will not be built"
        BUILD_FRONTEND=false
    else
        BUILD_FRONTEND=true
    fi
    
    # Check tar
    if ! command -v tar &> /dev/null; then
        missing+=("tar")
    fi
    
    if [ ${#missing[@]} -gt 0 ]; then
        log_error "Missing required tools: ${missing[*]}"
        exit 1
    fi
    
    if [ "$BUILD_GO" = false ] && [ "$BUILD_FRONTEND" = false ]; then
        log_error "Nothing to build! Install Go or Node.js"
        exit 1
    fi
    
    log_success "Prerequisites check completed"
}

# Setup release directory
setup_release_dir() {
    log_info "Setting up release directory..."
    rm -rf "$RELEASE_DIR"
    mkdir -p "$RELEASE_DIR"
}

# Build frontend
build_frontend() {
    if [ "$BUILD_FRONTEND" = false ]; then
        log_warn "Skipping frontend build"
        return
    fi
    
    log_info "Building frontend..."
    cd "$ROOT_DIR/frontend"
    
    # Install dependencies
    log_info "Installing dependencies..."
    npm ci --silent
    
    # Build
    log_info "Running build..."
    npm run build
    
    # Create tarball
    cd "$ROOT_DIR"
    log_info "Creating frontend tarball..."
    tar -czf "$RELEASE_DIR/prism-frontend-$VERSION.tar.gz" -C "$ROOT_DIR/frontend/dist" .
    
    log_success "Frontend built: prism-frontend-$VERSION.tar.gz"
}

# Build server
build_server() {
    if [ "$BUILD_GO" = false ]; then
        log_warn "Skipping server build"
        return
    fi
    
    log_info "Building server..."
    cd "$ROOT_DIR/server"
    
    # Build with version info
    go build -ldflags="-s -w -X main.Version=$VERSION" \
        -o "$RELEASE_DIR/prism-server-$VERSION" \
        ./cmd/server
    
    # Create tarball
    cd "$ROOT_DIR"
    tar -czf "$RELEASE_DIR/prism-server-$VERSION-linux-amd64.tar.gz" \
        -C "$RELEASE_DIR" "prism-server-$VERSION"
    rm "$RELEASE_DIR/prism-server-$VERSION"
    
    log_success "Server built: prism-server-$VERSION-linux-amd64.tar.gz"
}

# Build agent
build_agent() {
    if [ "$BUILD_GO" = false ]; then
        log_warn "Skipping agent build"
        return
    fi
    
    log_info "Building agent..."
    cd "$ROOT_DIR/agent"
    
    # Build with version info
    go build -ldflags="-s -w -X main.Version=$VERSION" \
        -o "$RELEASE_DIR/prism-agent-$VERSION" \
        ./cmd/agent
    
    # Create tarball
    cd "$ROOT_DIR"
    tar -czf "$RELEASE_DIR/prism-agent-$VERSION-linux-amd64.tar.gz" \
        -C "$RELEASE_DIR" "prism-agent-$VERSION"
    rm "$RELEASE_DIR/prism-agent-$VERSION"
    
    log_success "Agent built: prism-agent-$VERSION-linux-amd64.tar.gz"
}

# Generate release notes
generate_release_notes() {
    log_info "Generating release notes..."
    
    # Get the last tag
    local last_tag
    last_tag=$(git describe --tags --abbrev=0 2>/dev/null || echo "")
    
    local notes_file="$RELEASE_DIR/RELEASE_NOTES.md"
    
    # Create header
    cat > "$notes_file" << EOF
# PRISM $VERSION

## Release Date
$(date '+%Y-%m-%d')

## Changes

EOF
    
    # Add changelog
    if [ -n "$last_tag" ]; then
        log_info "Generating changelog from $last_tag to HEAD..."
        git log --pretty=format:"- %s (%h)" "$last_tag"..HEAD >> "$notes_file"
    else
        log_info "No previous tag found, including recent commits..."
        git log --pretty=format:"- %s (%h)" -20 >> "$notes_file"
    fi
    
    # Add installation instructions
    cat >> "$notes_file" << EOF

## Installation

### Using Deploy Script (Recommended)

\`\`\`bash
# Download deploy script
curl -LO https://github.com/$REPO/raw/main/deploy.sh
chmod +x deploy.sh

# Deploy (will download from GitHub Releases)
sudo ./deploy.sh
\`\`\`

### Manual Installation

#### Server
\`\`\`bash
tar -xzf prism-server-$VERSION-linux-amd64.tar.gz
sudo mv prism-server-$VERSION /opt/prism/server/prism-server
chmod +x /opt/prism/server/prism-server
\`\`\`

#### Agent
\`\`\`bash
tar -xzf prism-agent-$VERSION-linux-amd64.tar.gz
sudo mv prism-agent-$VERSION /opt/prism/agent/prism-agent
chmod +x /opt/prism/agent/prism-agent
\`\`\`

#### Frontend
\`\`\`bash
tar -xzf prism-frontend-$VERSION.tar.gz -C /var/www/prism
\`\`\`

## Checksums

EOF
    
    # Generate checksums
    cd "$RELEASE_DIR"
    sha256sum *.tar.gz >> "$notes_file"
    
    log_success "Release notes generated: RELEASE_NOTES.md"
}

# Create GitHub release (optional)
create_github_release() {
    echo ""
    log_info "Do you want to create a GitHub release now?"
    echo "  1) Yes, create release and upload artifacts"
    echo "  2) No, just prepare artifacts locally"
    echo ""
    
    read -p "Enter choice [1-2]: " choice
    
    if [ "$choice" = "1" ]; then
        # Check if gh CLI is available
        if ! command -v gh &> /dev/null; then
            log_warn "GitHub CLI (gh) not found"
            log_info "Install from: https://cli.github.com/"
            log_info "Skipping GitHub release creation"
            return
        fi
        
        # Check if authenticated
        if ! gh auth status &> /dev/null 2>&1; then
            log_warn "GitHub CLI not authenticated"
            log_info "Run 'gh auth login' to authenticate"
            log_info "Skipping GitHub release creation"
            return
        fi
        
        log_info "Creating GitHub release..."
        cd "$RELEASE_DIR"
        
        # Check if release exists
        if gh release view "$VERSION" --repo "$REPO" &> /dev/null; then
            log_warn "Release $VERSION already exists!"
            read -p "Delete and recreate? (y/N): " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                gh release delete "$VERSION" --repo "$REPO" --yes || true
            else
                log_info "Keeping existing release"
                return
            fi
        fi
        
        # Create release
        gh release create "$VERSION" \
            --repo "$REPO" \
            --title "PRISM $VERSION" \
            --notes-file "RELEASE_NOTES.md" \
            --draft \
            *.tar.gz
        
        log_success "Release created: https://github.com/$REPO/releases/tag/$VERSION"
        log_warn "Note: Release is in DRAFT mode. Publish manually when ready."
    else
        log_info "Artifacts prepared locally in: $RELEASE_DIR"
    fi
}

# Show summary
show_summary() {
    echo ""
    echo "========================================"
    log_success "Release $VERSION prepared successfully!"
    echo "========================================"
    echo ""
    echo "Artifacts created:"
    ls -lh "$RELEASE_DIR"/*.tar.gz 2>/dev/null | awk '{print "  " $9 " (" $5 ")"}'
    echo ""
    echo "Release notes:"
    echo "  $RELEASE_DIR/RELEASE_NOTES.md"
    echo ""
    if [ "$BUILD_FRONTEND" = true ]; then
        echo "Frontend build output:"
        echo "  $ROOT_DIR/frontend/dist/"
    fi
    echo ""
    echo "Next steps:"
    echo "  1. Review release notes: cat $RELEASE_DIR/RELEASE_NOTES.md"
    echo "  2. Test deployment locally"
    echo "  3. Create GitHub release: gh release create $VERSION ..."
    echo ""
}

# Cleanup on exit
cleanup() {
    # Keep release directory for inspection
    log_info "Release artifacts saved in: $RELEASE_DIR"
}

# Main
main() {
    echo "========================================"
    echo "  PRISM Release Creator"
    echo "  Version: $VERSION"
    echo "========================================"
    echo ""
    
    check_prerequisites
    setup_release_dir
    
    trap cleanup EXIT
    
    build_frontend
    build_server
    build_agent
    generate_release_notes
    create_github_release
    show_summary
}

main "$@"
