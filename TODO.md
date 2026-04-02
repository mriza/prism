# TODO — PRISM Development Roadmap

> **Last Updated**: 2026-04-02 (v0.4.24 — DevOps scripts completed)
>
> **Purpose**: Development roadmap for PRISM project
>
> **Related Documents**:
> - [BUG.md](./BUG.md) - Bug reports
> - [IMPLEMENTED.md](./IMPLEMENTED.md) - Implemented features

---

## Recent Releases

### ✅ v0.4.24 (2026-04-02) - DevOps Automation 🚀
- ✅ **Service Activity Logs** — Activity tab in ServiceDetailModal
- ✅ **GitHub Release Script** — `scripts/create_github_release.sh`
- ✅ **Deployment Script** — `deploy.sh` (simplified, user-friendly)

### ✅ v0.4.23 (2026-04-02) - Error Handling & Type Safety 🛡️
- ✅ BUG-019: Console.log removal
- ✅ BUG-033: Loose any[] typing fixed

### ✅ v0.4.22 (2026-04-02) - Font Standardization 🎨
- ✅ BUG-044: 36 fontWeight/fontSize fixes

---

## v0.5.0 - Planned Features

### Major Refactoring
- [ ] **Applications Page Overhaul** — Unify deployments and processes
- [ ] **Multi-Runtime Support** — Node.js, Python, PHP, Go, Java
- [ ] **Container Deployments** — Docker and Podman support

### New Features
- [ ] **Service Activity Logs Enhancement** — More event types
- [ ] **Log Clearing & Retention** — Auto-cleanup policies
- [ ] **Configuration Drift Detection UI**
- [ ] **Webhook & Notifications UI**

### Technical Debt
- [ ] **Complete UI/UX Redesign** — Ant Design v6 guidelines
- [ ] **Accessibility Compliance** — WCAG 2.1 AA
- [ ] **Performance Optimization** — Bundle size reduction

### Testing
- [ ] **Frontend Pages Testing** — Complete test coverage
- [ ] **Integration Tests** — E2E flows
- [ ] **Agent Modules Testing** — Complete module tests

---

## Future Considerations

### v0.6.0+
- [ ] Multi-node Hub clustering
- [ ] Database backup & restore tooling
- [ ] Advanced RBAC with server groups
- [ ] API key authentication for CI/CD

### v1.0.0 (Long Term)
- [ ] Remove legacy agents table
- [ ] Stable API guarantee
- [ ] Enterprise features

---

## Quick Links

- [Bug Reports](./BUG.md)
- [Implemented Features](./IMPLEMENTED.md)
- [README](./README.md)
