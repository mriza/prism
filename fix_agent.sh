#!/bin/bash
if [ -f /tmp/prism-agent ]; then
    mkdir -p /opt/prism/agent
    mv /tmp/prism-agent /opt/prism/agent/prism-agent
    chmod +x /opt/prism/agent/prism-agent
fi

mkdir -p /opt/prism/agent
cd /opt/prism/agent
/opt/prism/agent/prism-agent -generate-config || true
sed -i 's|URL = ".*"|URL = "ws://192.168.122.230:65432/agent/connect"|g' /opt/prism/agent/prism-agent.conf
sed -i "s|Token = .*|Token = 'prism123'|g" /opt/prism/agent/prism-agent.conf

cat > /etc/systemd/system/prism-agent.service <<EOF
[Unit]
Description=PRISM Node Agent
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/prism/agent
ExecStart=/opt/prism/agent/prism-agent -config=/opt/prism/agent/prism-agent.conf
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now prism-agent
systemctl restart prism-agent
