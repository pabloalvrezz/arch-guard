import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { loadConfig } from "../../src/config/load";
import { ConfigError } from "../../src/shared/errors";
import type { DiscoveredConfig } from "../../src/config/types";

function createTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "archguard-load-"));
}

function rmrf(dir: string) {
  fs.rmSync(dir, { recursive: true, force: true });
}

describe("loadConfig", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = createTempDir();
  });

  afterEach(() => {
    rmrf(tmpDir);
  });

  it("loads valid YAML config", () => {
    const configPath = path.join(tmpDir, ".archguard.yml");
    fs.writeFileSync(configPath, "version: 1\npreset: hex\n");

    const discovered: DiscoveredConfig = { path: configPath, format: "yml" };
    const doc = loadConfig(discovered);

    expect(doc.version).toBe(1);
    expect(doc.preset).toBe("hex");
  });

  it("loads valid YAML config (.yaml extension)", () => {
    const configPath = path.join(tmpDir, ".archguard.yaml");
    fs.writeFileSync(configPath, "version: 1\npreset: clean\n");

    const discovered: DiscoveredConfig = { path: configPath, format: "yaml" };
    const doc = loadConfig(discovered);

    expect(doc.version).toBe(1);
    expect(doc.preset).toBe("clean");
  });

  it("loads valid TOML config", () => {
    const configPath = path.join(tmpDir, ".archguard.toml");
    fs.writeFileSync(configPath, 'version = 1\npreset = "hex"\n');

    const discovered: DiscoveredConfig = { path: configPath, format: "toml" };
    const doc = loadConfig(discovered);

    expect(doc.version).toBe(1);
    expect(doc.preset).toBe("hex");
  });

  it("throws ConfigError on YAML parse error with file:line", () => {
    const configPath = path.join(tmpDir, ".archguard.yml");
    fs.writeFileSync(configPath, "version: 1\nlayers:\n  invalid:\n    bad:\n");

    const discovered: DiscoveredConfig = { path: configPath, format: "yml" };

    expect(() => loadConfig(discovered)).toThrow(ConfigError);
    try {
      loadConfig(discovered);
    } catch (err) {
      expect((err as ConfigError).message).toContain("config:");
      expect((err as ConfigError).message).toContain(configPath);
    }
  });

  it("throws ConfigError on invalid schema (layers not a map)", () => {
    const configPath = path.join(tmpDir, ".archguard.yml");
    fs.writeFileSync(configPath, 'version: 1\nlayers: "notamap"\n');

    const discovered: DiscoveredConfig = { path: configPath, format: "yml" };

    expect(() => loadConfig(discovered)).toThrow(ConfigError);
    try {
      loadConfig(discovered);
    } catch (err) {
      const msg = (err as ConfigError).message;
      expect(msg).toContain("validation failed");
      expect(msg).toContain("layers");
    }
  });

  it("throws ConfigError on missing file", () => {
    const discovered: DiscoveredConfig = {
      path: path.join(tmpDir, ".archguard.yml"),
      format: "yml",
    };

    expect(() => loadConfig(discovered)).toThrow(ConfigError);
  });

  it("loads config with layers and edges", () => {
    const configPath = path.join(tmpDir, ".archguard.yml");
    const yaml = `version: 1
layers:
  domain:
    path: "src/domain/**"
  infra:
    path: "src/infra/**"
edges:
  deny:
    - "domain→infra"
`;
    fs.writeFileSync(configPath, yaml);

    const discovered: DiscoveredConfig = { path: configPath, format: "yml" };
    const doc = loadConfig(discovered);

    expect(doc.layers).toBeDefined();
    expect(doc.layers!.domain).toEqual({ path: "src/domain/**" });
    expect(doc.edges!.deny).toEqual(["domain→infra"]);
  });

  it("loads config with rule overrides", () => {
    const configPath = path.join(tmpDir, ".archguard.toml");
    const toml = `
version = 1
preset = "hex"

[rules."hex/layer-direction"]
severity = "warn"
ignore = ["src/legacy/**"]
enforceTypeOnly = true
`;
    fs.writeFileSync(configPath, toml);

    const discovered: DiscoveredConfig = { path: configPath, format: "toml" };
    const doc = loadConfig(discovered);

    expect(doc.rules!["hex/layer-direction"]).toEqual({
      severity: "warn",
      ignore: ["src/legacy/**"],
      enforceTypeOnly: true,
    });
  });
});
