import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { installHook } from "../../src/hooks/install";
import { uninstallHook } from "../../src/hooks/uninstall";

const TMP = join(import.meta.dir, "__tmp_hooks");

beforeEach(() => {
  rmSync(TMP, { recursive: true, force: true });
  mkdirSync(TMP, { recursive: true });
  // Init a real git repo so resolveHookDir can find .git via rev-parse
  Bun.spawnSync(["git", "init"], { cwd: TMP, stdout: "pipe", stderr: "pipe" });
});

afterEach(() => {
  rmSync(TMP, { recursive: true, force: true });
});

describe("installHook", () => {
  it("creates pre-commit hook in .git/hooks/", () => {
    const result = installHook({ projectRoot: TMP });
    expect(existsSync(result.hookPath)).toBe(true);
    expect(result.huskyDetected).toBe(false);
    expect(result.dryRun).toBe(false);

    const content = readFileSync(result.hookPath, "utf-8");
    expect(content).toContain("#!/bin/sh");
    expect(content).toContain("arch-guard check --staged");
  });

  it("creates pre-push hook when scope is pre-push", () => {
    const result = installHook({ projectRoot: TMP, scope: "pre-push" });
    expect(existsSync(result.hookPath)).toBe(true);
    expect(result.hookPath).toContain("pre-push");

    const content = readFileSync(result.hookPath, "utf-8");
    expect(content).toContain("arch-guard check .");
  });

  it("backs up existing hook (REQ-HOK-004)", () => {
    const hookPath = join(TMP, ".git", "hooks", "pre-commit");
    writeFileSync(hookPath, "#!/bin/sh\necho existing\n", { mode: 0o755 });

    const result = installHook({ projectRoot: TMP });
    expect(result.backedUp).toBe(true);
    expect(result.backupPath).toBe(`${hookPath}.archguard.bak`);
    expect(existsSync(result.backupPath!)).toBe(true);

    const backup = readFileSync(result.backupPath!, "utf-8");
    expect(backup).toContain("echo existing");
  });

  it("does not backup if existing hook is already arch-guard", () => {
    const hookPath = join(TMP, ".git", "hooks", "pre-commit");
    writeFileSync(hookPath, "#!/bin/sh\n# arch-guard pre-commit hook\n", { mode: 0o755 });

    const result = installHook({ projectRoot: TMP });
    expect(result.backedUp).toBe(false);
    expect(existsSync(`${hookPath}.archguard.bak`)).toBe(false);
  });

  it("dry-run does not write files (REQ-HOK-005)", () => {
    const hookPath = join(TMP, ".git", "hooks", "pre-commit");
    const result = installHook({ projectRoot: TMP, dryRun: true });
    expect(result.dryRun).toBe(true);
    expect(existsSync(hookPath)).toBe(false);
  });

  it("hook file is executable (REQ-HOK-007)", () => {
    const result = installHook({ projectRoot: TMP });
    const stat = Bun.spawnSync(["stat", "-c", "%a", result.hookPath]);
    expect(stat.stdout.toString().trim()).toBe("755");
  });

  it("installs to .husky/ when husky is detected (REQ-HOK-003)", () => {
    const huskyDir = join(TMP, ".husky");
    mkdirSync(huskyDir);
    writeFileSync(join(huskyDir, "pre-commit"), "#!/bin/sh\nold hook\n");

    const result = installHook({ projectRoot: TMP });
    expect(result.huskyDetected).toBe(true);
    expect(result.hookPath).toContain(".husky");
    expect(existsSync(result.hookPath)).toBe(true);
  });
});

describe("uninstallHook", () => {
  it("removes the hook file", () => {
    const hookPath = join(TMP, ".git", "hooks", "pre-commit");
    writeFileSync(hookPath, "#!/bin/sh\n# arch-guard pre-commit hook\n", { mode: 0o755 });

    const result = uninstallHook({ projectRoot: TMP });
    expect(existsSync(result.hookPath)).toBe(false);
    expect(result.restoredBackup).toBe(false);
  });

  it("restores backup when present (REQ-HOK-006)", () => {
    const hookPath = join(TMP, ".git", "hooks", "pre-commit");
    const backupPath = `${hookPath}.archguard.bak`;

    // Simulate: original hook was backed up, arch-guard hook is current
    writeFileSync(backupPath, "#!/bin/sh\necho original\n", { mode: 0o755 });
    writeFileSync(hookPath, "#!/bin/sh\n# arch-guard pre-commit hook\n", { mode: 0o755 });

    const result = uninstallHook({ projectRoot: TMP });
    expect(result.restoredBackup).toBe(true);
    expect(existsSync(backupPath)).toBe(false);

    // Hook should now contain original content
    const restored = readFileSync(result.hookPath, "utf-8");
    expect(restored).toContain("echo original");
    expect(restored).not.toContain("arch-guard");
  });

  it("does nothing if no hook and no backup exist", () => {
    const hookPath = join(TMP, ".git", "hooks", "pre-commit");
    const result = uninstallHook({ projectRoot: TMP });
    expect(existsSync(hookPath)).toBe(false);
    expect(result.restoredBackup).toBe(false);
  });

  it("uninstalls from .husky/ when husky is detected", () => {
    const huskyDir = join(TMP, ".husky");
    mkdirSync(huskyDir);
    const hookPath = join(huskyDir, "pre-commit");
    writeFileSync(hookPath, "#!/bin/sh\n# arch-guard pre-commit hook\n", { mode: 0o755 });

    const result = uninstallHook({ projectRoot: TMP });
    expect(result.huskyDetected).toBe(true);
    expect(result.hookPath).toContain(".husky");
    expect(existsSync(result.hookPath)).toBe(false);
  });
});
