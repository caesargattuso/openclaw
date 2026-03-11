#!/bin/bash
set -euo pipefail

mkdir -p /home/openclaw/.openclaw/
if [ -f /home/openclaw/.openclaw/openclaw.json ]; then
  rm -rf /home/openclaw/.openclaw/openclaw.json
fi
cp /openclaw.json /home/openclaw/.openclaw/

# 初始化 home 环境
cp -rf /scripts/home/.bash_logout /home/openclaw
cp -rf /scripts/home/.bashrc /home/openclaw
cp -rf /scripts/home/.profile /home/openclaw
cp -rf /scripts/home/.cache /home/openclaw

mkdir -p /home/openclaw/.openclaw/skills
chown openclaw:openclaw /home/openclaw/.openclaw

# openclaw 用户只读目录
chown root:openclaw /home/openclaw/.openclaw/openclaw.json
chmod 750 /home/openclaw/.openclaw/openclaw.json
#chown -R root:openclaw /home/openclaw/.openclaw/skills
#chmod -R 750 /home/openclaw/.openclaw/skills

mkdir -p /var/log/openclaw
exec /usr/bin/supervisord