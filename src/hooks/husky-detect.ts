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
 */
export function resolveHookDir(projectRoot: string, isHusky: boolean): string {
  if (isHusky) {
    return join(projectRoot, ".husky");
  }
  return join(projectRoot, ".git", "hooks");
}
