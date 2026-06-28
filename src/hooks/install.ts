import { existsSync, readFileSync, writeFileSync, chmodSync } from "node:fs";
import { join } from "node:path";
import { detectHusky, resolveHookDir } from "./husky-detect";
import { getHookTemplate, type HookScope } from "./template";

export interface InstallHookOptions {
  /** Project root directory (where .git lives) */
  projectRoot: string;
  /** Hook scope: pre-commit (default) or pre-push */
  scope?: HookScope;
  /** Print planned content without writing */
  dryRun?: boolean;
}

export interface InstallHookResult {
  /** Absolute path to the hook file that was (or would be) written */
  hookPath: string;
  /** Whether husky was detected */
  huskyDetected: boolean;
  /** Whether an existing hook was backed up */
  backedUp: boolean;
  /** Path to backup file if created */
  backupPath?: string;
  /** Whether this was a dry run (nothing written) */
  dryRun: boolean;
}

/**
 * Install a git hook that runs arch-guard.
 *
 * REQ-HOK-001: writes pre-commit hook that invokes `arch-guard check --staged`
 * REQ-HOK-003: detect husky and install to `.husky/` instead of `.git/hooks/`
 * REQ-HOK-004: backup existing hook to `<path>.archguard.bak`
 * REQ-HOK-005: `--dry-run` prints planned content without writing
 * REQ-HOK-007: hook is POSIX-shell executable, blocks commit on exit 1
 */
export function installHook(opts: InstallHookOptions): InstallHookResult {
  const { projectRoot, scope = "pre-commit", dryRun = false } = opts;

  const isHusky = detectHusky(projectRoot);
  const hookDir = resolveHookDir(projectRoot, isHusky);
  const hookPath = join(hookDir, scope);
  const backupPath = `${hookPath}.archguard.bak`;

  const content = getHookTemplate(scope);
  let backedUp = false;

  // REQ-HOK-004: backup existing hook
  if (existsSync(hookPath)) {
    if (dryRun) {
      backedUp = true; // would backup
    } else {
      const existing = readFileSync(hookPath, "utf-8");
      // Don't backup if it's already our hook
      if (!existing.includes("arch-guard")) {
        writeFileSync(backupPath, existing, { mode: 0o755 });
        backedUp = true;
      }
    }
  }

  // REQ-HOK-005: dry-run prints planned content without writing
  if (dryRun) {
    return {
      hookPath,
      huskyDetected: isHusky,
      backedUp,
      backupPath: backedUp ? backupPath : undefined,
      dryRun: true,
    };
  }

  // Write hook
  writeFileSync(hookPath, content, { mode: 0o755 });

  // Ensure executable (belt and suspenders)
  try {
    chmodSync(hookPath, 0o755);
  } catch {
    // chmod may fail on some filesystems; writeFileSync with mode is primary
  }

  return {
    hookPath,
    huskyDetected: isHusky,
    backedUp,
    backupPath: backedUp ? backupPath : undefined,
    dryRun: false,
  };
}
