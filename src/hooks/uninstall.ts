import { existsSync, readFileSync, unlinkSync, writeFileSync, chmodSync } from "node:fs";
import { join } from "node:path";
import { detectHusky, resolveHookDir } from "./husky-detect";
import type { HookScope } from "./template";

export interface UninstallHookOptions {
  /** Project root directory */
  projectRoot: string;
  /** Hook scope to uninstall */
  scope?: HookScope;
}

export interface UninstallHookResult {
  /** Absolute path to the hook that was removed (or attempted) */
  hookPath: string;
  /** Whether husky was detected */
  huskyDetected: boolean;
  /** Whether a backup was restored */
  restoredBackup: boolean;
  /** Path to restored backup if applicable */
  backupPath?: string;
}

/**
 * Remove the arch-guard git hook and restore any backup.
 * REQ-HOK-006: uninstall restores backup if present
 */
export function uninstallHook(opts: UninstallHookOptions): UninstallHookResult {
  const { projectRoot, scope = "pre-commit" } = opts;

  const isHusky = detectHusky(projectRoot);
  const hookDir = resolveHookDir(projectRoot, isHusky);
  const hookPath = join(hookDir, scope);
  const backupPath = `${hookPath}.archguard.bak`;

  let restoredBackup = false;

  // REQ-HOK-006: restore backup if present
  if (existsSync(backupPath)) {
    const backupContent = readFileSync(backupPath, "utf-8");
    writeFileSync(hookPath, backupContent, { mode: 0o755 });
    try {
      chmodSync(hookPath, 0o755);
    } catch {
      // Best effort
    }
    unlinkSync(backupPath);
    restoredBackup = true;
  } else if (existsSync(hookPath)) {
    // No backup — just remove the hook
    const content = readFileSync(hookPath, "utf-8");
    if (content.includes("arch-guard")) {
      unlinkSync(hookPath);
    }
  }

  return {
    hookPath,
    huskyDetected: isHusky,
    restoredBackup,
    backupPath: restoredBackup ? backupPath : undefined,
  };
}
