#!/bin/bash
set -euo pipefail

# 根据 DAOKEENV 选择 JWT 接口地址
if [ "${DAOKEENV:-}" = "product" ]; then
    export JWT_URL="https://toca.17u.cn/open-api/auth/openclaw-jwt"
else
    export JWT_URL="https://toca.qa.17u.cn/open-api/auth/openclaw-jwt"
fi

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
chown -R openclaw:openclaw /home/openclaw
chown -R openclaw:openclaw /scripts

# openclaw 用户只读目录
chown -R root:openclaw /home/openclaw/.openclaw/openclaw.json
chmod -R 750 /home/openclaw/.openclaw/openclaw.json
chown -R root:openclaw /home/openclaw/.openclaw/skills
chmod -R 750 /home/openclaw/.openclaw/skills

# 启动工程效能进程
#nohup gosu openclaw python /scripts/browser_daemon/browser_daemon.py &

#exec gosu openclaw openclaw gateway --port "${OPENCLAW_GATEWAY_PORT}"

mkdir -p /var/log/openclaw
exec /usr/bin/supervisord