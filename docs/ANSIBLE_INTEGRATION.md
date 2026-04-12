# PRISM Ansible Integration Guide

> **Version**: v0.5.1+
> **Last Updated**: 2026-04-11

This guide covers the Ansible-powered service deployment feature in PRISM, enabling zero-touch server provisioning from fresh installations to fully managed infrastructure.

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Prerequisites](#prerequisites)
4. [Ansible Playbook Structure](#ansible-playbook-structure)
5. [Service Deployment Workflow](#service-deployment-workflow)
6. [Account Provisioning with Ansible](#account-provisioning-with-ansible)
7. [Usage Examples](#usage-examples)
8. [Troubleshooting](#troubleshooting)

---

## Overview

PRISM integrates with Ansible to enable **automated service deployment** on target servers. This allows PRISM to:

- **Install services from scratch** on freshly provisioned servers
- **Configure services** with optimal defaults
- **Provision accounts** (users, databases, buckets) automatically
- **Ensure consistency** across all managed servers
- **Support idempotent deployments** (safe to run multiple times)

### Why Ansible?

- **Agentless** - Only requires SSH access, no additional agents
- **Idempotent** - Safe to run multiple times, only applies necessary changes
- **Declarative** - Define desired state, Ansible handles the rest
- **Extensible** - Easy to add custom roles and playbooks
- **Community-driven** - Leverage existing Ansible Galaxy roles

---

## Architecture

```
┌─────────────┐
│   PRISM     │
│   Hub       │
│  (Server)   │
└──────┬──────┘
       │ REST API
       │
       ▼
┌─────────────┐         SSH + Ansible          ┌──────────────┐
│   PRISM     │◄──────────────────────────────►│ Target Server │
│   Agent     │                                │ (Fresh Install)│
│  (Manager)  │                                │              │
└─────────────┘                                └──────┬───────┘
                                                      │
                                               Ansible Playbooks
                                                      │
                                        ┌─────────────▼────────────┐
                                        │                          │
                                   Install Services         Configure Accounts
                                   - MySQL                  - Create DB users
                                   - PostgreSQL             - Create databases
                                   - RabbitMQ               - Set permissions
                                   - MinIO                  - Create buckets
                                   - etc.                   - etc.
```

### How It Works

1. **User requests service deployment** via PRISM UI
2. **Hub sends command to Agent** on target server
3. **Agent executes Ansible playbook** via SSH to localhost or remote hosts
4. **Ansible installs & configures** the requested service
5. **Agent reports success/failure** back to Hub
6. **Service appears in PRISM dashboard** as managed service

---

## Prerequisites

### Target Server Requirements

- **SSH access** (password or key-based)
- **Python 3** installed (for Ansible modules)
- **Sudo privileges** for prism user
- **Internet access** (to download packages)

### Ansible Installation

**On PRISM Agent server**:
```bash
# Install Ansible
sudo apt update
sudo apt install -y ansible

# Verify installation
ansible --version

# Install required collections (optional, for specific services)
ansible-galaxy collection install community.mysql
ansible-galaxy collection install community.postgresql
ansible-galaxy collection install community.rabbitmq
```

### SSH Configuration

**Option 1: SSH Key-based (Recommended)**
```bash
# Generate SSH key for prism user
sudo -u prism ssh-keygen -t ed25519 -f /opt/prism/.ssh/id_ed25519

# Add to authorized_keys
cat /opt/prism/.ssh/id_ed25519.pub >> /opt/prism/.ssh/authorized_keys
chmod 600 /opt/prism/.ssh/authorized_keys
```

**Option 2: SSH Agent Forwarding**
```bash
# Enable SSH agent forwarding in sshd_config
sudo echo "AllowAgentForwarding yes" >> /etc/ssh/sshd_config
sudo systemctl restart sshd
```

---

## Ansible Playbook Structure

### Directory Layout

```
/opt/prism/ansible/
├── playbooks/
│   ├── mysql.yml
│   ├── postgresql.yml
│   ├── rabbitmq.yml
│   ├── minio.yml
│   ├── nginx.yml
│   └── caddy.yml
├── roles/
│   ├── mysql/
│   │   ├── tasks/
│   │   │   └── main.yml
│   │   ├── handlers/
│   │   │   └── main.yml
│   │   ├── templates/
│   │   │   └── my.cnf.j2
│   │   └── defaults/
│   │       └── main.yml
│   ├── postgresql/
│   ├── rabbitmq/
│   └── minio/
├── inventories/
│   └── localhost.ini
└── ansible.cfg
```

### Example Playbook: MySQL

**File**: `/opt/prism/ansible/playbooks/mysql.yml`

```yaml
---
- name: Install and configure MySQL
  hosts: localhost
  connection: local
  become: true
  
  vars:
    mysql_root_password: "{{ vault_mysql_root_password }}"
    mysql_databases:
      - name: "{{ db_name }}"
        encoding: utf8mb4
        collation: utf8mb4_unicode_ci
    mysql_users:
      - name: "{{ db_user }}"
        password: "{{ db_password }}"
        priv: "{{ db_name }}.*:ALL"
        host: "%"
  
  roles:
    - role: mysql
  
  tasks:
    - name: Ensure MySQL is running and enabled
      ansible.builtin.service:
        name: mysql
        state: started
        enabled: true
    
    - name: Create databases
      community.mysql.mysql_db:
        name: "{{ item.name }}"
        encoding: "{{ item.encoding }}"
        collation: "{{ item.collation }}"
        login_user: root
        login_password: "{{ mysql_root_password }}"
        state: present
      loop: "{{ mysql_databases }}"
    
    - name: Create database users
      community.mysql.mysql_user:
        name: "{{ item.name }}"
        password: "{{ item.password }}"
        priv: "{{ item.priv }}"
        host: "{{ item.host }}"
        login_user: root
        login_password: "{{ mysql_root_password }}"
        state: present
      loop: "{{ mysql_users }}"
```

### Example Playbook: RabbitMQ

**File**: `/opt/prism/ansible/playbooks/rabbitmq.yml`

```yaml
---
- name: Install and configure RabbitMQ
  hosts: localhost
  connection: local
  become: true
  
  vars:
    rabbitmq_users:
      - username: "{{ rmq_user }}"
        password: "{{ rmq_password }}"
        vhost: "{{ rmq_vhost }}"
        configure_priv: ".*"
        write_priv: ".*"
        read_priv: ".*"
  
  tasks:
    - name: Install RabbitMQ
      ansible.builtin.apt:
        name: rabbitmq-server
        state: present
        update_cache: true
    
    - name: Enable RabbitMQ management plugin
      community.rabbitmq.rabbitmq_plugin:
        names:
          - rabbitmq_management
        state: enabled
      notify: Restart RabbitMQ
    
    - name: Start and enable RabbitMQ
      ansible.builtin.service:
        name: rabbitmq-server
        state: started
        enabled: true
    
    - name: Create virtual host
      community.rabbitmq.rabbitmq_vhost:
        name: "{{ rmq_vhost }}"
        state: present
    
    - name: Create RabbitMQ users
      community.rabbitmq.rabbitmq_user:
        user: "{{ item.username }}"
        password: "{{ item.password }}"
        vhost: "{{ item.vhost }}"
        configure_priv: "{{ item.configure_priv }}"
        write_priv: "{{ item.write_priv }}"
        read_priv: "{{ item.read_priv }}"
        state: present
      loop: "{{ rabbitmq_users }}"
  
  handlers:
    - name: Restart RabbitMQ
      ansible.builtin.service:
        name: rabbitmq-server
        state: restarted
```

---

## Service Deployment Workflow

### 1. User Initiates Deployment

Via PRISM UI:
1. Navigate to **Services** page
2. Click **"Add Service"** on target server
3. Select service type (e.g., MySQL, RabbitMQ)
4. Fill in configuration details
5. Click **"Deploy"**

### 2. Hub Sends Command to Agent

```json
{
  "agent_id": "agent-123",
  "action": "ansible_deploy_service",
  "service": "mysql",
  "options": {
    "db_name": "myapp_db",
    "db_user": "myapp_user",
    "db_password": "secure_password",
    "playbook": "/opt/prism/ansible/playbooks/mysql.yml"
  }
}
```

### 3. Agent Executes Ansible Playbook

```bash
# Agent runs this command
ansible-playbook /opt/prism/ansible/playbooks/mysql.yml \
  -e "db_name=myapp_db" \
  -e "db_user=myapp_user" \
  -e "db_password=secure_password" \
  --vault-password-file /opt/prism/config/.vault_pass
```

### 4. Agent Reports Results

```json
{
  "success": true,
  "message": "MySQL deployed successfully",
  "details": {
    "changed": 15,
    "ok": 20,
    "failed": 0,
    "skipped": 2
  }
}
```

---

## Account Provisioning with Ansible

### How It Works

When user creates an account via PRISM UI:

1. **Hub generates credentials** (or uses user-provided)
2. **Hub sends command to Agent** with account details
3. **Agent runs Ansible playbook** to create account
4. **Account credentials stored** in PRISM database (encrypted)
5. **Account appears** in PRISM UI

### Example: Create Database User

**API Request**:
```json
POST /api/accounts
{
  "server_id": "server-123",
  "service": "mysql",
  "account_type": "database_user",
  "config": {
    "database": "myapp_db",
    "username": "app_user",
    "password": "secure_password",
    "privileges": "SELECT,INSERT,UPDATE,DELETE"
  }
}
```

**Ansible Task**:
```yaml
- name: Create MySQL user
  community.mysql.mysql_user:
    name: "app_user"
    password: "secure_password"
    priv: "myapp_db.*:SELECT,INSERT,UPDATE,DELETE"
    host: "%"
    login_user: root
    login_password: "{{ mysql_root_password }}"
    state: present
```

---

## Usage Examples

### Example 1: Deploy MySQL on Fresh Server

**Step 1**: Register server with PRISM Agent
```bash
sudo ./prism_install_agent.sh
```

**Step 2**: Deploy MySQL via PRISM UI
- Go to Services → Add Service → MySQL
- Configure:
  - Database name: `production_db`
  - Username: `app_user`
  - Password: (auto-generated or manual)
- Click **Deploy**

**Step 3**: Verify deployment
```bash
# Check MySQL status
sudo systemctl status mysql

# Verify database exists
mysql -u root -p -e "SHOW DATABASES;"

# Verify user exists
mysql -u root -p -e "SELECT user, host FROM mysql.user WHERE user='app_user';"
```

### Example 2: Deploy RabbitMQ Cluster

```yaml
# playbooks/rabbitmq-cluster.yml
---
- name: Deploy RabbitMQ Cluster
  hosts: rabbitmq_servers
  become: true
  
  vars:
    rabbitmq_cluster_nodes:
      - rabbit1.example.com
      - rabbit2.example.com
      - rabbit3.example.com
  
  tasks:
    - name: Install RabbitMQ
      ansible.builtin.apt:
        name: rabbitmq-server
        state: present
    
    - name: Join cluster
      community.rabbitmq.rabbitmq_cluster:
        node: "rabbit@{{ inventory_hostname }}"
        ram_node: false
```

### Example 3: Bulk Deploy Services to Multiple Servers

```bash
# Deploy to all servers in inventory
ansible-playbook playbooks/mysql.yml \
  -i inventories/production.ini \
  -e "deploy_all=true"
```

---

## Security Considerations

### 1. Vault Encryption

**Store sensitive credentials in Ansible Vault**:
```bash
# Create vault password file
echo "your_vault_password" > /opt/prism/ansible/.vault_pass
chmod 600 /opt/prism/ansible/.vault_pass

# Encrypt sensitive variables
ansible-vault encrypt_string --vault-password-file .vault_pass 'my_secret_password' --name 'db_password'
```

**Use in playbooks**:
```yaml
vars_files:
  - vault.yml
```

### 2. SSH Key Management

- Use dedicated SSH key for Ansible (not user keys)
- Restrict key permissions in `authorized_keys`:
  ```
  command="ansible-playbook *" ssh-ed25519 AAAA...
  ```

### 3. Principle of Least Privilege

- Ansible should run with minimal required privileges
- Use `become: true` only when necessary
- Restrict sudo access to specific commands

---

## Troubleshooting

### Ansible Not Found

**Symptom**: `ansible-playbook: command not found`

**Solution**:
```bash
# Install Ansible
sudo apt update && sudo apt install -y ansible

# Verify installation
ansible --version
```

### SSH Connection Failed

**Symptom**: `Failed to connect to the host via ssh`

**Solution**:
```bash
# Test SSH connection
ssh -i /opt/prism/.ssh/id_ed25519 prism@localhost

# Check SSH service
sudo systemctl status sshd

# Verify authorized_keys
cat /opt/prism/.ssh/authorized_keys
```

### Playbook Execution Failed

**Symptom**: Ansible playbook fails with errors

**Solution**:
```bash
# Run with verbose output
ansible-playbook playbooks/mysql.yml -vvv

# Check syntax
ansible-playbook playbooks/mysql.yml --syntax-check

# Run in check mode (dry run)
ansible-playbook playbooks/mysql.yml --check
```

### Permission Denied

**Symptom**: `Permission denied` errors during playbook execution

**Solution**:
```bash
# Verify sudo access
sudo -l

# Check prism user sudoers
sudo cat /etc/sudoers.d/prism

# Ensure correct permissions
sudo chmod 755 /opt/prism/ansible
sudo chmod 644 /opt/prism/ansible/playbooks/*.yml
```

---

## Best Practices

### 1. Use Roles

Organize playbooks into reusable roles:
```
roles/
├── common/
├── mysql/
├── postgresql/
└── rabbitmq/
```

### 2. Version Control Playbooks

```bash
cd /opt/prism/ansible
git init
git add .
git commit -m "Initial Ansible playbooks"
```

### 3. Test Before Deploying

```bash
# Always run in check mode first
ansible-playbook playbooks/mysql.yml --check --diff

# Then deploy
ansible-playbook playbooks/mysql.yml
```

### 4. Monitor Deployments

```bash
# Watch Ansible output in real-time
tail -f /var/log/prism-ansible.log

# Check PRISM Agent logs
journalctl -u prism-agent -f
```

### 5. Backup Before Changes

```yaml
- name: Backup existing configuration
  ansible.builtin.command:
    cmd: mysqldump --all-databases > /backup/mysql_{{ ansible_date_time.iso8601 }}.sql
  when: backup_before_deploy | bool
```

---

## Future Enhancements

### Planned Features

- [ ] **Ansible Tower/AWX integration** - Web UI for playbook management
- [ ] **Dynamic inventory** - Auto-discover servers from PRISM database
- [ ] **Custom modules** - PRISM-specific Ansible modules
- [ ] **Playbook marketplace** - Community-contributed playbooks
- [ ] **Rollback support** - Automatic rollback on failure
- [ ] **Git integration** - Version-controlled playbooks with GitOps
- [ ] **Multi-cloud support** - Deploy to AWS, GCP, Azure via Ansible

---

**Last Updated**: 2026-04-11
**Version**: v0.5.1
**Maintained By**: PRISM Development Team
