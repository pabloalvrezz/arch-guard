import * as fs from "node:fs";
import * as path from "node:path";
import type { DiscoveredConfig } from "./types";

/**
 * Candidate config file names, in priority order.
 * REQ-CFG-001: .archguard.yml / .archguard.yaml / .archguard.toml
 */
const CONFIG_NAMES = [".archguard.yml", ".archguard.yaml", ".archguard.toml"] as const;

/**
 * Format extension → format type mapping.
 */
const EXTENSION_MAP: Record<string, DiscoveredConfig["format"]> = {
  ".yml": "yml",
  ".yaml": "yaml",
  ".toml": "toml",
};

/**
 * Find the git root directory by walking upward and running `git rev-parse --show-toplevel`.
 * Returns null if not inside a git repo.
 */
export function findGitRoot(startDir: string): string | null {
  try {
    const result = Bun.spawnSync(
      ["git", "rev-parse", "--show-toplevel"],
      { cwd: startDir, stdout: "pipe", stderr: "pipe" }
    );
    if (result.exitCode === 0) {
      return result.stdout.toString().trim();
    }
  } catch {
    // git not available or not in a repo
  }
  return null;
}

/**
 * Walk from `startDir` upward to `stopDir` (inclusive), looking for config files.
 * First match wins. Returns null if nothing found.
 *
 * REQ-CFG-001: cwd upward to git root. First match wins.
 */
export function discoverConfig(
  startDir: string,
  stopDir?: string
): DiscoveredConfig | null {
  const gitRoot = stopDir ?? findGitRoot(startDir) ?? path.parse(startDir).root;
  let current = path.resolve(startDir);

  while (true) {
    for (const name of CONFIG_NAMES) {
      const candidate = path.join(current, name);
      try {
        const stat = fs.statSync(candidate);
        if (stat.isFile()) {
          const ext = path.extname(candidate);
          const format = EXTENSION_MAP[ext];
          if (format) {
            return { path: candidate, format };
          }
        }
      } catch {
        // File doesn't exist — continue
      }
    }

    // Stop at git root or filesystem root
    if (current === gitRoot) break;

    const parent = path.dirname(current);
    if (parent === current) break; // filesystem root
    current = parent;
  }

  return null;
}

/**
 * Find the nearest per-file .archguard.* config for a given source file.
 * Walks upward from the file's directory to the git root.
 *
 * Design decision: per-file config wins over CLI config for `layers` and `edges` only.
 * `rules` stay global.
 */
export function discoverPerFileConfig(filePath: string): DiscoveredConfig | null {
  const fileDir = path.dirname(filePath);
  const gitRoot = findGitRoot(fileDir);
  return discoverConfig(fileDir, gitRoot ?? undefined);
}
