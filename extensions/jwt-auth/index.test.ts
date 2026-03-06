import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { OpenClawPluginApi } from "openclaw/plugin-sdk/core";
import type {
  PluginHookBeforeToolCallEvent,
  PluginHookToolContext,
} from "openclaw/plugin-sdk/types";

// ============================================================================
// Mocks
// ============================================================================

const mockExistsSync = vi.fn();
const mockMkdirSync = vi.fn();
const mockWriteFileSync = vi.fn();
const mockReadFileSync = vi.fn();

vi.mock("node:fs", () => ({
  default: {
    existsSync: mockExistsSync,
    mkdirSync: mockMkdirSync,
    writeFileSync: mockWriteFileSync,
    readFileSync: mockReadFileSync,
  },
  existsSync: mockExistsSync,
  mkdirSync: mockMkdirSync,
  writeFileSync: mockWriteFileSync,
  readFileSync: mockReadFileSync,
}));

vi.mock("node:path", () => ({
  default: {
    join: vi.fn((...args: string[]) => args.join("/")),
    normalize: vi.fn((p: string) => p.replace(/\\/g, "/")),
    relative: vi.fn((from: string, to: string) => {
      if (to.startsWith(from)) {
        return to.slice(from.length + 1);
      }
      return to;
    }),
    sep: "/",
  },
  join: vi.fn((...args: string[]) => args.join("/")),
  normalize: vi.fn((p: string) => p.replace(/\\/g, "/")),
  relative: vi.fn((from: string, to: string) => {
    if (to.startsWith(from)) {
      return to.slice(from.length + 1);
    }
    return to;
  }),
  sep: "/",
}));

vi.mock("node:os", () => ({
  default: {
    homedir: vi.fn(() => "/home/user"),
  },
  homedir: vi.fn(() => "/home/user"),
}));

// ============================================================================
// Helpers
// ============================================================================

type HookHandler = (event: unknown, ctx: unknown) => unknown;

function createMockApi(pluginConfig: Record<string, unknown> = {}): OpenClawPluginApi {
  const hookHandlers = new Map<string, HookHandler[]>();

  const api = {
    id: "jwt-auth",
    name: "JWT Auth",
    source: "test",
    config: {},
    pluginConfig: {
      jwtUrl: "https://example.com/jwt",
      userId: "user-123",
      spaceId: "space-456",
      refreshIntervalMinutes: 45,
      ...pluginConfig,
    },
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    },
    runtime: {} as OpenClawPluginApi["runtime"],
    registerTool: vi.fn(),
    registerHook: vi.fn(),
    registerHttpRoute: vi.fn(),
    registerChannel: vi.fn(),
    registerGatewayMethod: vi.fn(),
    registerCli: vi.fn(),
    registerService: vi.fn(),
    registerCommand: vi.fn(),
    registerProvider: vi.fn(),
    resolvePath: vi.fn((p: string) => p),
    on: vi.fn((hookName: string, handler: HookHandler) => {
      const existing = hookHandlers.get(hookName) ?? [];
      existing.push(handler);
      hookHandlers.set(hookName, existing);
    }),
    _hookHandlers: hookHandlers,
  } as unknown as OpenClawPluginApi & { _hookHandlers: Map<string, HookHandler[]> };

  return api;
}

function getHookHandler(
  api: OpenClawPluginApi & { _hookHandlers: Map<string, HookHandler[]> },
  hookName: string,
): HookHandler | undefined {
  return api._hookHandlers.get(hookName)?.[0];
}

function makeToolEvent(
  toolName: string,
  filePath: string,
): PluginHookBeforeToolCallEvent {
  return {
    toolName,
    params: { file_path: filePath },
  };
}

const emptyCtx: PluginHookToolContext = {
  toolName: "read",
};

// ============================================================================
// Tests
// ============================================================================

