import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { resolveForFile, resolveBatch, resolveRuleConfig } from "../../src/config/cascade";
import type { ResolvedConfig } from "../../src/config/types";

function createTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "archguard-cascade-"));
}

function rmrf(dir: string) {
  fs.rmSync(dir, { recursive: true, force: true });
}

function makeGlobalConfig(overrides: Partial<ResolvedConfig> = {}): ResolvedConfig {
  return {
    version: 1,
    presets: ["hex", "clean"],
    layers: { domain: { path: "src/domain/**" } },
    edges: { deny: ["domain→infra"] },
    rules: { "hex/layer-direction": { severity: "error" } },
    typeOnly: "ignore",
    exclude: [],
    configPath: null,
    ...overrides,
  };
}

describe("resolveForFile", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = createTempDir();
  });

  afterEach(() => {
    rmrf(tmpDir);
  });

  it("returns global config when no per-file config exists", () => {
    const globalConfig = makeGlobalConfig();
    const filePath = path.join(tmpDir, "src", "app.ts");
    fs.mkdirSync(path.dirname(filePath));
    fs.writeFileSync(filePath, "export {}");

    const result = resolveForFile(globalConfig, filePath);
    expect(result.layers).toBe(globalConfig.layers);
    expect(result.edges).toBe(globalConfig.edges);
  });

  it("merges per-file config layers over global", () => {
    const globalConfig = makeGlobalConfig();

    // Create per-file config in src/
    const srcDir = path.join(tmpDir, "src");
    fs.mkdirSync(srcDir);
    fs.writeFileSync(
      path.join(srcDir, ".archguard.yml"),
      "version: 1\nlayers:\n  app: { path: 'src/app/**' }\n"
    );

    const filePath = path.join(srcDir, "app.ts");
    fs.writeFileSync(filePath, "export {}");

    const result = resolveForFile(globalConfig, filePath);
    // Per-file wins — should have app layer, not domain
    expect(result.layers).toEqual({ app: { path: "src/app/**" } });
  });

  it("per-file edges override global edges", () => {
    const globalConfig = makeGlobalConfig();

    const srcDir = path.join(tmpDir, "src");
    fs.mkdirSync(srcDir);
    fs.writeFileSync(
      path.join(srcDir, ".archguard.yml"),
      "version: 1\nedges:\n  deny: ['app→infra']\n"
    );

    const filePath = path.join(srcDir, "app.ts");
    fs.writeFileSync(filePath, "export {}");

    const result = resolveForFile(globalConfig, filePath);
    expect(result.edges).toEqual({ deny: ["app→infra"] });
  });

  it("per-file config does NOT override global rules", () => {
    const globalConfig = makeGlobalConfig({
      rules: { "hex/layer-direction": { severity: "warn" } },
    });

    const srcDir = path.join(tmpDir, "src");
    fs.mkdirSync(srcDir);
    fs.writeFileSync(
      path.join(srcDir, ".archguard.yml"),
      'version: 1\nrules:\n  "hex/layer-direction": { severity: "error" }\n'
    );

    const filePath = path.join(srcDir, "app.ts");
    fs.writeFileSync(filePath, "export {}");

    // resolveRuleConfig always uses global — per-file rules are ignored
    const ruleConfig = resolveRuleConfig(globalConfig, "hex/layer-direction");
    expect(ruleConfig.severity).toBe("warn");
  });
});

describe("resolveBatch", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = createTempDir();
  });

  afterEach(() => {
    rmrf(tmpDir);
  });

  it("resolves layers for multiple files", () => {
    const globalConfig = makeGlobalConfig();
    const srcDir = path.join(tmpDir, "src");
    fs.mkdirSync(srcDir);

    const files = ["src/app.ts", "src/domain/order.ts"];
    const absFiles = files.map((f) => path.join(tmpDir, f));
    for (const f of absFiles) {
      fs.mkdirSync(path.dirname(f), { recursive: true });
      fs.writeFileSync(f, "export {}");
    }

    const result = resolveBatch(globalConfig, absFiles);
    expect(result.size).toBe(2);
    for (const f of absFiles) {
      expect(result.has(f)).toBe(true);
    }
  });
});

describe("resolveRuleConfig", () => {
  it("returns empty object when rule not configured", () => {
    const globalConfig = makeGlobalConfig();
    const result = resolveRuleConfig(globalConfig, "unknown/rule");
    expect(result).toEqual({});
  });

  it("returns the configured rule", () => {
    const globalConfig = makeGlobalConfig({
      rules: {
        "hex/layer-direction": { severity: "warn", ignore: ["src/legacy/**"] },
      },
    });
    const result = resolveRuleConfig(globalConfig, "hex/layer-direction");
    expect(result.severity).toBe("warn");
    expect(result.ignore).toEqual(["src/legacy/**"]);
  });
});
