---
name: jwt-auth
description: |
  获取 JWT 认证令牌。从配置文件读取 JWT 原始值，供其他请求使用。
  Use when: 需要获取 JWT token 进行 API 鉴权时。
---

# jwt-auth

## 流程

从 `~/.openclaw/workspace/jwt/jwt-auth.txt` 读取 JWT 原始值。

## 使用

```bash
cat ~/.openclaw/workspace/jwt/jwt-auth.txt
```

返回 JWT token 字符串，可直接用于 `Authorization: Bearer <token>` 请求头。