/**
 * POSIX-shell hook script templates for arch-guard git hooks.
 * REQ-HOK-001: pre-commit runs `arch-guard check --staged`
 * REQ-HOK-007: hook is POSIX-shell executable, blocks commit on exit 1
 */

export type HookScope = "pre-commit" | "pre-push";

const HOOK_TEMPLATES: Record<HookScope, string> = {
  "pre-commit": `#!/bin/sh
# arch-guard pre-commit hook — auto-generated, do not edit
# REQ-HOK-001: runs \`arch-guard check --staged\` before each commit

arch-guard check --staged
exit $?
`,
  "pre-push": `#!/bin/sh
# arch-guard pre-push hook — auto-generated, do not edit
# Runs \`arch-guard check\` before push to verify full codebase

arch-guard check .
exit $?
`,
};

/**
 * Returns the POSIX-shell hook script for the given scope.
 * The script is executable and exits with arch-guard's exit code,
 * blocking the git operation on violations (exit 1).
 */
export function getHookTemplate(scope: HookScope): string {
  return HOOK_TEMPLATES[scope];
}
