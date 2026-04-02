# PRISM Versioning Guide

> **Purpose**: Standardized versioning and release process for PRISM project
>
> **Version Scheme**: Semantic Versioning (SemVer) - MAJOR.MINOR.PATCH

---

## Version Numbering

### Semantic Versioning (SemVer)

PRISM follows [Semantic Versioning 2.0.0](https://semver.org/):

```
MAJOR.MINOR.PATCH
```

**Examples**:
- `v0.4.24` → MAJOR=0, MINOR=4, PATCH=24
- `v1.0.0` → MAJOR=1, MINOR=0, PATCH=0
- `v2.1.5` → MAJOR=2, MINOR=1, PATCH=5

### When to Increment

| Version Part | When to Increment | Examples |
|-------------|-------------------|----------|
| **MAJOR** | Breaking API changes, incompatible changes | `v0.x.x` → `v1.0.0`, `v1.x.x` → `v2.0.0` |
| **MINOR** | New features (backward compatible) | `v0.4.24` → `v0.5.0`, `v1.2.0` → `v1.3.0` |
| **PATCH** | Bug fixes, documentation updates | `v0.4.23` → `v0.4.24`, `v1.2.3` → `v1.2.4` |

### Pre-release Versions

For beta, alpha, or release candidates:

```
MAJOR.MINOR.PATCH-PRERELEASE.N
```

**Examples**:
- `v1.0.0-beta.1` - First beta of v1.0.0
- `v1.0.0-rc.3` - Third release candidate
- `v0.5.0-alpha.2` - Second alpha of v0.5.0

---

## Release Schedule

### Regular Releases

| Version Type | Frequency | When |
|-------------|-----------|------|
| **PATCH** (v0.4.x) | Weekly | Every Thursday |
| **MINOR** (v0.x.0) | Monthly | First release of each month |
| **MAJOR** (vx.0.0) | Quarterly | Based on milestone completion |

### Example Timeline

**v0.4.x Series** (Current):
```
v0.4.24 → v0.4.25 → v0.4.26 → v0.4.27 → v0.5.0
  ↑         ↑         ↑         ↑         ↑
Apr 2    Apr 9    Apr 16   Apr 23   May 1
```

**v0.5.x Series** (Next):
```
v0.5.0 → v0.5.1 → v0.5.2 → v0.6.0
  ↑       ↑       ↑       ↑
May 1   May 8   May 15  Jun 1
```

---

## Release Process

### Step-by-Step Guide

#### 1. Pre-Release Preparation (1-2 days before)

**Checklist**:
- [ ] All tests passing (`npm test`, `go test ./...`)
- [ ] Build successful (frontend, server, agent)
- [ ] No critical bugs open
- [ ] CHANGELOG.md updated
- [ ] Documentation updated (README, BUG, TODO, IMPLEMENTED)
- [ ] Version numbers updated in all files

**Files to Update**:
```markdown
README.md          → Update "Current Version" badge
BUG.md             → Update "Last Updated" version
TODO.md            → Add new release section
IMPLEMENTED.md     → Add new features list
```

#### 2. Create Release Commit

**Commit Message Format**:
```
release: v0.4.25 - [Release Name]

- Feature 1 added
- Feature 2 fixed
- Bug 3 resolved

See CHANGELOG.md for full list of changes.
```

**Example**:
```bash
git commit -am "release: v0.4.25 - Critical Fixes

- handleError utility adoption (83 catch blocks)
- OpenAPI specification created
- .env.example files added
- Documentation version updated

See CHANGELOG.md for full list of changes."
```

#### 3. Create Git Tag

**Automatic Version Detection**:

The release script can automatically determine the next version:

```bash
# Script reads VERSION.md and suggests next patch version
./scripts/create_release.sh

# Output:
# [INFO] Last version: v0.4.24
# [INFO] Suggested next version: v0.4.25
# [SUCCESS] Release v0.4.25 prepared successfully!

# Or specify version manually
./scripts/create_release.sh v0.5.0
```

**Manual Tag Creation**:
```bash
# Create annotated tag
git tag -a v0.4.25 -m "PRISM v0.4.25 - Critical Fixes"

# Push tag to remote
git push origin v0.4.25
```

#### 4. Build Release Artifacts

**Using Release Script**:
```bash
./scripts/create_release.sh v0.4.25
```

**Manual Build**:
```bash
# Build Server
cd server && go build -ldflags="-s -w -X main.Version=v0.4.25" -o prism-server ./cmd/server

# Build Agent
cd agent && go build -ldflags="-s -w -X main.Version=v0.4.25" -o prism-agent ./cmd/agent

# Build Frontend
cd frontend && npm run build

# Create tarballs
tar -czf prism-server-v0.4.25-linux-amd64.tar.gz -C server prism-server
tar -czf prism-agent-v0.4.25-linux-amd64.tar.gz -C agent prism-agent
tar -czf prism-frontend-v0.4.25.tar.gz -C frontend/dist .
```

#### 5. Create GitHub Release

**Using Script**:
```bash
# Script will create draft release
./scripts/create_release.sh v0.4.25
```

**Manual via GitHub CLI**:
```bash
# Create draft release with release notes
gh release create v0.4.25 \
  --repo mriza/prism \
  --title "PRISM v0.4.25" \
  --notes-file CHANGELOG.md \
  --draft \
  prism-server-v0.4.25-linux-amd64.tar.gz \
  prism-agent-v0.4.25-linux-amd64.tar.gz \
  prism-frontend-v0.4.25.tar.gz
```

**Via GitHub Web UI**:
1. Go to https://github.com/mriza/prism/releases/new
2. Tag version: `v0.4.25`
3. Release title: `PRISM v0.4.25 - Critical Fixes`
4. Paste release notes (see template below)
5. Upload artifacts
6. Check "Set as pre-release" if needed
7. Click "Publish release"

#### 6. Post-Release Tasks

**Within 24 hours**:
- [ ] Verify all artifacts download correctly
- [ ] Test deployment script with new release
- [ ] Update project website (if applicable)
- [ ] Announce release on communication channels

**Within 1 week**:
- [ ] Monitor for bugs/issues
- [ ] Respond to user feedback
- [ ] Update documentation if needed

---

## Release Notes Template

```markdown
# PRISM <VERSION>

## Release Information
- **Release Date**: YYYY-MM-DD
- **Previous Version**: v0.x.xx
- **Total Changes**: XX commits

## 🚀 New Features
- Feature 1 description
- Feature 2 description

## 🐛 Bug Fixes
- Bug fix 1 description
- Bug fix 2 description

## 📚 Documentation
- Documentation update 1
- Documentation update 2

## 🔧 Other Changes
- Other change 1
- Other change 2

## 📦 Installation

### Quick Deploy (Recommended)
```bash
curl -LO https://github.com/mriza/prism/raw/main/deploy.sh
chmod +x deploy.sh
sudo ./deploy.sh
```

### Manual Installation

#### Server
```bash
curl -LO https://github.com/mriza/prism/releases/download/<VERSION>/prism-server-<VERSION>-linux-amd64.tar.gz
tar -xzf prism-server-<VERSION>-linux-amd64.tar.gz
sudo mv prism-server-<VERSION> /opt/prism/server/prism-server
sudo chmod +x /opt/prism/server/prism-server
```

#### Agent
```bash
curl -LO https://github.com/mriza/prism/releases/download/<VERSION>/prism-agent-<VERSION>-linux-amd64.tar.gz
tar -xzf prism-agent-<VERSION>-linux-amd64.tar.gz
sudo mv prism-agent-<VERSION> /opt/prism/agent/prism-agent
sudo chmod +x /opt/prism/agent/prism-agent
```

## 🔐 Checksums
```
<SHA256 checksums here>
```

## 🔗 Links
- [GitHub Release](https://github.com/mriza/prism/releases/tag/<VERSION>)
- [Deployment Guide](https://github.com/mriza/prism/blob/main/deploy.sh)
- [Documentation](https://github.com/mriza/prism#readme)
- [Bug Reports](https://github.com/mriza/prism/issues)

---

*Generated automatically by PRISM Release Script*
```

---

## Documentation Update Checklist

For **EVERY** release, update these files:

### README.md
- [ ] Update "Current Version" badge (line 3)
- [ ] Update "Status" if applicable
- [ ] Add release to "Recent Releases" section
- [ ] Update "Known Issues" if needed

### BUG.md
- [ ] Update "Last Updated" header (line 3)
- [ ] Add new version to "Historical Bug Summary"
- [ ] Update bug counts if applicable

### TODO.md
- [ ] Update "Last Updated" header (line 3)
- [ ] Add new release to "Recent Releases" section
- [ ] Move completed items from TODO to "Recent Releases"
- [ ] Update version timeline if needed

### IMPLEMENTED.md
- [ ] Add new version section
- [ ] List all implemented features
- [ ] List all fixed bugs
- [ ] Update "Version History" table

### CHANGELOG.md
- [ ] Add new version header with date
- [ ] Categorize changes (Added, Changed, Fixed, Removed)
- [ ] Link to GitHub release
- [ ] Update "Unreleased" section

---

## Version History

| Version | Date | Type | Highlights |
|---------|------|------|------------|
| v0.4.24 | 2026-04-02 | PATCH | DevOps automation |
| v0.4.23 | 2026-04-02 | PATCH | Error handling & types |
| v0.4.22 | 2026-04-02 | PATCH | Font standardization |
| v0.4.21 | 2026-04-01 | PATCH | Font weight fixes |
| v0.4.20 | 2026-04-01 | PATCH | Font size improvements |
| v0.4.19 | 2026-04-01 | PATCH | Hardcoded styles cleanup |
| v0.4.17 | 2026-04-01 | PATCH | ALL original bugs fixed |
| v0.4.14 | 2026-04-01 | MINOR | Applications merge |
| v0.4.10 | 2026-04-01 | PATCH | Project color fix |
| v0.4.0 | 2026-03-01 | MINOR | Initial v0.4 release |
| v0.3.0 | 2026-02-01 | MINOR | Initial v0.3 release |

---

## Emergency Hotfix Process

For critical bugs in production:

### 1. Create Hotfix Branch

```bash
git checkout -b hotfix/v0.4.25-fix-name
```

### 2. Fix Bug & Test

```bash
# Make fix
# Test thoroughly
git commit -am "fix: critical bug description"
```

### 3. Release Hotfix

```bash
# Increment PATCH version
git checkout main
git merge hotfix/v0.4.25-fix-name
git tag -a v0.4.26 -m "PRISM v0.4.26 - Hotfix"
git push origin main v0.4.26
```

### 4. Document

- [ ] Update BUG.md with hotfix info
- [ ] Add to CHANGELOG.md
- [ ] Create GitHub release
- [ ] Notify affected users

---

## Best Practices

### Do's ✅
- ✅ Test thoroughly before release
- ✅ Write clear release notes
- ✅ Update ALL documentation files
- ✅ Use semantic versioning correctly
- ✅ Create git tags with annotations
- ✅ Build release artifacts cleanly
- ✅ Verify downloads work

### Don'ts ❌
- ❌ Release on Friday (unless emergency)
- ❌ Skip testing to meet deadline
- ❌ Update only some documentation
- ❌ Use vague commit messages
- ❌ Release with known critical bugs
- ❌ Forget to increment version numbers

---

## Questions?

For questions about versioning or releases:
- Check this document first
- Ask in project communication channel
- Review previous releases for examples

---

**Last Updated**: 2026-04-02  
**Version**: 1.0  
**Maintained By**: PRISM Development Team
