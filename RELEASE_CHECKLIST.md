# PRISM Release Checklist

> **Purpose**: Ensure quality and consistency for every PRISM release
> 
> **Last Updated**: 2026-04-02 (v0.4.21)

---

## Pre-Release Checklist

### Code Quality ✅
- [x] All builds passing (server, agent, frontend)
- [x] No TypeScript errors
- [x] No Go compilation errors
- [x] No console.log in production code
- [x] No useState<any> loose typing
- [x] Code chunking optimized (antd split into vendor + icons)

### Testing ✅
- [x] Frontend tests passing (25+ tests)
- [x] Server tests running
- [x] Agent tests running
- [x] No test regressions

### Documentation ✅
- [x] BUG.md updated
- [x] TODO.md updated
- [x] IMPLEMENTED.md updated
- [x] CHANGELOG.md updated
- [x] No duplicate audit files

### Performance ✅
- [x] Build size acceptable
  - react-vendor: 48 kB (gzipped: 17 kB)
  - antd-vendor: 1048 kB (gzipped: 339 kB)
  - antd-icons: 49 kB (gzipped: 13 kB)
  - app bundle: 200 kB (gzipped: 48 kB)
- [x] No memory leaks detected
- [x] API response times acceptable

### Security ✅
- [x] No hardcoded credentials
- [x] SQL injection protection (parameterized queries)
- [x] XSS protection (React escapes by default)
- [x] CSRF protection (token-based auth)
- [x] Authentication middleware applied

---

## Release Process

### 1. Version Bump
- [ ] Update version in:
  - `frontend/package.json`
  - `server/cmd/server/main.go` (if applicable)
  - `agent/cmd/agent/main.go` (if applicable)

### 2. Git Tag
```bash
git tag -a v0.4.21 -m "PRISM v0.4.21 - Documentation Consolidation & Build Optimization"
git push origin v0.4.21
```

### 3. Release Notes
- [ ] Create `RELEASE_NOTES_v0.4.21.md`
- [ ] Include:
  - Key features
  - Bug fixes
  - Breaking changes (if any)
  - Migration notes (if any)
  - Build artifacts

### 4. Build Artifacts
```bash
# Server
cd server && go build -o prism-server ./cmd/server

# Agent
cd agent && go build -o prism-agent ./cmd/agent

# Frontend
cd frontend && npm run build
```

### 5. Deployment
- [ ] Deploy to staging
- [ ] Smoke test
- [ ] Deploy to production
- [ ] Monitor for issues

---

## Post-Release

### Documentation
- [ ] Update README.md with new version
- [ ] Update MIGRATION_GUIDE.md if breaking changes
- [ ] Create GitHub release

### Monitoring
- [ ] Check error logs
- [ ] Monitor performance metrics
- [ ] Review user feedback

### Retrospective
- [ ] What went well?
- [ ] What could be improved?
- [ ] Action items for next release

---

## Quality Metrics (v0.4.21)

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| **Build Success** | 100% | 100% | ✅ |
| **Test Pass Rate** | >95% | 97% | ✅ |
| **Bug Resolution** | 100% | 100% | ✅ |
| **Code Coverage** | >70% | TBD | ⏳ |
| **Build Size** | <2MB | 1.3MB | ✅ |
| **Console Statements** | 0 | 0 | ✅ |
| **Loose Typing** | 0 | 0 | ✅ |

---

## Release History

| Version | Date | Key Features | Status |
|---------|------|--------------|--------|
| v0.4.21 | 2026-04-02 | Build optimization, doc consolidation | ✅ Current |
| v0.4.20 | 2026-04-02 | Font weight standardization | ✅ |
| v0.4.19 | 2026-04-02 | Font size improvements | ✅ |
| v0.4.17 | 2026-04-01 | ALL 50 original bugs fixed | ✅ |

---

**For detailed changelog**: See [CHANGELOG.md](./CHANGELOG.md)
**For bug tracking**: See [BUG.md](./BUG.md)
**For roadmap**: See [TODO.md](./TODO.md)
