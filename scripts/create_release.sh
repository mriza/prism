#!/bin/bash

# PRISM Release Creator
# Creates a new release and prepares deployment artifacts
# Usage: ./create_release.sh [v0.5.0]
#
# If no version is provided, reads from VERSION.md or suggests next version

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"  # Go up one level to project root
RELEASE_DIR="$ROOT_DIR/.release"
REPO="mriza/prism"
VERSION_FILE="$ROOT_DIR/VERSION.md"

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

# Get version from argument or suggest from VERSION.md
get_version() {
    if [ -n "$1" ]; then
        echo "$1"
        return 0
    fi
    
    # Try to get last version from VERSION.md
    if [ -f "$VERSION_FILE" ]; then
        local last_version
        last_version=$(grep -E "^v[0-9]+\.[0-9]+\.[0-9]+" "$VERSION_FILE" | head -1 | awk '{print $1}')
        
        if [ -n "$last_version" ]; then
            # Suggest next patch version
            local major minor patch
            major=$(echo "$last_version" | cut -d. -f1 | tr -d 'v')
            minor=$(echo "$last_version" | cut -d. -f2)
            patch=$(echo "$last_version" | cut -d. -f3)
            patch=$((patch + 1))
            
            echo "v${major}.${minor}.${patch}"
            return 0
        fi
    fi
    
    # Fallback to git tag
    local git_tag
    git_tag=$(git describe --tags --abbrev=0 2>/dev/null || echo "")
    
    if [ -n "$git_tag" ]; then
        echo "$git_tag"
        return 0
    fi
    
    log_error "No version provided and cannot determine version from VERSION.md or git"
    log_error "Usage: $0 <version>"
    log_error "Example: $0 v0.5.0"
    exit 1
}

# Get version (suppress logging for clean output)
VERSION=$(get_version "$1" 2>/dev/null)

# If version is empty or contains log output, get it cleanly
if [[ "$VERSION" == *"INFO"* ]] || [ -z "$VERSION" ]; then
    VERSION=$(get_version "$1" 2>&1 | grep -E "^v[0-9]+\.[0-9]+\.[0-9]+")
fi

# If still empty, call again without suppressing
if [ -z "$VERSION" ]; then
    VERSION=$(get_version "$1")
fi

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
    
    # Change to server directory
    cd "$ROOT_DIR/server"
    
    # Build with version info (output to release dir)
    go build -ldflags="-s -w -X main.Version=$VERSION" \
        -o "$RELEASE_DIR/prism-server-$VERSION" \
        ./cmd/server

    # Create tarball
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
    
    # Change to agent directory
    cd "$ROOT_DIR/agent"
    
    # Build with version info (output to release dir)
    go build -ldflags="-s -w -X main.Version=$VERSION" \
        -o "$RELEASE_DIR/prism-agent-$VERSION" \
        ./cmd/agent
    
    # Create tarball
    tar -czf "$RELEASE_DIR/prism-agent-$VERSION-linux-amd64.tar.gz" \
        -C "$RELEASE_DIR" "prism-agent-$VERSION"
    rm "$RELEASE_DIR/prism-agent-$VERSION"

    log_success "Agent built: prism-agent-$VERSION-linux-amd64.tar.gz"
}

