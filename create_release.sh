#!/bin/bash

# GitHub Release Script for PRISM
# Usage: ./create_release.sh v0.4.10

set -e

VERSION=${1:-""}

if [ -z "$VERSION" ]; then
    echo "Usage: $0 <version>"
    echo "Example: $0 v0.4.10"
    exit 1
fi

RELEASE_NAME="PRISM $VERSION"
TAG_NAME="$VERSION"

echo "==================================="
echo "  PRISM GitHub Release Creator    "
echo "==================================="
echo ""
echo "Version: $VERSION"
echo "Tag: $TAG_NAME"
echo ""

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    echo "❌ GitHub CLI (gh) is not installed."
    echo ""
    echo "Please install it first:"
    echo "  Ubuntu/Debian: sudo apt install gh"
    echo "  macOS: brew install gh"
    echo "  Or download from: https://github.com/cli/cli/releases"
    echo ""
    echo "Then authenticate with:"
    echo "  gh auth login"
    exit 1
fi

# Check if authenticated
if ! gh auth status &> /dev/null; then
    echo "❌ Not authenticated with GitHub."
    echo ""
    echo "Please run: gh auth login"
    exit 1
fi

echo "✓ GitHub CLI is installed and authenticated"
echo ""

# Create release notes from file
RELEASE_NOTES_FILE="RELEASE_NOTES_${VERSION}.md"

if [ ! -f "$RELEASE_NOTES_FILE" ]; then
    echo "❌ Release notes file not found: $RELEASE_NOTES_FILE"
    echo ""
    echo "Please create the release notes file first."
    exit 1
fi

echo "✓ Found release notes: $RELEASE_NOTES_FILE"
echo ""

# Check if tag already exists
if git rev-parse "$TAG_NAME" &> /dev/null; then
    echo "⚠️  Tag $TAG_NAME already exists."
    read -p "Do you want to delete the existing tag and continue? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        git tag -d "$TAG_NAME"
        git push origin :refs/tags/$TAG_NAME 2>/dev/null || true
        echo "✓ Deleted existing tag"
    else
        echo "❌ Release creation cancelled."
        exit 1
    fi
fi

# Create tag
echo "Creating tag $TAG_NAME..."
git tag -a "$TAG_NAME" -m "Release $VERSION"
echo "✓ Tag created"
echo ""

# Push tag
echo "Pushing tag to GitHub..."
git push origin "$TAG_NAME"
echo "✓ Tag pushed"
echo ""

# Create release
echo "Creating GitHub release..."
gh release create "$TAG_NAME" \
    --title "$RELEASE_NAME" \
    --notes-file "$RELEASE_NOTES_FILE" \
    --verify-tag \
    --latest

echo ""
echo "==================================="
echo "  ✅ Release Created Successfully! "
echo "==================================="
echo ""
echo "Release URL:"
gh repo view --web
echo ""
echo "Next steps:"
echo "1. Review the release on GitHub"
echo "2. Add binaries if needed (prism-server, prism-agent, prism_deploy.tar.gz)"
echo "3. Share the release with your team!"
echo ""
