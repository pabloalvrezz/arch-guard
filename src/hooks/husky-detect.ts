import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Detects whether a repository uses Husky for git hooks.
 * REQ-HOK-003: checks for `.husky/` directory at the given root.
 *
 * Detection heuristic:
 * 1. `.husky/` directory exists at project root
 * 2. It contains at least one hook file (no extension, or `.sh`)
 */
export function detectHusky(projectRoot: string): boolean {
  const huskyDir = join(projectRoot, ".husky");

  if (!existsSync(huskyDir)) return false;

  try {
    const entries = readdirSync(huskyDir);
    // Husky hook files have no extension or .sh extension
    // Ignore `_/` directory (husky internals) and `package.json`
    return entries.some((entry) => {
      if (entry === "_" || entry === "package.json" || entry === "README.md") return false;
      return !entry.includes(".") || entry.endsWith(".sh");
    });
  } catch {
    return false;
  }
}

/**
 * Returns the directory where hooks should be installed.
 * - Husky: `.husky/`
 * - Bare git: resolved from `git rev-parse --git-dir` or fallback to `.git/hooks/`
 *
 * Uses `git rev-parse --git-dir` to support worktrees, submodules, and GIT_DIR overrides.
 */
export function resolveHookDir(projectRoot: string, isHusky: boolean): string {
  if (isHusky) {
    return join(projectRoot, ".husky");
  }
  try {
    const result = Bun.spawnSync(
      ["git", "rev-parse", "--git-dir"],
      { cwd: projectRoot, stdout: "pipe", stderr: "pipe" }
    );
    if (result.exitCode === 0) {
      // git-dir is relative to project root, resolve to absolute
      return join(projectRoot, result.stdout.toString().trim(), "hooks");
    }
  } catch {
    // git not available
  }
  // Fallback to default .git/hooks/
  return join(projectRoot, ".git", "hooks");
}