describe("jwt-auth plugin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExistsSync.mockReturnValue(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // --------------------------------------------------------------------------
  // 初始化
  // --------------------------------------------------------------------------

  describe("initialization", () => {
    it("registers before_tool_call hook and service when config is valid", async () => {
      const api = createMockApi() as OpenClawPluginApi & {
        _hookHandlers: Map<string, HookHandler[]>;
      };
      const { default: register } = await import("./index.ts");
      register(api);

      expect(api.on).toHaveBeenCalledWith("before_tool_call", expect.any(Function));
      expect(api.registerService).toHaveBeenCalledWith(
        expect.objectContaining({ id: "jwt-auth-timer" }),
      );
    });

    it("disables plugin when enabled=false", async () => {
      const api = createMockApi({ enabled: false }) as OpenClawPluginApi & {
        _hookHandlers: Map<string, HookHandler[]>;
      };
      const { default: register } = await import("./index.ts");
      register(api);

      expect(api.on).not.toHaveBeenCalled();
      expect(api.registerService).not.toHaveBeenCalled();
    });

    it("disables plugin when required config is missing", async () => {
      const api = {
        id: "jwt-auth",
        name: "JWT Auth",
        source: "test",
        config: {},
        pluginConfig: {
          // jwtUrl, userId, spaceId are all missing
        },
        logger: {
          info: vi.fn(),
          warn: vi.fn(),
          error: vi.fn(),
          debug: vi.fn(),
        },
        runtime: {} as OpenClawPluginApi["runtime"],
        registerTool: vi.fn(),
        registerHook: vi.fn(),
        registerHttpRoute: vi.fn(),
        registerChannel: vi.fn(),
        registerGatewayMethod: vi.fn(),
        registerCli: vi.fn(),
        registerService: vi.fn(),
        registerCommand: vi.fn(),
        registerProvider: vi.fn(),
        resolvePath: vi.fn((p: string) => p),
        on: vi.fn(),
        _hookHandlers: new Map(),
      } as unknown as OpenClawPluginApi & { _hookHandlers: Map<string, HookHandler[]> };

      const { default: register } = await import("./index.ts");
      register(api);

      expect(api.logger.warn).toHaveBeenCalledWith(expect.stringContaining("missing required config"));
      expect(api.on).not.toHaveBeenCalled();
    });
  });

  // --------------------------------------------------------------------------
  // before_tool_call hook - 非 read 工具
  // --------------------------------------------------------------------------

  describe("before_tool_call - non-read tools", () => {
    it("ignores non-read tool calls", async () => {
      const api = createMockApi() as OpenClawPluginApi & {
        _hookHandlers: Map<string, HookHandler[]>;
      };
      const { default: register } = await import("./index.ts");
      register(api);

      const handler = getHookHandler(api, "before_tool_call");
      const result = handler?.({ toolName: "write", params: { file_path: "/skills/foo/bar.ts" } }, emptyCtx);
      expect(result).toBeUndefined();
    });

    it("ignores read tool calls without file_path", async () => {
      const api = createMockApi() as OpenClawPluginApi & {
        _hookHandlers: Map<string, HookHandler[]>;
      };
      const { default: register } = await import("./index.ts");
      register(api);

      const handler = getHookHandler(api, "before_tool_call");
      const result = handler?.({ toolName: "read", params: {} }, emptyCtx);
      expect(result).toBeUndefined();
    });
  });

  // --------------------------------------------------------------------------
  // before_tool_call hook - read 工具，路径不在 skills 目录
  // --------------------------------------------------------------------------

  describe("before_tool_call - path outside skills dirs", () => {
    it("ignores read tool calls outside skills directories", async () => {
      const api = createMockApi() as OpenClawPluginApi & {
        _hookHandlers: Map<string, HookHandler[]>;
      };
      const { default: register } = await import("./index.ts");
      register(api);

      const handler = getHookHandler(api, "before_tool_call");
      const result = handler?.(makeToolEvent("read", "/some/other/path/file.ts"), emptyCtx);
      expect(result).toBeUndefined();
      // 不应该读取 config.yaml
      expect(mockReadFileSync).not.toHaveBeenCalled();
    });
  });

  // --------------------------------------------------------------------------
  // before_tool_call hook - config.yaml need_authentication 未设置或为 false
  // --------------------------------------------------------------------------

  describe("before_tool_call - need_authentication absent or false", () => {
    it("skips scheduling when config.yaml does not exist", async () => {
      // readFileSync 抛出异常模拟文件不存在
      mockReadFileSync.mockImplementation(() => { throw new Error("ENOENT"); });

      const api = createMockApi({ skillsDir: "/skills" }) as OpenClawPluginApi & {
        _hookHandlers: Map<string, HookHandler[]>;
      };
      const { default: register } = await import("./index.ts");
      register(api);

      const handler = getHookHandler(api, "before_tool_call");
      const result = handler?.(makeToolEvent("read", "/skills/my-skill/SKILL.md"), emptyCtx);

      expect(result).toBeUndefined();
      expect(mockReadFileSync).toHaveBeenCalledWith(expect.stringContaining("config.yaml"), "utf-8");
      expect(mockWriteFileSync).not.toHaveBeenCalled();
    });

    it("skips scheduling when need_authentication is false", async () => {
      mockReadFileSync.mockImplementation((p: string) => {
        if (p.endsWith("config.yaml")) return "need_authentication: false";
        throw new Error("ENOENT");
      });

      const api = createMockApi({ skillsDir: "/skills" }) as OpenClawPluginApi & {
        _hookHandlers: Map<string, HookHandler[]>;
      };
      const { default: register } = await import("./index.ts");
      register(api);

      const handler = getHookHandler(api, "before_tool_call");
      const result = handler?.(makeToolEvent("read", "/skills/my-skill/SKILL.md"), emptyCtx);

      expect(result).toBeUndefined();
      expect(mockWriteFileSync).not.toHaveBeenCalled();
    });

    it("skips scheduling when need_authentication is missing from config.yaml", async () => {
      mockReadFileSync.mockImplementation((p: string) => {
        if (p.endsWith("config.yaml")) return "some_other_key: true";
        throw new Error("ENOENT");
      });

      const api = createMockApi({ skillsDir: "/skills" }) as OpenClawPluginApi & {
        _hookHandlers: Map<string, HookHandler[]>;
      };
      const { default: register } = await import("./index.ts");
      register(api);

      const handler = getHookHandler(api, "before_tool_call");
      const result = handler?.(makeToolEvent("read", "/skills/my-skill/SKILL.md"), emptyCtx);

      expect(result).toBeUndefined();
      expect(mockWriteFileSync).not.toHaveBeenCalled();
    });
  });

  // --------------------------------------------------------------------------
  // before_tool_call hook - config.yaml need_authentication=true
  // --------------------------------------------------------------------------

  describe("before_tool_call - need_authentication=true", () => {
    /** 让 readFileSync 对 config.yaml 返回 need_authentication: true */
    function mockConfigYaml() {
      mockReadFileSync.mockImplementation((p: string) => {
        if (p.endsWith("config.yaml")) return "need_authentication: true";
        throw new Error("ENOENT");
      });
    }

    it("does not block the tool call even when scheduling is triggered", async () => {
      mockConfigYaml();

      const api = createMockApi({ skillsDir: "/skills" }) as OpenClawPluginApi & {
        _hookHandlers: Map<string, HookHandler[]>;
      };
      const { default: register } = await import("./index.ts");
      register(api);

      const handler = getHookHandler(api, "before_tool_call");
      const result = handler?.(makeToolEvent("read", "/skills/my-skill/SKILL.md"), emptyCtx);

      // 不阻断工具调用
      expect(result).toBeUndefined();
    });

    it("logs scheduling info when need_authentication=true", async () => {
      mockConfigYaml();

      const api = createMockApi({ skillsDir: "/skills" }) as OpenClawPluginApi & {
        _hookHandlers: Map<string, HookHandler[]>;
      };
      const { default: register } = await import("./index.ts");
      register(api);

      const handler = getHookHandler(api, "before_tool_call");
      handler?.(makeToolEvent("read", "/skills/my-skill/SKILL.md"), emptyCtx);

      expect(api.logger.info).toHaveBeenCalledWith(
        expect.stringContaining("scheduling JWT refresh"),
      );
    });

    it("accepts path param as fallback when file_path is absent", async () => {
      mockConfigYaml();

      const api = createMockApi({ skillsDir: "/skills" }) as OpenClawPluginApi & {
        _hookHandlers: Map<string, HookHandler[]>;
      };
      const { default: register } = await import("./index.ts");
      register(api);

      const handler = getHookHandler(api, "before_tool_call");
      // 使用 path 而非 file_path
      const result = handler?.(
        { toolName: "read", params: { path: "/skills/my-skill/SKILL.md" } },
        emptyCtx,
      );
      expect(result).toBeUndefined();
      expect(api.logger.info).toHaveBeenCalledWith(
        expect.stringContaining("scheduling JWT refresh"),
      );
    });

    it("writes raw JWT token to file when fetch succeeds", async () => {
      mockConfigYaml();
      mockExistsSync.mockReturnValue(true);

      const rawJwt = "eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ0ZXN0In0.signature";

      const fetchMock = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: { jwt: rawJwt, expiresIn: 3600 } }),
      });
      vi.stubGlobal("fetch", fetchMock);

      const api = createMockApi({ skillsDir: "/skills" }) as OpenClawPluginApi & {
        _hookHandlers: Map<string, HookHandler[]>;
      };
      const { default: register } = await import("./index.ts");
      register(api);

      const handler = getHookHandler(api, "before_tool_call");
      handler?.(makeToolEvent("read", "/skills/my-skill/SKILL.md"), emptyCtx);

      // 等待异步 fetch 完成
      await new Promise((r) => setTimeout(r, 50));

      expect(mockWriteFileSync).toHaveBeenCalledOnce();
      const [writePath, writeContent] = (mockWriteFileSync as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(writePath).toContain("my-skill.txt");
      // 直接写入原始 JWT token
      expect(writeContent).toBe(rawJwt);

      vi.unstubAllGlobals();
    });

    it("logs error and does not write file when fetch fails", async () => {
      mockConfigYaml();
      mockExistsSync.mockReturnValue(true);

      const fetchMock = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      });
      vi.stubGlobal("fetch", fetchMock);

      const api = createMockApi({ skillsDir: "/skills" }) as OpenClawPluginApi & {
        _hookHandlers: Map<string, HookHandler[]>;
      };
      const { default: register } = await import("./index.ts");
      register(api);

      const handler = getHookHandler(api, "before_tool_call");
      handler?.(makeToolEvent("read", "/skills/my-skill/SKILL.md"), emptyCtx);

      await new Promise((r) => setTimeout(r, 50));

      expect(mockWriteFileSync).not.toHaveBeenCalled();
      expect(api.logger.error).toHaveBeenCalledWith(
        expect.stringContaining("failed to refresh JWT"),
      );

      vi.unstubAllGlobals();
    });

    it("logs error and does not write file when response has no jwt", async () => {
      mockConfigYaml();
      mockExistsSync.mockReturnValue(true);

      const fetchMock = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: false, message: "unauthorized" }),
      });
      vi.stubGlobal("fetch", fetchMock);

      const api = createMockApi({ skillsDir: "/skills" }) as OpenClawPluginApi & {
        _hookHandlers: Map<string, HookHandler[]>;
      };
      const { default: register } = await import("./index.ts");
      register(api);

      const handler = getHookHandler(api, "before_tool_call");
      handler?.(makeToolEvent("read", "/skills/my-skill/SKILL.md"), emptyCtx);

      await new Promise((r) => setTimeout(r, 50));

      expect(mockWriteFileSync).not.toHaveBeenCalled();
      expect(api.logger.error).toHaveBeenCalledWith(
        expect.stringContaining("failed to refresh JWT"),
      );

      vi.unstubAllGlobals();
    });
  });

  // --------------------------------------------------------------------------
  // Service lifecycle
  // --------------------------------------------------------------------------

  describe("service lifecycle", () => {
    it("registers a service with id jwt-auth-timer", async () => {
      const api = createMockApi() as OpenClawPluginApi & {
        _hookHandlers: Map<string, HookHandler[]>;
      };
      const { default: register } = await import("./index.ts");
      register(api);

      expect(api.registerService).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "jwt-auth-timer",
          start: expect.any(Function),
          stop: expect.any(Function),
        }),
      );
    });

    it("service start logs info", async () => {
      const api = createMockApi() as OpenClawPluginApi & {
        _hookHandlers: Map<string, HookHandler[]>;
      };
      const { default: register } = await import("./index.ts");
      register(api);

      const serviceCall = (api.registerService as ReturnType<typeof vi.fn>).mock.calls[0][0];
      await serviceCall.start({ config: {}, stateDir: "/tmp", logger: api.logger });

      expect(api.logger.info).toHaveBeenCalledWith(expect.stringContaining("service started"));
    });

    it("service stop logs info", async () => {
      const api = createMockApi() as OpenClawPluginApi & {
        _hookHandlers: Map<string, HookHandler[]>;
      };
      const { default: register } = await import("./index.ts");
      register(api);

      const serviceCall = (api.registerService as ReturnType<typeof vi.fn>).mock.calls[0][0];
      await serviceCall.stop({ config: {}, stateDir: "/tmp", logger: api.logger });

      expect(api.logger.info).toHaveBeenCalledWith(expect.stringContaining("clearing all timers"));
    });
  });
});
