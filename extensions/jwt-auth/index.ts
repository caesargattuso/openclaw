import type { OpenClawPluginApi, OpenClawPluginService } from "openclaw/plugin-sdk/core";
import type {
  PluginHookBeforeToolCallResult,
  PluginHookToolContext,
  PluginHookBeforeToolCallEvent,
} from "openclaw/plugin-sdk/types";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import YAML from "yaml";

/**
 * JWT Auth 插件
 *
 * 功能：
 * 1. 检测 read 工具调用，读取 {skills}/{skill_name}/config.yaml 中的 need_authentication 字段
 * 2. 若 need_authentication=true，启动一个每 45 分钟执行一次的定时任务
 * 3. 定时任务访问配置的 JWT 接口，获取 JWT token
 * 4. 将 JWT 写入 ~/.openclaw/jwt/{skill_name}.txt
 */

// ============================================================================
// 配置类型
// ============================================================================

type JwtAuthConfig = {
  /** 是否启用插件（默认 true） */
  enabled?: boolean;
  /** 获取 JWT 的接口 URL（POST） */
  jwtUrl: string;
  /** 请求 JWT 时的成员唯一 ID */
  memberUniqueId: string;
  /** JWT 有效期（分钟），可选，默认 60 */
  expireMinutes?: number;
  /** 定时刷新间隔（分钟），默认 45 */
  refreshIntervalMinutes?: number;
  /** Skills 目录路径（可选，默认自动检测） */
  skillsDir?: string;
};

// ============================================================================
// 内部状态
// ============================================================================

/** 已注册定时任务的 skill 名称集合，避免重复注册 */
const registeredSkills = new Set<string>();

/** skill -> 定时器 handle 映射 */
const skillTimers = new Map<string, ReturnType<typeof setInterval>>();

// ============================================================================
// 配置解析
// ============================================================================

function parseConfig(api: OpenClawPluginApi): JwtAuthConfig | null {
  const raw = api.pluginConfig as Partial<JwtAuthConfig> | undefined;

  if (!raw?.jwtUrl || !raw?.memberUniqueId) {
    api.logger.warn(
      "jwt-auth: missing required config (jwtUrl, memberUniqueId). Plugin disabled.",
    );
    return null;
  }

  return {
    enabled: raw.enabled ?? true,
    jwtUrl: raw.jwtUrl,
    memberUniqueId: raw.memberUniqueId,
    expireMinutes: raw.expireMinutes,
    refreshIntervalMinutes: raw.refreshIntervalMinutes ?? 45,
    skillsDir: raw.skillsDir,
  };
}

// ============================================================================
// Skills 目录解析
// ============================================================================

function getPossibleSkillsDirs(config: JwtAuthConfig): string[] {
  const dirs: string[] = [];

  try {
    // 1. 当前工作目录的 skills/
    dirs.push(path.join(process.cwd(), "skills"));

    // 2. 用户 home 目录的 .openclaw/skills/
    const homeDir = os.homedir();
    if (homeDir) {
      dirs.push(path.join(homeDir, ".openclaw", "skills"));
    }

    // 3. 配置的 skillsDir
    if (config.skillsDir) {
      dirs.push(config.skillsDir);
    }
  } catch {
    // ignore
  }

  return dirs;
}

/**
 * 从 read 工具的 file_path 中提取 skill 名称（如果路径在 skills 目录下）
 * 返回 { skillName, skillDir } 或 null
 */
function extractSkillFromPath(
  filePath: string,
  skillsDirs: string[],
): { skillName: string; skillDir: string } | null {
  const normalizedPath = path.normalize(filePath);

  for (const dir of skillsDirs) {
    const normalizedDir = path.normalize(dir);
    if (!normalizedPath.startsWith(normalizedDir + path.sep) && normalizedPath !== normalizedDir) {
      continue;
    }

    const relativePath = path.relative(normalizedDir, normalizedPath);
    const parts = relativePath.split(path.sep);
    if (parts.length >= 1 && parts[0]) {
      return { skillName: parts[0], skillDir: path.join(normalizedDir, parts[0]) };
    }
  }

  return null;
}

/**
 * 读取 {skillDir}/config.yaml，检查 need_authentication 是否为 true
 */
function needsAuthentication(skillDir: string): boolean {
  const configPath = path.join(skillDir, "config.yaml");
  try {
    const raw = fs.readFileSync(configPath, "utf-8");
    const config = YAML.parse(raw) as Record<string, unknown>;
    return config?.need_authentication === true;
  } catch {
    // config.yaml 不存在或解析失败，视为不需要鉴权
    return false;
  }
}

// ============================================================================
// JWT 输出目录
// ============================================================================

function getJwtOutputDir(): string {
  return path.join(os.homedir(), ".openclaw", "workspace", "jwt");
}

function ensureJwtOutputDir(): void {
  const dir = getJwtOutputDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function getJwtOutputPath(skillName: string): string {
  return path.join(getJwtOutputDir(), `${skillName}.txt`);
}

// ============================================================================
// JWT 获取逻辑
// ============================================================================

async function fetchJwt(params: {
  jwtUrl: string;
  memberUniqueId: string;
  skillName: string;
  expireMinutes?: number;
}): Promise<string> {
  const body: Record<string, unknown> = {
    memberUniqueId: params.memberUniqueId,
    skillName: params.skillName,
  };
  if (params.expireMinutes != null) {
    body.expireMinutes = params.expireMinutes;
  }

  const resp = await fetch(params.jwtUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(5000),
  });

  if (!resp.ok) {
    throw new Error(`JWT request failed: HTTP ${resp.status} ${resp.statusText}`);
  }

  const json = (await resp.json()) as {
    success?: boolean;
    data?: { jwt?: string; expiresIn?: number };
    message?: string;
  };

  if (!json.success || !json.data?.jwt) {
    throw new Error(`JWT response error: ${json.message ?? "unknown error"}`);
  }

  return json.data.jwt;
}

