#!/bin/bash
set -euo pipefail

uid=$1
gateway_port=$2
gateway_token=$3
oneai_api_key=$4

export MEMBER_UNIQUE_ID="${uid}"

# oneai 相关环境变量
export ONEAI_OPENAI_BASE_URL="https://oneai.17usoft.com/v1"
export ONEAI_ANTHROPIC_BASE_URL="https://oneai.17usoft.com/anthropic"
export ONEAI_API_KEY="${oneai_api_key}"

export OPENCLAW_GATEWAY_TOKEN="${gateway_token}"

mkdir -p /home/openclaw/.openclaw/

# 将环境变量写入 .env 文件（已存在则替换，不存在则追加）
ENV_FILE="/home/openclaw/.openclaw/.env"
touch "${ENV_FILE}"

set_env_var() {
    local key="$1"
    local value="$2"
    if grep -q "^${key}=" "${ENV_FILE}"; then
        sed -i "s|^${key}=.*|${key}=${value}|" "${ENV_FILE}"
    else
        echo "${key}=${value}" >> "${ENV_FILE}"
    fi
}

set_env_var "MEMBER_UNIQUE_ID" "${MEMBER_UNIQUE_ID}"
set_env_var "ONEAI_OPENAI_BASE_URL" "${ONEAI_OPENAI_BASE_URL}"
set_env_var "ONEAI_ANTHROPIC_BASE_URL" "${ONEAI_ANTHROPIC_BASE_URL}"
set_env_var "ONEAI_API_KEY" "${ONEAI_API_KEY}"
set_env_var "OPENCLAW_GATEWAY_TOKEN" "${OPENCLAW_GATEWAY_TOKEN}"

# 根据 DAOKEENV 选择 JWT 接口地址
if [ "${DAOKEENV:-}" = "product" ]; then
    export JWT_URL="https://toca.17u.cn/open-api/auth/openclaw-jwt"
    set_env_var "JWT_URL" "https://toca.17u.cn/open-api/auth/openclaw-jwt"
else
    export JWT_URL="https://toca.qa.17u.cn/open-api/auth/openclaw-jwt"
    set_env_var "JWT_URL" "https://toca.qa.17u.cn/open-api/auth/openclaw-jwt"
fi

if [ ! -f /home/openclaw/.openclaw/openclaw.json ]; then
    cp /openclaw.json /home/openclaw/.openclaw/
fi
rm -f /openclaw.json

mkdir -p /home/openclaw/.openclaw/skills
chown -R openclaw:openclaw /home/openclaw

# openclaw 用户只读目录
chown -R root:openclaw /home/openclaw/.openclaw/openclaw.json
chmod -R 750 /home/openclaw/.openclaw/openclaw.json
chown -R root:openclaw /home/openclaw/.openclaw/skills
chmod -R 750 /home/openclaw/.openclaw/skills

exec gosu openclaw openclaw gateway --port "${gateway_port}"
