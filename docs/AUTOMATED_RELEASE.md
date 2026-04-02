# PRISM Automated Release Guide

> **Fully Automated GitHub Release Workflow**
>
> One command creates tag, pushes code, and publishes release!

---

## Overview

Script `create_release.sh` sekarang **fully automated**:

**Before** (Manual):
```bash
# Multiple steps required
git commit -m "release: v0.4.25"
git push
git tag -a v0.4.25 -m "PRISM v0.4.25"
git push origin v0.4.25
./scripts/create_release.sh v0.4.25
# Choose option 1 or 2
# Release created as DRAFT
# Publish manually via GitHub UI
```

**After** (Automated):
```bash
# One command does everything!
./scripts/create_release.sh v0.4.25

# Automatically:
# ✅ Builds binaries
# ✅ Creates release notes
# ✅ Creates git tag
# ✅ Pushes code to GitHub
# ✅ Pushes tag to GitHub
# ✅ Creates GitHub release
# ✅ Publishes release (not draft!)
# ✅ Sets as latest release
```

---

## Usage

### Basic Usage

```bash
# Auto-detect version from VERSION.md
./scripts/create_release.sh

# Or specify version
./scripts/create_release.sh v0.4.25
```

### What Happens

**Step 1: Build Artifacts**
```
✅ Building frontend...
✅ Building server...
✅ Building agent...
✅ Creating tarballs...
✅ Generating release notes...
✅ Creating SHA256 checksums...
```

**Step 2: Git Operations**
```
✅ Creating annotated tag: v0.4.25
✅ Committing uncommitted changes (if any)
✅ Pushing code to GitHub
✅ Pushing tag to GitHub
```

**Step 3: GitHub Release**
```
✅ Creating GitHub release...
✅ Uploading artifacts...
✅ Publishing release...
✅ Setting as latest release
```

---

## Prerequisites

### Required Tools

**Git**:
```bash
# Check installation
git --version

# Install if needed
sudo apt install git  # Ubuntu/Debian
brew install git      # macOS
```

**GitHub CLI (gh)**:
```bash
# Check installation
gh --version

# Install if needed
# Ubuntu/Debian:
sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C99B11DEB97541F0
sudo apt-add-repository https://cli.github.com/packages
sudo apt install gh

# macOS:
brew install gh
```

### Authentication

**Setup GitHub CLI**:
```bash
# Authenticate (one-time setup)
gh auth login

# Choose:
# - GitHub.com
# - HTTPS
# - Login with web browser
# - Copy code and paste in browser
```

**Verify Authentication**:
```bash
gh auth status
```

---

## Full Automation Flow

```
┌─────────────────────────────────────────────────────────┐
│  ./scripts/create_release.sh v0.4.25                   │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ 1. BUILD PHASE                                          │
├─────────────────────────────────────────────────────────┤
│ ✅ Build frontend (npm run build)                       │
│ ✅ Build server (go build)                              │
│ ✅ Build agent (go build)                               │
│ ✅ Create tarballs                                      │
│ ✅ Generate RELEASE_NOTES.md                            │
│ ✅ Create SHA256 checksums                              │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ 2. GIT PHASE                                            │
├─────────────────────────────────────────────────────────┤
│ ✅ Check for uncommitted changes                        │
│ ✅ Commit changes (if any)                              │
│ ✅ Push code to GitHub                                  │
│ ✅ Create annotated tag                                 │
│ ✅ Push tag to GitHub                                   │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ 3. GITHUB RELEASE PHASE                                 │
├─────────────────────────────────────────────────────────┤
│ ✅ Check if release exists                              │
│ ✅ Create GitHub release                                │
│ ✅ Upload artifacts                                     │
│ ✅ Publish release (not draft!)                         │
│ ✅ Set as latest release                                │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ RESULT: Release Published! 🎉                           │
│                                                         │
│ https://github.com/mriza/prism/releases/tag/v0.4.25    │
│ https://github.com/mriza/prism/releases/latest         │
└─────────────────────────────────────────────────────────┘
```

---

## Examples

### Example 1: First Release

```bash
# Authenticate (one-time)
gh auth login

# Create release
./scripts/create_release.sh v0.4.25
```

**Output**:
```
========================================
  PRISM Release Creator
  Version: v0.4.25
========================================

[INFO] Checking prerequisites...
[SUCCESS] Prerequisites check completed
[INFO] Setting up release directory...
[INFO] Building frontend...
[SUCCESS] Frontend built: prism-frontend-v0.4.25.tar.gz
[INFO] Building server...
[SUCCESS] Server built: prism-server-v0.4.25-linux-amd64.tar.gz
[INFO] Building agent...
[SUCCESS] Agent built: prism-agent-v0.4.25-linux-amd64.tar.gz
[INFO] Generating release notes...
[SUCCESS] Release notes generated: RELEASE_NOTES.md
[INFO] Creating Git tag and GitHub release...
[INFO] Creating annotated tag: v0.4.25
[INFO] Pushing tag to GitHub...
[INFO] Creating GitHub release...
✅ Git tag created: v0.4.25
✅ Git tag pushed: origin v0.4.25
✅ GitHub release created: https://github.com/mriza/prism/releases/tag/v0.4.25
✅ Release published and set as latest!
```

