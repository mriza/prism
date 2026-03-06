#!/bin/bash
cat > /etc/systemd/system/prism-server.service <<EOF
[Unit]
Description=PRISM Hub Server
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/prism/server
ExecStart=/opt/prism/server/prism-server
Restart=always
RestartSec=5
Environment=PORT=65432
Environment=JWT_SECRET=prism123

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now prism-server
systemctl restart prism-server
