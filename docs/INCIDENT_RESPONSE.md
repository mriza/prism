# PRISM Incident Response Plan

> **Version**: 1.0
> **Last Updated**: 2026-04-12
> **Status**: Active

This document outlines the standard operating procedures for detecting, containing, and recovering from security incidents or major outages affecting the PRISM infrastructure management platform.

---

## 1. Incident Classification

Incidents are classified into three severity levels:

### 🔴 SEV-1 (Critical)
- **Criteria**: Complete loss of Hub availability, active security breach, data exfiltration, or loss of control over Agent networks.
- **Response Time**: Immediate (24/7)
- **Action**: Halt non-essential services, initiate lockdown protocols.

### 🟠 SEV-2 (High)
- **Criteria**: Partial outage affecting core features (e.g., deployments failing, WebSockets dropping), suspected unauthorized access, or configuration drift in critical services.
- **Response Time**: < 4 Hours
- **Action**: Isolate affected agents, perform rollback of recent deployments.

### 🟡 SEV-3 (Medium/Low)
- **Criteria**: Non-critical components failing (e.g., metrics delayed, UI bugs), localized agent failures without widespread impact.
- **Response Time**: Next business day
- **Action**: Standard debugging and patch management.

---

## 2. Response Workflow

### Phase 1: Detection & Identification
1. **Alert Sources**: Prometheus/Grafana alerts, CrowdSec anomaly detection, or user reports.
2. **Initial Assessment**: The on-call engineer evaluates the alert and assigns a severity level.
3. **Communication**: Open an incident channel in Slack/Teams. Notify stakeholders for SEV-1 and SEV-2.

### Phase 2: Containment
1. **Network Isolation**: If an Agent is compromised, use the PRISM Hub to issue a global firewall block via CrowdSec or UFW against the malicious IP.
2. **Hub Lockdown**: In the event of a Hub compromise, immediately revoke the `HubToken` and rotate the `jwt_secret` in `prism-server.conf`.
3. **Session Termination**: Force logout all active users and terminate active agent WebSockets to force re-authentication.

### Phase 3: Eradication
1. **Malware Removal**: Use PRISM's service manager to kill unauthorized processes and remove malicious files.
2. **Patching**: Deploy hotfixes to the Hub or update Agent binaries using the automated deployment scripts (`deploy-to-vm.sh`).
3. **Credential Rotation**: Rotate all database passwords, API keys, and management credentials stored in the `ManagementCredentials` table.

### Phase 4: Recovery
1. **Database Restoration**: If data corruption occurred, restore `prism.db` from the latest backup (or Valkey cache snapshot).
2. **Service Restart**: Sequentially restart the Hub server, then allow Agents to reconnect.
3. **Validation**: Use the E2E testing suite (Puppeteer) to verify functionality before declaring the incident resolved.

### Phase 5: Post-Incident Activity
1. **Post-Mortem**: Within 48 hours of resolution, the team must complete a blame-free post-mortem document.
2. **Audit Logs Review**: Analyze the `events` and `audit_retention` tables to determine the root cause and timeline.
3. **Process Improvement**: Create Jira/TODO tickets to address the vulnerabilities or monitoring gaps discovered during the incident.

---

## 3. Emergency Contacts & Roles

| Role | Responsibility | Contact Method |
|------|----------------|----------------|
| **Incident Commander** | Coordinates the entire response effort, makes critical decisions (e.g., shutting down the Hub). | PagerDuty / Phone |
| **Lead Engineer** | Leads the technical investigation, executes containment strategies. | Slack / Phone |
| **Communications Lead** | Updates stakeholders and users on the status of the incident. | Email / Slack |

## 4. Useful Commands during an Incident

**Force Hub Shutdown:**
```bash
sudo systemctl stop prism-server
```

**Global Agent Disconnect (Token Revocation):**
```bash
# Edit prism-server.conf
sed -i 's/token = .*/token = "NEW_SECURE_TOKEN_IMMEDIATE"/g' /opt/prism/server/prism-server.conf
sudo systemctl restart prism-server
```

**Check Recent Authentication Failures:**
```sql
sqlite3 prism.db "SELECT * FROM events WHERE type='login_failed' ORDER BY timestamp DESC LIMIT 50;"
```
