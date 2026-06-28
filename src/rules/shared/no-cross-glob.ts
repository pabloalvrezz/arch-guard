import type { Rule, RuleContext, Violation } from "../types";

/**
 * Shared no-cross-glob rule.
 *
 * REQ-RUL-003: checks that files in one glob don't import files from another glob.
 *
 * When no `globs` array is declared in the rule config, this is a NO-OP.
 * When configured, checks all pairwise glob combinations and reports violations
 * when a file matching one glob imports a file matching a different glob.
 */
export const sharedNoCrossGlob: Rule = {
  id: "shared/no-cross-glob",
  defaultSeverity: "warn",

  check(ctx: RuleContext): Violation[] {
    const violations: Violation[] = [];
    const { graph, config } = ctx;

    // Get globs from rule config — NO-OP if not configured
    const ruleConfig = config.rules["shared/no-cross-glob"];
    const globs = ruleConfig?.globs;
    if (!globs || globs.length < 2) {
      return violations;
    }

    // Build a fast lookup: file path → which glob(s) it matches
    const fileGlobs = new Map<string, Set<number>>();

    for (const node of graph.nodes) {
      const normalizedPath = node.filePath.replace(/\\/g, "/");
      const matchedGlobs = new Set<number>();

      for (let i = 0; i < globs.length; i++) {
        if (matchGlob(globs[i], normalizedPath)) {
          matchedGlobs.add(i);
        }
      }

      if (matchedGlobs.size > 0) {
        fileGlobs.set(node.filePath, matchedGlobs);
      }
    }

    // Check each node's imports for cross-glob violations
    for (const node of graph.nodes) {
      const sourceGlobs = fileGlobs.get(node.filePath);
      if (!sourceGlobs || sourceGlobs.size === 0) continue;

      for (let i = 0; i < node.resolvedImports.length; i++) {
        const resolved = node.resolvedImports[i];
        if (resolved === null) continue;

        const targetGlobs = fileGlobs.get(resolved);
        if (!targetGlobs || targetGlobs.size === 0) continue;

        // Check if source and target are in different glob groups
        for (const srcIdx of sourceGlobs) {
          for (const tgtIdx of targetGlobs) {
            if (srcIdx !== tgtIdx) {
              const loc = node.importLocations[i];
              violations.push({
                rule: "shared/no-cross-glob",
                severity: "warn",
                file: node.filePath,
                line: loc.line,
                column: loc.column,
                reason: `Cross-glob import: file in glob[${srcIdx}] imports from glob[${tgtIdx}]`,
              });
              // Only report once per import (first matching glob pair)
              break;
            }
          }
          // Break after first violation per source glob to avoid duplicates
          break;
        }
      }
    }

    return violations;
  },
};

/**
 * Minimal glob matching for cross-glob patterns.
 * Supports: *, **, and literal characters.
 * Strips leading slash from paths to match glob patterns like "src/**".
 */
function matchGlob(pattern: string, value: string): boolean {
  const normalized = value.replace(/^\/+/, "");
  const regexStr = pattern
    .replace(/\./g, "\\.")
    .replace(/\*\*/g, "{{GLOBSTAR}}")
    .replace(/\*/g, "[^/]*")
    .replace(/\{\{GLOBSTAR\}\}/g, ".*");
  const regex = new RegExp(`^${regexStr}$`);
  return regex.test(normalized);
}
