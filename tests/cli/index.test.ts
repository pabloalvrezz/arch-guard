import { describe, it, expect } from "bun:test";

const CLI = "./src/cli/index.ts";

describe("arch-guard CLI", () => {
  it("--help prints usage and exits 0", () => {
    const result = Bun.spawnSync(["bun", "run", CLI, "--help"]);
    expect(result.exitCode).toBe(0);
    const stdout = new TextDecoder().decode(result.stdout);
    expect(stdout).toContain("Usage:");
    expect(stdout).toContain("arch-guard");
  });

  it("--version prints version string and exits 0", () => {
    const result = Bun.spawnSync(["bun", "run", CLI, "--version"]);
    expect(result.exitCode).toBe(0);
    const stdout = new TextDecoder().decode(result.stdout);
    expect(stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("unknown subcommand exits 2", () => {
    const result = Bun.spawnSync(["bun", "run", CLI, "wat"]);
    expect(result.exitCode).toBe(2);
  });

  it("check --help prints subcommand usage", () => {
    const result = Bun.spawnSync(["bun", "run", CLI, "check", "--help"]);
    expect(result.exitCode).toBe(0);
    const stdout = new TextDecoder().decode(result.stdout);
    expect(stdout).toContain("Scan source files");
  });
});
