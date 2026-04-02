# PRISM VM Requirements

Configuration for QEMU/KVM virtual machine deployment.

---

## VM Connection Details

**Hypervisor**: QEMU/KVM  
**Connection URI**: `qemu:///system`  
**VM Name**: `prism-vm`  

---

## Access Credentials

| Parameter | Value | Notes |
|-----------|-------|-------|
| **Username** | `prism` | Default VM user |
| **Password** | `prism123` | Change in production! |
| **SSH Port** | 22 | Default SSH |
| **VNC Port** | 5900 | For graphical access (optional) |

---

## Network Configuration

**Network Type**: NAT (via libvirt default network)  
**Network Name**: `default`  
**Subnet**: `192.168.122.0/24`  

| Interface | IP Address | Gateway | DNS |
|-----------|-----------|---------|-----|
| **VM (eth0)** | `192.168.122.230` | `192.168.122.1` | `192.168.122.1` |
| **Host (virbr0)** | `192.168.122.1` | - | - |

**Note**: IP address is dynamically assigned by libvirt DHCP by default. To use static IP, see "Static IP Configuration" below.

---

## VM Specifications

### Minimum Requirements

| Component | Specification |
|-----------|--------------|
| **CPU** | 2 cores |
| **RAM** | 4 GB |
| **Storage** | 40 GB (qcow2) |
| **Network** | 1 interface (virtio) |

### Recommended Specifications

| Component | Specification |
|-----------|--------------|
| **CPU** | 4 cores |
| **RAM** | 8 GB |
| **Storage** | 80 GB (qcow2) |
| **Network** | 1 interface (virtio) |

---

## Installation Steps

### 1. Create VM with virt-install

```bash
sudo virt-install \
  --name prism-vm \
  --ram 4096 \
  --vcpus 2 \
  --disk path=/var/lib/libvirt/images/prism-vm.qcow2,size=40,format=qcow2,bus=virtio \
  --os-variant ubuntu22.04 \
  --network network=default,model=virtio \
  --graphics vnc,listen=0.0.0.0 \
  --serial pty \
  --console pty,target_type=serial \
  --location 'http://archive.ubuntu.com/ubuntu/dists/jammy/main/installer-amd64/' \
  --extra-args "console=ttyS0,115200n8 serial" \
  --ssh-injection prism
```

### 2. Configure Static IP (Optional)

Edit `/etc/netplan/00-installer-config.yaml` on VM:

```yaml
network:
  version: 2
  ethernets:
    eth0:
      addresses:
        - 192.168.122.230/24
      routes:
        - to: default
          via: 192.168.122.1
      nameservers:
        addresses:
          - 192.168.122.1
          - 8.8.8.8
```

Apply configuration:
```bash
sudo netplan apply
```

### 3. Verify Connection

From host:
```bash
# Ping VM
ping 192.168.122.230

# SSH to VM
ssh prism@192.168.122.230
# Password: prism123

# Check VM status
virsh list --all | grep prism-vm
```

---

## Deployment Script (Future: scripts/vm_test_deploy.sh)

The deployment script should:

1. **Check VM Status**
   ```bash
   virsh domstate prism-vm
   ```

2. **Start VM if Stopped**
   ```bash
   virsh start prism-vm
   ```

3. **Wait for VM to Boot**
   ```bash
   # Wait for SSH to be available
   until ssh prism@192.168.122.230 exit; do
     sleep 5
   done
   ```

4. **Deploy PRISM Components**
   ```bash
   # Copy deployment script
   scp deploy.sh prism@192.168.122.230:/tmp/
   
   # Execute deployment
   ssh prism@192.168.122.230 "sudo /tmp/deploy.sh"
   ```

5. **Verify Deployment**
   ```bash
   # Check services
   ssh prism@192.168.122.230 "systemctl status prism-server prism-agent"
   ```

---

## Security Notes

⚠️ **IMPORTANT: Change Default Passwords in Production!**

Before deploying to production:
- [ ] Change VM user password (`passwd prism`)
- [ ] Update SSH keys (disable password auth)
- [ ] Configure firewall rules
- [ ] Enable automatic security updates

---

## Troubleshooting

### VM Won't Start

```bash
# Check VM configuration
virsh dumpxml prism-vm

# Check logs
virsh console prism-vm
```

### Cannot Connect via SSH

```bash
# Check if VM is running
virsh list | grep prism-vm

# Check IP address (may have changed)
virsh domifaddr prism-vm

# Reset network on VM
virsh domif-reset-link-state prism-vm eth0
```

### IP Address Changed

If using DHCP, IP may change. Check current IP:
```bash
virsh domifaddr prism-vm
```

To use static IP, see "Static IP Configuration" above.

---

## References

- [libvirt Documentation](https://libvirt.org/)
- [QEMU Documentation](https://www.qemu.org/docs/)
- [Ubuntu Cloud Images](https://cloud-images.ubuntu.com/)
- [virt-install Manual](https://manpages.org/virt-install)

---

**Last Updated**: 2026-04-02  
**Version**: 1.0  
**Maintained By**: PRISM Development Team