# Generate release notes with proper categorization
generate_release_notes() {
    log_info "Generating release notes..."
    
    # Get the last tag
    local last_tag
    last_tag=$(git describe --tags --abbrev=0 2>/dev/null || echo "")
    
    local notes_file="$RELEASE_DIR/RELEASE_NOTES.md"
    local temp_commits="/tmp/prism_commits_$$.txt"
    
    # Get commits
    if [ -n "$last_tag" ]; then
        git log --pretty=format:"%s (%h)" "$last_tag"..HEAD > "$temp_commits"
    else
        git log --pretty=format:"%s (%h)" -30 > "$temp_commits"
    fi
    
    # Categorize commits
    local feat_commits=$(grep -i "^feat:" "$temp_commits" 2>/dev/null || true)
    local fix_commits=$(grep -i "^fix:" "$temp_commits" 2>/dev/null || true)
    local docs_commits=$(grep -i "^docs:" "$temp_commits" 2>/dev/null || true)
    local other_commits=$(grep -ivE "^(feat|fix|docs):" "$temp_commits" 2>/dev/null || true)
    
    # Create release notes
    cat > "$notes_file" << EOF
# PRISM $VERSION

## Release Information
- **Release Date**: $(date '+%Y-%m-%d %H:%M')
- **Previous Version**: ${last_tag:-"Initial Release"}
- **Total Changes**: $(wc -l < "$temp_commits") commits

EOF

    # Add Features section
    if [ -n "$feat_commits" ]; then
        cat >> "$notes_file" << 'EOF'
## 🚀 New Features

EOF
        echo "$feat_commits" | while read -r line; do
            # Clean up the commit message
            local msg=$(echo "$line" | sed 's/^[Ff]eat: //')
            echo "- $msg" >> "$notes_file"
        done
        echo "" >> "$notes_file"
    fi
    
    # Add Bug Fixes section
    if [ -n "$fix_commits" ]; then
        cat >> "$notes_file" << 'EOF'
## 🐛 Bug Fixes

EOF
        echo "$fix_commits" | while read -r line; do
            local msg=$(echo "$line" | sed 's/^[Ff]ix: //')
            echo "- $msg" >> "$notes_file"
        done
        echo "" >> "$notes_file"
    fi
    
    # Add Documentation section
    if [ -n "$docs_commits" ]; then
        cat >> "$notes_file" << 'EOF'
## 📚 Documentation

EOF
        echo "$docs_commits" | while read -r line; do
            local msg=$(echo "$line" | sed 's/^[Dd]ocs: //')
            echo "- $msg" >> "$notes_file"
        done
        echo "" >> "$notes_file"
    fi
    
    # Add Other Changes section
    if [ -n "$other_commits" ]; then
        cat >> "$notes_file" << 'EOF'
## 🔧 Other Changes

EOF
        echo "$other_commits" | while read -r line; do
            echo "- $line" >> "$notes_file"
        done
        echo "" >> "$notes_file"
    fi
    
    # Add installation instructions
    cat >> "$notes_file" << EOF
## 📦 Installation

### Quick Deploy (Recommended)

Use the automated deployment script:

\`\`\`bash
# Download and run deploy script
curl -LO https://github.com/$REPO/raw/main/deploy.sh
chmod +x deploy.sh
sudo ./deploy.sh
\`\`\`

This will:
- Download $VERSION from GitHub Releases
- Install to /opt/prism/[component]/
- Create systemd services (runs as your user, not root)
- Configure automatic startup

### Manual Installation

#### 1. Server
\`\`\`bash
# Download
curl -LO https://github.com/$REPO/releases/download/$VERSION/prism-server-$VERSION-linux-amd64.tar.gz

# Extract and install
tar -xzf prism-server-$VERSION-linux-amd64.tar.gz
sudo mkdir -p /opt/prism/server
sudo mv prism-server-$VERSION /opt/prism/server/prism-server
sudo chmod +x /opt/prism/server/prism-server

# Create systemd service (optional)
sudo systemctl daemon-reload
sudo systemctl enable prism-server
sudo systemctl start prism-server
\`\`\`

#### 2. Agent
\`\`\`bash
# Download
curl -LO https://github.com/$REPO/releases/download/$VERSION/prism-agent-$VERSION-linux-amd64.tar.gz

# Extract and install
tar -xzf prism-agent-$VERSION-linux-amd64.tar.gz
sudo mkdir -p /opt/prism/agent
sudo mv prism-agent-$VERSION /opt/prism/agent/prism-agent
sudo chmod +x /opt/prism/agent/prism-agent

# Configure
sudo mkdir -p /opt/prism/agent/config
# Edit /opt/prism/agent/config/agent.yaml with your server URL

# Create systemd service (optional)
sudo systemctl daemon-reload
sudo systemctl enable prism-agent
sudo systemctl start prism-agent
\`\`\`

#### 3. Frontend
\`\`\`bash
# Download
curl -LO https://github.com/$REPO/releases/download/$VERSION/prism-frontend-$VERSION.tar.gz

# Extract to web server directory
sudo mkdir -p /var/www/prism
sudo tar -xzf prism-frontend-$VERSION.tar.gz -C /var/www/prism
sudo chown -R www-data:www-data /var/www/prism
\`\`\`

Configure your web server (Nginx/Apache) to serve files from \`/var/www/prism\`.

EOF

    # Add checksums
    cat >> "$notes_file" << EOF
## 🔐 Checksums

Verify downloaded files:

\`\`\`
EOF
    
    # Generate checksums
    cd "$RELEASE_DIR"
    sha256sum *.tar.gz >> "$notes_file" 2>/dev/null || echo "No artifacts to checksum"
    
    echo "\`\`\`" >> "$notes_file"
    
    # Add links
    cat >> "$notes_file" << EOF

## 🔗 Links

- [GitHub Release](https://github.com/$REPO/releases/tag/$VERSION)
- [Deployment Guide](https://github.com/$REPO/blob/main/deploy.sh)
- [Documentation](https://github.com/$REPO#readme)
- [Bug Reports](https://github.com/$REPO/issues)

---

*Generated automatically by PRISM Release Script*
EOF
    
    # Cleanup
    rm -f "$temp_commits"
    
    log_success "Release notes generated: RELEASE_NOTES.md"
    
    # Show preview
    echo ""
    log_info "Release Notes Preview:"
    echo "----------------------------------------"
    head -30 "$notes_file"
    echo "..."
    echo "----------------------------------------"
}

# Create Git tag and GitHub release (automated)
create_git_tag_and_release() {
    log_info "Creating Git tag and GitHub release..."
    
    # Check if git is available
    if ! command -v git &> /dev/null; then
        log_error "Git not found. Cannot create tag."
        return 1
    fi
    
    # Check if gh CLI is available
    if ! command -v gh &> /dev/null; then
        log_error "GitHub CLI (gh) not found."
        log_info "Install from: https://cli.github.com/"
        log_info "Or create release manually via GitHub UI"
        return 1
    fi
    
    # Check if authenticated
    if ! gh auth status &> /dev/null 2>&1; then
        log_error "GitHub CLI not authenticated"
        log_info "Run 'gh auth login' to authenticate"
        return 1
    fi
    
    # Check if tag already exists locally
    if git rev-parse -q --verify "refs/tags/$VERSION" &> /dev/null; then
        log_warn "Tag $VERSION already exists locally!"
        read -p "Delete and recreate? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "Keeping existing tag"
            return 1
        fi
        git tag -d "$VERSION" || true
    fi
    
    # Check if tag already exists remotely
    if git ls-remote --tags origin "$VERSION" &> /dev/null; then
        log_warn "Tag $VERSION already exists on remote!"
        read -p "Delete and recreate? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "Keeping existing remote tag"
            return 1
        fi
        git push origin :refs/tags/$VERSION || true
    fi
    
    # Create annotated tag
    log_info "Creating annotated tag: $VERSION"
    git tag -a "$VERSION" -m "PRISM $VERSION - Released $(date '+%Y-%m-%d')"
    
    # Push code changes first (if any uncommitted)
    if ! git diff --quiet || ! git diff --cached --quiet; then
        log_info "Committing uncommitted changes..."
        git add -A
        git commit -m "release: $VERSION - Automated release commit"
        git push origin HEAD
    fi
    
    # Push tag to remote
    log_info "Pushing tag to GitHub..."
    git push origin "$VERSION"
    
    # Create GitHub release
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
            return 0
        fi
    fi
    
    # Create release (published immediately, not draft)
    gh release create "$VERSION" \
        --repo "$REPO" \
        --title "PRISM $VERSION" \
        --notes-file "RELEASE_NOTES.md" \
        --latest \
        *.tar.gz
    
    log_success "✅ Git tag created: $VERSION"
    log_success "✅ Git tag pushed: origin $VERSION"
    log_success "✅ GitHub release created: https://github.com/$REPO/releases/tag/$VERSION"
    log_success "✅ Release published and set as latest!"
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
    
    # Debug: Check gh CLI status
    log_info "Checking GitHub CLI status..."
    if command -v gh &> /dev/null; then
        log_success "GitHub CLI found: $(gh --version | head -1)"
        
        # Check authentication
        log_info "Checking GitHub authentication..."
        if gh auth status &> /dev/null 2>&1; then
            log_success "GitHub CLI authenticated"
            create_git_tag_and_release
        else
            log_error "GitHub CLI not authenticated"
            log_info "Run: gh auth login"
            log_info "Artifacts saved locally in: $RELEASE_DIR"
            log_info "You can create release manually via GitHub UI"
        fi
    else
        log_error "GitHub CLI (gh) not found"
        log_info "Install from: https://cli.github.com/"
        log_info "Artifacts saved locally in: $RELEASE_DIR"
        log_info "You can create release manually via GitHub UI"
    fi
    
    show_summary
}

main "$@"
