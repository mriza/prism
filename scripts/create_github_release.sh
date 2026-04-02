#!/bin/bash

# PRISM GitHub Release Creator
# Creates a new GitHub release with built artifacts
# Usage: ./scripts/create_github_release.sh v0.5.0

set -e

# Configuration
REPO="mriza/prism"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
DIST_DIR="$ROOT_DIR/.release"

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

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check if VERSION is provided
    if [ -z "$1" ]; then
        log_error "Usage: $0 <version>"
        log_error "Example: $0 v0.5.0"
        exit 1
    fi
    
    VERSION="$1"
    
    # Check if git is installed
    if ! command -v git &> /dev/null; then
        log_error "git is not installed. Please install git first."
        exit 1
    fi
    
    # Check if gh CLI is installed
    if ! command -v gh &> /dev/null; then
        log_error "GitHub CLI (gh) is not installed."
        log_info "Install it from: https://cli.github.com/"
        log_info "Or install with: sudo apt install gh (Ubuntu/Debian)"
        exit 1
    fi
    
    # Check if gh is authenticated
    if ! gh auth status &> /dev/null; then
        log_error "GitHub CLI is not authenticated."
        log_info "Run 'gh auth login' to authenticate."
        exit 1
    fi
    
    # Check if Node.js is installed (for frontend build)
    if ! command -v node &> /dev/null; then
        log_warn "Node.js is not installed. Frontend will not be built."
        BUILD_FRONTEND=false
    else
        BUILD_FRONTEND=true
    fi
    
    # Check if Go is installed
    if ! command -v go &> /dev/null; then
        log_error "Go is not installed. Server and agent cannot be built."
        exit 1
    fi
    
    log_success "All prerequisites met!"
}

# Clean and create dist directory
setup_dist_dir() {
    log_info "Setting up release directory..."
    rm -rf "$DIST_DIR"
    mkdir -p "$DIST_DIR"
}

# Build frontend
build_frontend() {
    if [ "$BUILD_FRONTEND" = false ]; then
        log_warn "Skipping frontend build (Node.js not installed)"
        return
    fi
    
    log_info "Building frontend..."
    cd "$ROOT_DIR/frontend"
    
    # Install dependencies
    npm ci --silent
    
    # Build
    npm run build
    
    # Create tarball
    cd "$ROOT_DIR"
    tar -czf "$DIST_DIR/prism-frontend-$VERSION.tar.gz" -C "$ROOT_DIR/frontend/dist" .
    
    log_success "Frontend built: prism-frontend-$VERSION.tar.gz"
}

# Build server
build_server() {
    log_info "Building server..."
    cd "$ROOT_DIR/server"
    
    # Build with version info
    go build -ldflags="-s -w -X main.Version=$VERSION" -o "$DIST_DIR/prism-server-$VERSION" ./cmd/server
    
    # Create tarball
    tar -czf "$DIST_DIR/prism-server-$VERSION-linux-amd64.tar.gz" -C "$DIST_DIR" "prism-server-$VERSION"
    rm "$DIST_DIR/prism-server-$VERSION"
    
    log_success "Server built: prism-server-$VERSION-linux-amd64.tar.gz"
}

# Build agent
build_agent() {
    log_info "Building agent..."
    cd "$ROOT_DIR/agent"
    
    # Build with version info
    go build -ldflags="-s -w -X main.Version=$VERSION" -o "$DIST_DIR/prism-agent-$VERSION" ./cmd/agent
    
    # Create tarball
    tar -czf "$DIST_DIR/prism-agent-$VERSION-linux-amd64.tar.gz" -C "$DIST_DIR" "prism-agent-$VERSION"
    rm "$DIST_DIR/prism-agent-$VERSION"
    
    log_success "Agent built: prism-agent-$VERSION-linux-amd64.tar.gz"
}

# Generate release notes
generate_release_notes() {
    log_info "Generating release notes..."
    
    # Get the last tag
    LAST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "")
    
    # Create release notes
    RELEASE_NOTES="$DIST_DIR/RELEASE_NOTES.md"
    
    cat > "$RELEASE_NOTES" << EOF
# PRISM $VERSION

## Changes

EOF
    
    if [ -n "$LAST_TAG" ]; then
        log_info "Generating changelog from $LAST_TAG to HEAD..."
        git log --pretty=format:"- %s (%h)" "$LAST_TAG"..HEAD >> "$RELEASE_NOTES"
    else
        log_info "No previous tag found, including all commits..."
        git log --pretty=format:"- %s (%h)" >> "$RELEASE_NOTES"
    fi
    
    cat >> "$RELEASE_NOTES" << EOF

## Installation

### Server
\`\`\`bash
tar -xzf prism-server-$VERSION-linux-amd64.tar.gz
sudo mv prism-server-$VERSION /usr/local/bin/prism-server
prism-server --version
\`\`\`

### Agent
\`\`\`bash
tar -xzf prism-agent-$VERSION-linux-amd64.tar.gz
sudo mv prism-agent-$VERSION /usr/local/bin/prism-agent
prism-agent --version
\`\`\`

### Frontend
Extract \`prism-frontend-$VERSION.tar.gz\` to your web server's document root.

## Checksums

EOF
    
    # Generate checksums
    cd "$DIST_DIR"
    sha256sum *.tar.gz >> "$RELEASE_NOTES"
    
    log_success "Release notes generated: RELEASE_NOTES.md"
}

# Create GitHub release
create_github_release() {
    log_info "Creating GitHub release $VERSION..."
    
    cd "$DIST_DIR"
    
    # Check if release already exists
    if gh release view "$VERSION" --repo "$REPO" &> /dev/null; then
        log_warn "Release $VERSION already exists!"
        read -p "Do you want to delete and recreate it? (y/N) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            log_info "Deleting existing release..."
            gh release delete "$VERSION" --repo "$REPO" --yes
        else
            log_info "Keeping existing release. Exiting..."
            exit 0
        fi
    fi
    
    # Create release
    log_info "Uploading artifacts to GitHub..."
    gh release create "$VERSION" \
        --repo "$REPO" \
        --title "PRISM $VERSION" \
        --notes-file "RELEASE_NOTES.md" \
        --draft \
        *.tar.gz
    
    log_success "Release $VERSION created successfully!"
    log_info "Release URL: https://github.com/$REPO/releases/tag/$VERSION"
    log_warn "Note: Release is in DRAFT mode. Publish it manually when ready."
}

# Cleanup
cleanup() {
    log_info "Cleaning up..."
    rm -rf "$DIST_DIR"
    log_success "Cleanup complete!"
}

# Main execution
main() {
    echo "========================================"
    echo "  PRISM GitHub Release Creator"
    echo "========================================"
    echo ""
    
    check_prerequisites "$1"
    setup_dist_dir
    
    trap cleanup EXIT
    
    build_frontend
    build_server
    build_agent
    generate_release_notes
    create_github_release
    
    echo ""
    echo "========================================"
    log_success "Release process completed!"
    echo "========================================"
}

main "$@"