### Example 2: Update Existing Release

```bash
# Script will ask to delete and recreate
./scripts/create_release.sh v0.4.25

# Output:
[WARN] Tag v0.4.25 already exists locally!
Delete and recreate? (y/N): y

[WARN] Tag v0.4.25 already exists on remote!
Delete and recreate? (y/N): y

# Proceeds to recreate
```

### Example 3: Auto-Detect Version

```bash
# Reads from VERSION.md
./scripts/create_release.sh

# Output:
[INFO] Last version: v0.4.24
[INFO] Suggested next version: v0.4.25
[SUCCESS] Release v0.4.25 prepared successfully!
```

---

## Safety Features

### 1. Tag Existence Check

Script checks if tag exists **locally and remotely**:

```bash
# If tag exists, asks for confirmation
[WARN] Tag v0.4.25 already exists locally!
Delete and recreate? (y/N): 

[WARN] Tag v0.4.25 already exists on remote!
Delete and recreate? (y/N): 
```

### 2. Release Existence Check

Script checks if release exists on GitHub:

```bash
# If release exists, asks for confirmation
[WARN] Release v0.4.25 already exists!
Delete and recreate? (y/N): 
```

### 3. Uncommitted Changes

Script commits uncommitted changes automatically:

```bash
[INFO] Committing uncommitted changes...
[INFO] Pushing code to GitHub...
```

### 4. Authentication Check

Script verifies gh CLI authentication:

```bash
# If not authenticated
[ERROR] GitHub CLI not authenticated
[INFO] Run 'gh auth login' to authenticate
```

---

## Troubleshooting

### Error: Git not found

```bash
# Install git
sudo apt install git  # Ubuntu/Debian
brew install git      # macOS
```

### Error: GitHub CLI not found

```bash
# Install gh
# See Prerequisites section above
```

### Error: Not authenticated

```bash
# Authenticate
gh auth login
```

### Error: Tag already exists

```bash
# Script will ask to delete and recreate
# Answer 'y' to proceed

# Or manually delete:
git tag -d v0.4.25
git push origin :refs/tags/v0.4.25
```

### Error: Release already exists

```bash
# Script will ask to delete and recreate
# Answer 'y' to proceed

# Or manually delete via GitHub UI:
# Go to releases, delete release, then run script again
```

### Error: Permission denied

```bash
# Make script executable
chmod +x scripts/create_release.sh
```

---

## Manual Override

If you want **manual control** instead of automation:

### Option 1: Manual Git Operations

```bash
# Build artifacts only
./scripts/create_release.sh v0.4.25

# Then manually:
git commit -m "release: v0.4.25"
git push
git tag -a v0.4.25 -m "PRISM v0.4.25"
git push origin v0.4.25

# Create release via GitHub UI:
# https://github.com/mriza/prism/releases/new
```

### Option 2: Use gh CLI Manually

```bash
# Build artifacts
./scripts/create_release.sh v0.4.25

# Create release manually
cd .release
gh release create v0.4.25 \
  --repo mriza/prism \
  --title "PRISM v0.4.25" \
  --notes-file "RELEASE_NOTES.md" \
  --draft \
  *.tar.gz
```

---

## Best Practices

### Before Release

1. ✅ **Test locally**
   ```bash
   # Run tests
   npm test
   go test ./...
   ```

2. ✅ **Check build**
   ```bash
   npm run build
   go build ./cmd/server
   go build ./cmd/agent
   ```

3. ✅ **Review changes**
   ```bash
   git diff
   git status
   ```

### During Release

1. ✅ **Monitor output**
   - Watch for errors
   - Verify all steps complete

2. ✅ **Verify release**
   - Check GitHub release page
   - Download and test artifacts

### After Release

1. ✅ **Test deployment**
   ```bash
   # Download from release
   curl -LO https://github.com/mriza/prism/releases/latest/download/prism-server-v0.4.25-linux-amd64.tar.gz
   
   # Install and test
   tar -xzf prism-server-v0.4.25-linux-amd64.tar.gz
   ./prism-server --version
   ```

2. ✅ **Announce release**
   - Update documentation
   - Notify team/users
   - Update changelog

---

## Comparison: Before vs After

| Feature | Before | After |
|---------|--------|-------|
| Git commit | Manual | ✅ Automatic |
| Git push | Manual | ✅ Automatic |
| Git tag | Manual | ✅ Automatic |
| Tag push | Manual | ✅ Automatic |
| Release create | Manual/Optional | ✅ Automatic |
| Release publish | Manual (draft) | ✅ Automatic (published) |
| Set as latest | Manual | ✅ Automatic |
| **Total Steps** | **7-8 manual** | **1 command** |

---

## Summary

**One Command Does It All**:

```bash
./scripts/create_release.sh v0.4.25
```

**Result**:
- ✅ Code committed and pushed
- ✅ Tag created and pushed
- ✅ Release created and published
- ✅ Artifacts uploaded
- ✅ Set as latest release
- ✅ Ready for users!

**Time Saved**: 10-15 minutes → 1 command! ⚡

---

**Last Updated**: 2026-04-02  
**Version**: 2.0 (Fully Automated)  
**Maintained By**: PRISM Development Team
