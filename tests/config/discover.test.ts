import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { discoverConfig, discoverPerFileConfig, findGitRoot } from "../../src/config/discover";

/**
 * Helper: create a temp directory structure for testing.
 */
function createTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "archguard-test-"));
}

function rmrf(dir: string) {
  fs.rmSync(dir, { recursive: true, force: true });
}

describe("discoverConfig", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = createTempDir();
  });

  afterEach(() => {
    rmrf(tmpDir);
  });

  it("finds .archguard.yml in start directory", () => {
    const configPath = path.join(tmpDir, ".archguard.yml");
    fs.writeFileSync(configPath, "version: 1\n");

    const result = discoverConfig(tmpDir);
    expect(result).not.toBeNull();
    expect(result!.path).toBe(configPath);
    expect(result!.format).toBe("yml");
  });

  it("finds .archguard.yaml in start directory", () => {
    const configPath = path.join(tmpDir, ".archguard.yaml");
    fs.writeFileSync(configPath, "version: 1\n");

    const result = discoverConfig(tmpDir);
    expect(result).not.toBeNull();
    expect(result!.path).toBe(configPath);
    expect(result!.format).toBe("yaml");
  });

  it("finds .archguard.toml in start directory", () => {
    const configPath = path.join(tmpDir, ".archguard.toml");
    fs.writeFileSync(configPath, "version = 1\n");

    const result = discoverConfig(tmpDir);
    expect(result).not.toBeNull();
    expect(result!.path).toBe(configPath);
    expect(result!.format).toBe("toml");
  });

  it("walks upward to find config in parent directory", () => {
    const subDir = path.join(tmpDir, "src", "domain");
    fs.mkdirSync(subDir, { recursive: true });

    const configPath = path.join(tmpDir, ".archguard.yml");
    fs.writeFileSync(configPath, "version: 1\n");

    const result = discoverConfig(subDir);
    expect(result).not.toBeNull();
    expect(result!.path).toBe(configPath);
  });

  it("returns null when no config file found", () => {
    const result = discoverConfig(tmpDir);
    expect(result).toBeNull();
  });

  it("stops at stopDir boundary", () => {
    // Create config in parent
    const parentDir = path.join(tmpDir, "parent");
    fs.mkdirSync(parentDir);
    fs.writeFileSync(path.join(parentDir, ".archguard.yml"), "version: 1\n");

    // Start from child, stop at tmpDir (not parentDir)
    const childDir = path.join(tmpDir, "child");
    fs.mkdirSync(childDir);

    const result = discoverConfig(childDir, tmpDir);
    expect(result).toBeNull();
  });

  it("prefers .archguard.yml over .archguard.yaml when both exist", () => {
    fs.writeFileSync(path.join(tmpDir, ".archguard.yml"), "version: 1\npreset: hex\n");
    fs.writeFileSync(path.join(tmpDir, ".archguard.yaml"), "version: 1\npreset: clean\n");

    const result = discoverConfig(tmpDir);
    expect(result).not.toBeNull();
    expect(result!.format).toBe("yml");
  });

  it("ignores non-config files", () => {
    fs.writeFileSync(path.join(tmpDir, "archguard.yml"), "version: 1\n"); // missing dot
    fs.writeFileSync(path.join(tmpDir, ".archguard.json"), "{}"); // wrong extension

    const result = discoverConfig(tmpDir);
    expect(result).toBeNull();
  });
});

describe("discoverPerFileConfig", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = createTempDir();
  });

  afterEach(() => {
    rmrf(tmpDir);
  });

  it("finds nearest config for a source file", () => {
    const srcDir = path.join(tmpDir, "src");
    fs.mkdirSync(srcDir);
    fs.writeFileSync(path.join(tmpDir, ".archguard.yml"), "version: 1\n");

    const filePath = path.join(srcDir, "app.ts");
    fs.writeFileSync(filePath, "export {}");

    const result = discoverPerFileConfig(filePath);
    expect(result).not.toBeNull();
    expect(result!.path).toBe(path.join(tmpDir, ".archguard.yml"));
  });

  it("returns null when no config found for file", () => {
    const filePath = path.join(tmpDir, "src", "app.ts");
    fs.mkdirSync(path.dirname(filePath));
    fs.writeFileSync(filePath, "export {}");

    const result = discoverPerFileConfig(filePath);
    expect(result).toBeNull();
  });
});
