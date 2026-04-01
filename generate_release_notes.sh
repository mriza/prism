#!/bin/bash

# Generate Release Notes for PRISM
# Usage: ./generate_release_notes.sh v0.4.10

set -e

VERSION=${1:-""}

if [ -z "$VERSION" ]; then
    echo "Usage: $0 <version>"
    echo "Example: $0 v0.4.10"
    exit 1
fi

OUTPUT_FILE="RELEASE_NOTES_${VERSION}.md"

echo "Generating release notes for $VERSION..."
echo ""

# Get version history from BUG.md
echo "Reading bug fixes from BUG.md..."
FIXED_BUGS=$(grep -A 2 "FIXED in $VERSION" BUG.md | grep "###" | sed 's/### //' || echo "")

# Get recent commits
echo "Reading recent commits..."
COMMITS=$(git log --oneline --since="2026-03-01" | head -20 || echo "")

# Count files changed
FILES_CHANGED=$(git diff --name-only $(git describe --tags --abbrev=0 2>/dev/null || echo "HEAD~10") HEAD 2>/dev/null | wc -l || echo "Unknown")

# Generate release notes
cat > "$OUTPUT_FILE" << EOF
# PRISM $VERSION - Release Notes

**Release Date**: $(date +%Y-%m-%d)  
**Version**: $VERSION  
**Status**: ✅ Stable Release

---

## 🎉 What's New

### Major Features
<!-- Add major features here -->
- Feature 1
- Feature 2

### Minor Features
<!-- Add minor features here -->
- Feature 3

---

## 🐛 Bug Fixes

<!-- Auto-generated from BUG.md -->
$FIXED_BUGS

### Other Fixes
- Fix 1
- Fix 2

---

## 📦 New Components

### Frontend
- \`component1.tsx\`
- \`component2.tsx\`

### Server
- \`endpoint1.go\`
- \`endpoint2.go\`

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
- **Files Changed**: $FILES_CHANGED
- **Commits**: $(echo "$COMMITS" | wc -l | tr -d ' ')
- **Lines Added**: TBD
- **Lines Removed**: TBD

### Bug Fixes
- **Total Bugs Fixed**: TBD
- **Critical**: TBD
- **Medium**: TBD
- **Low**: TBD

### Test Coverage
- **Server Tests**: TBD tests (TBD% pass)
- **Agent Tests**: TBD tests (TBD% pass)
- **Frontend Tests**: TBD tests (TBD% pass)
- **Overall**: TBD tests (TBD% pass)

---

## ⚠️ Known Issues

- **BUG-XXX**: Description
- **BUG-XXX**: Description

---

## 🚀 Upgrade Guide

### Server Upgrade
\`\`\`bash
cd server
go build -o prism-server cmd/server/main.go
./prism-server
\`\`\`

### Agent Upgrade
\`\`\`bash
cd agent
go build -o prism-agent cmd/agent/*.go
./prism-agent
\`\`\`

### Frontend Upgrade
\`\`\`bash
cd frontend
npm install
npm run build
\`\`\`

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
- [CHANGELOG.md](./CHANGELOG.md)

---

## 👥 Contributors

Thanks to all contributors who made this release possible!

---

## 📅 Next Release

**Next Version** (Planned: YYYY-MM-DD)
- Focus: ___
- Planned features: ___

---

**Full Changelog**: [$(git describe --tags --abbrev=0 2>/dev/null || echo "initial")...$VERSION](compare/$(git describe --tags --abbrev=0 2>/dev/null || echo "initial")...$VERSION)

---

*This release was generated automatically. Please review and update as needed.*
EOF

echo ""
echo "✅ Release notes generated: $OUTPUT_FILE"
echo ""
echo "Next steps:"
echo "1. Review and edit: $OUTPUT_FILE"
echo "2. Fill in TBD sections"
echo "3. Run: ./create_release.sh $VERSION"
echo ""