/**
 * 执行一次 JWT 获取并写入文件
 */
async function refreshJwtForSkill(params: {
  skillName: string;
  config: JwtAuthConfig;
  logger: OpenClawPluginApi["logger"];
}): Promise<void> {
  const { skillName, config, logger } = params;

  logger.info(`jwt-auth: refreshing JWT for skill "${skillName}"`);

  try {
    const jwt = await fetchJwt({
      jwtUrl: config.jwtUrl,
      memberUniqueId: config.memberUniqueId,
      skillName,
      expireMinutes: config.expireMinutes,
    });

    ensureJwtOutputDir();
    fs.writeFileSync(getJwtOutputPath(skillName), jwt, "utf-8");
    logger.info(`jwt-auth: JWT written to ${getJwtOutputPath(skillName)}`);
  } catch (err) {
    logger.error(
      `jwt-auth: failed to refresh JWT for skill "${skillName}": ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }
}

// ============================================================================
// 定时任务注册
// ============================================================================

function scheduleJwtRefresh(params: {
  skillName: string;
  config: JwtAuthConfig;
  logger: OpenClawPluginApi["logger"];
}): void {
  const { skillName, config, logger } = params;

  if (registeredSkills.has(skillName)) {
    logger.debug(`jwt-auth: timer already registered for skill "${skillName}", skipping`);
    return;
  }

  registeredSkills.add(skillName);
  logger.info(
    `jwt-auth: scheduling JWT refresh for skill "${skillName}" every ${config.refreshIntervalMinutes} minutes`,
  );

  // 立即执行一次
  void refreshJwtForSkill({ skillName, config, logger });

  // 每 N 分钟执行一次
  const intervalMs = (config.refreshIntervalMinutes ?? 45) * 60 * 1000;
  const timer = setInterval(() => {
    void refreshJwtForSkill({ skillName, config, logger });
  }, intervalMs);

  // 不阻止进程退出
  timer.unref?.();
  skillTimers.set(skillName, timer);
}

function clearAllTimers(): void {
  for (const [, timer] of skillTimers) {
    clearInterval(timer);
  }
  skillTimers.clear();
  registeredSkills.clear();
}

// ============================================================================
// 插件入口
// ============================================================================

export default function register(api: OpenClawPluginApi) {
  const config = parseConfig(api);

  if (!config || config.enabled === false) {
    api.logger.info("jwt-auth: plugin disabled");
    return;
  }

  api.logger.info(
    `jwt-auth: initialized (jwtUrl=${config.jwtUrl}, refreshInterval=${config.refreshIntervalMinutes}min)`,
  );

  const skillsDirs = getPossibleSkillsDirs(config);
  api.logger.info(`jwt-auth: watching skills dirs: ${skillsDirs.join(", ")}`);

  // ============================================================================
  // before_tool_call hook - 检测 read 工具调用
  // ============================================================================
  api.on(
    "before_tool_call",
    (
      event: PluginHookBeforeToolCallEvent,
      _ctx: PluginHookToolContext,
    ): PluginHookBeforeToolCallResult | void => {
      const { toolName, params } = event;

      // 只关心 read 工具
      if (toolName.toLowerCase() !== "read") {
        return;
      }

      const filePath =
        (params?.file_path as string | undefined) ?? (params?.path as string | undefined);

      if (!filePath || typeof filePath !== "string") {
        return;
      }

      api.logger.debug(`jwt-auth: read tool detected, file_path=${filePath}`);

      const match = extractSkillFromPath(filePath, skillsDirs);
      if (!match) {
        return;
      }

      const { skillName, skillDir } = match;
      api.logger.debug(`jwt-auth: skill detected: ${skillName}, skillDir=${skillDir}`);

      // 检查 config.yaml 中 need_authentication 是否为 true
      if (!needsAuthentication(skillDir)) {
        api.logger.debug(
          `jwt-auth: ${skillDir}/config.yaml does not have need_authentication=true, skipping JWT schedule for "${skillName}"`,
        );
        return;
      }

      api.logger.info(
        `jwt-auth: ${skillDir}/config.yaml need_authentication=true, scheduling JWT refresh for skill "${skillName}"`,
      );

      // 注册定时任务（幂等，重复调用无副作用）
      scheduleJwtRefresh({ skillName, config, logger: api.logger });

      // 不阻断工具调用，仅旁路触发定时任务
    },
  );

  // ============================================================================
  // registerService - 生命周期管理（gateway 停止时清理定时器）
  // ============================================================================
  const jwtService: OpenClawPluginService = {
    id: "jwt-auth-timer",
    start: async (_ctx) => {
      api.logger.info("jwt-auth: service started");
    },
    stop: async (_ctx) => {
      api.logger.info("jwt-auth: service stopping, clearing all timers");
      clearAllTimers();
    },
  };

  api.registerService(jwtService);
}
