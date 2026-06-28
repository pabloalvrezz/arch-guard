import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync, chmodSync } from "node:fs";
import { join } from "node:path";
import { installHook } from "../../src/hooks/install";
import { uninstallHook } from "../../src/hooks/uninstall";
import { detectHusky } from "../../src/hooks/husky-detect";

/**
 * E2E tests: create real temp git repos, install hooks, verify content.
 * These test the full integration path without mocking fs.
 */

const TMP = join(import.meta.dir, "__tmp_e2e");

beforeEach(() => {
  rmSync(TMP, { recursive: true, force: true });
});

afterEach(() => {
  rmSync(TMP, { recursive: true, force: true });
});

function initGitRepo(dir: string): void {
  mkdirSync(dir, { recursive: true });
  Bun.spawnSync(["git", "init"], { cwd: dir });
}

function initHuskyRepo(dir: string): void {
  initGitRepo(dir);
  const huskyDir = join(dir, ".husky");
  mkdirSync(huskyDir);
  writeFileSync(join(huskyDir, "pre-commit"), "#!/bin/sh\necho husky hook\n");
}

describe("E2E: hook installer in bare git repo", () => {
  it("installs pre-commit hook that can be executed", () => {
    const repo = join(TMP, "bare-repo");
    initGitRepo(repo);

    const result = installHook({ projectRoot: repo });
    expect(existsSync(result.hookPath)).toBe(true);
    expect(result.huskyDetected).toBe(false);

    // Verify content
    const content = readFileSync(result.hookPath, "utf-8");
    expect(content).toContain("#!/bin/sh");
    expect(content).toContain("arch-guard check --staged");

    // Verify it's executable
    const stat = Bun.spawnSync(["stat", "-c", "%a", result.hookPath]);
    expect(stat.stdout.toString().trim()).toBe("755");
  });

  it("full install → backup → uninstall cycle", () => {
    const repo = join(TMP, "cycle-repo");
    initGitRepo(repo);

    // Write an existing hook
    const hookPath = join(repo, ".git", "hooks", "pre-commit");
    writeFileSync(hookPath, "#!/bin/sh\necho original-hook\n", { mode: 0o755 });

    // Install → should backup
    const installResult = installHook({ projectRoot: repo });
    expect(installResult.backedUp).toBe(true);
    expect(existsSync(installResult.backupPath!)).toBe(true);

    // Verify hook is now arch-guard
    const hookContent = readFileSync(hookPath, "utf-8");
    expect(hookContent).toContain("arch-guard check --staged");

    // Uninstall → should restore
    const uninstallResult = uninstallHook({ projectRoot: repo });
    expect(uninstallResult.restoredBackup).toBe(true);

    // Verify hook is restored
    const restored = readFileSync(hookPath, "utf-8");
    expect(restored).toContain("echo original-hook");
  });
});

describe("E2E: hook installer in husky repo", () => {
  it("detects husky and installs to .husky/", () => {
    const repo = join(TMP, "husky-repo");
    initHuskyRepo(repo);

    expect(detectHusky(repo)).toBe(true);

    const result = installHook({ projectRoot: repo });
    expect(result.huskyDetected).toBe(true);
    expect(result.hookPath).toContain(".husky");
    expect(existsSync(result.hookPath)).toBe(true);

    const content = readFileSync(result.hookPath, "utf-8");
    expect(content).toContain("arch-guard check --staged");
  });

  it("backs up existing husky hook", () => {
    const repo = join(TMP, "husky-backup-repo");
    initHuskyRepo(repo);

    const result = installHook({ projectRoot: repo });
    expect(result.backedUp).toBe(true);
    expect(existsSync(result.backupPath!)).toBe(true);

    const backup = readFileSync(result.backupPath!, "utf-8");
    expect(backup).toContain("echo husky hook");
  });
});

describe("E2E: dry-run", () => {
  it("prints planned content without writing (REQ-HOK-005)", () => {
    const repo = join(TMP, "dryrun-repo");
    initGitRepo(repo);

    const hookPath = join(repo, ".git", "hooks", "pre-commit");
    const result = installHook({ projectRoot: repo, dryRun: true });

    expect(result.dryRun).toBe(true);
    expect(existsSync(hookPath)).toBe(false);
    expect(result.hookPath).toBe(hookPath);
  });
});

describe("E2E: pre-push hook", () => {
  it("installs pre-push hook with correct content", () => {
    const repo = join(TMP, "prepush-repo");
    initGitRepo(repo);

    const result = installHook({ projectRoot: repo, scope: "pre-push" });
    expect(existsSync(result.hookPath)).toBe(true);
    expect(result.hookPath).toContain("pre-push");

    const content = readFileSync(result.hookPath, "utf-8");
    expect(content).toContain("arch-guard check .");
  });
});
