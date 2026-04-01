# PRISM Release Checklist

**Version**: v___  
**Release Date**: YYYY-MM-DD  
**Release Manager**: ___

---

## Pre-Release Checklist

### Code Quality
- [ ] All server tests passing (`cd server && go test ./...`)
- [ ] All agent tests passing (`cd agent && go test ./...`)
- [ ] Frontend build successful (`cd frontend && npm run build`)
- [ ] No TypeScript errors
- [ ] Code formatted (`go fmt ./...`, `npm run lint`)

### Documentation
- [ ] BUG.md updated with latest fixes
- [ ] TODO.md updated with completed items
- [ ] README.md version updated
- [ ] IMPLEMENTED.md version history updated
- [ ] Release notes drafted

### Testing
- [ ] Manual testing completed
- [ ] Critical flows verified:
  - [ ] User login/logout
  - [ ] Project CRUD
  - [ ] Account provisioning
  - [ ] Deployment flow
  - [ ] User management
  - [ ] Password change
- [ ] No regressions detected

### Build Artifacts
- [ ] Server binary built (`server/prism-server`)
- [ ] Agent binary built (`agent/prism-agent`)
- [ ] Frontend built (`frontend/dist/`)
- [ ] Deployment package created (`prism_deploy.tar.gz`)

---

## Release Creation

### Step 1: Update Version Numbers

**Files to update**:
- [ ] `README.md` - Update version badge
- [ ] `frontend/package.json` - Update version
- [ ] `server/cmd/server/main.go` - Update version constant (if exists)
- [ ] `agent/cmd/agent/main.go` - Update version constant (if exists)

### Step 2: Commit Changes

```bash
# Create release branch
git checkout -b release/v0.4.x

# Add all changes
git add .

# Commit with release message
git commit -m "Release v0.4.x

- Feature 1
- Feature 2
- Bug fixes: #123, #124, #125"

# Push branch
git push origin release/v0.4.x
```

### Step 3: Create Tag

```bash
# Create annotated tag
git tag -a v0.4.x -m "Release v0.4.x"

# Push tag
git push origin v0.4.x
```

### Step 4: Create GitHub Release

**Option A: Using Script**
```bash
./create_release.sh v0.4.x
```

**Option B: Manual**
1. Go to GitHub Releases: https://github.com/ORG/prism/releases/new
2. Tag version: `v0.4.x`
3. Release title: `PRISM v0.4.x`
4. Copy release notes from `RELEASE_NOTES_v0.4.x.md`
5. Attach binaries (optional)
6. Click "Publish release"

**Option C: Using gh CLI**
```bash
gh release create v0.4.x \
  --title "PRISM v0.4.x" \
  --notes-file RELEASE_NOTES_v0.4.x.md \
  --verify-tag \
  --latest
```

---

## Post-Release

### Documentation
- [ ] Update CHANGELOG.md
- [ ] Update MIGRATION_GUIDE.md (if breaking changes)
- [ ] Create release announcement
- [ ] Update project website/docs

### Communication
- [ ] Notify team via Slack/Email
- [ ] Create release announcement post
- [ ] Update project roadmap
- [ ] Share on social media (if applicable)

### Deployment
- [ ] Deploy to staging environment
- [ ] Verify staging deployment
- [ ] Deploy to production
- [ ] Monitor for errors/issues
- [ ] Create hotfix if needed

### Cleanup
- [ ] Delete release branch
- [ ] Close associated milestones
- [ ] Update project board
- [ ] Archive completed issues

---

## Release Notes Template

```markdown
# PRISM v0.4.x - Release Notes

**Release Date**: YYYY-MM-DD  
**Version**: v0.4.x  
**Status**: ✅ Stable Release

---

## 🎉 What's New

### Major Features
- Feature 1
- Feature 2

### Minor Features
- Feature 3
- Feature 4

---

## 🐛 Bug Fixes

### Critical
- ✅ **BUG-XXX**: Description

### Medium
- ✅ **BUG-XXX**: Description

### Low
- ✅ **BUG-XXX**: Description

---

## 📦 New Components

### Frontend
- `component1.tsx`
- `component2.tsx`

### Server
- `endpoint1.go`
- `endpoint2.go`

---

## 🔧 Technical Changes

### Server
- Change 1
- Change 2

### Frontend
- Change 1
- Change 2

### Documentation
- Doc 1
- Doc 2

---

## 📊 Statistics

### Code Changes
- **Files Created**: X
- **Files Modified**: X
- **Lines Added**: X+
- **Lines Removed**: X

### Bug Fixes
- **Total Bugs Fixed**: X
- **Critical**: X
- **Medium**: X
- **Low**: X

### Test Coverage
- **Server Tests**: X tests (X% pass)
- **Agent Tests**: X tests (X% pass)
- **Frontend Tests**: X tests (X% pass)
- **Overall**: X tests (X% pass)

---

## ⚠️ Known Issues

- **BUG-XXX**: Description
- **BUG-XXX**: Description

---

## 🚀 Upgrade Guide

### Server Upgrade
```bash
cd server
go build -o prism-server cmd/server/main.go
./prism-server
```

### Agent Upgrade
```bash
cd agent
go build -o prism-agent cmd/agent/*.go
./prism-agent
```

### Frontend Upgrade
```bash
cd frontend
npm install
npm run build
```

---

## 📝 Migration Notes

### Breaking Changes
None / Describe breaking changes and migration path

### Deprecations
- Deprecated feature 1
- Deprecated feature 2

---

## 🔒 Security Features

- Security feature 1
- Security feature 2

---

## 📖 Documentation

- [README.md](./README.md)
- [BUG.md](./BUG.md)
- [TODO.md](./TODO.md)

---

## 👥 Contributors

Thanks to all contributors!

---

## 📅 Next Release

**v0.5.0** (Planned: YYYY-MM-DD)
- Focus: ___
- Planned features: ___

---

**Full Changelog**: [v0.4.x-1...v0.4.x](compare/v0.4.x-1...v0.4.x)
```

---

## Quick Reference

### Build Commands
```bash
# Server
cd server && go build -o prism-server cmd/server/main.go

# Agent
cd agent && go build -o prism-agent cmd/agent/*.go

# Frontend
cd frontend && npm run build

# Test All
cd server && go test ./...
cd agent && go test ./...
cd frontend && npm test
```

### Git Commands
```bash
# Create release branch
git checkout -b release/v0.4.x

# Create tag
git tag -a v0.4.x -m "Release v0.4.x"

# Push
git push origin v0.4.x
```

### Release Script
```bash
# Create release
./create_release.sh v0.4.x
```

---

*Last Updated: YYYY-MM-DD*
