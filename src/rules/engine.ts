import type { LayerGraph } from "../analyzer/graph";
import type { ResolvedConfig } from "../config/types";
import type { Rule, RuleContext, Violation } from "./types";
import { matchGlob } from "./shared/match";

/**
 * Rule engine — registers rules, runs all against the graph, collects violations.
 *
 * REQ-RUL-005: rule logic is config-driven.
 * REQ-RUL-006: each rule honors per-rule severity.
 */
export class RuleEngine {
  private rules: Rule[] = [];

  /**
   * Register a rule with the engine.
   */
  register(rule: Rule): void {
    this.rules.push(rule);
  }

  /**
   * Run all registered rules against the graph and config.
   *
   * For each node in the graph, runs all registered rules and collects violations.
   * Deduplicates violations by rule+file+line+column.
   *
   * @param graph — the directed layer graph
   * @param config — resolved config
   * @returns deduplicated array of violations
   */
  run(graph: LayerGraph, config: ResolvedConfig): Violation[] {
    const ctx: RuleContext = { graph, config };
    const allViolations: Violation[] = [];

    for (const rule of this.rules) {
      const ruleConfig = config.rules[rule.id];
      const ignore = ruleConfig?.ignore ?? [];

      const violations = rule.check(ctx);

      for (const v of violations) {
        // Apply severity override from config if present,
        // otherwise keep the violation's own severity
        const violation: Violation = ruleConfig?.severity
          ? { ...v, severity: ruleConfig.severity }
          : v;

        // Check if this violation's file matches any ignore glob
        if (ignore.length > 0 && matchesIgnore(violation.file, ignore)) {
          continue;
        }

        allViolations.push(violation);
      }
    }

    // Deduplicate by rule+file+line+column
    return deduplicateViolations(allViolations);
  }
}

/**
 * Check if a file path matches any ignore glob pattern.
 */
function matchesIgnore(filePath: string, globs: string[]): boolean {
  // Normalize path for matching
  const normalized = filePath.replace(/\\/g, "/");
  return globs.some((glob) => {
    // Simple glob matching: support ** and * patterns
    const pattern = glob.replace(/\\/g, "/");
    return matchGlob(pattern, normalized);
  });
}

/**
 * Deduplicate violations by rule+file+line+column.
 */
function deduplicateViolations(violations: Violation[]): Violation[] {
  const seen = new Set<string>();
  const result: Violation[] = [];

  for (const v of violations) {
    const key = `${v.rule}:${v.file}:${v.line}:${v.column}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(v);
    }
  }

  return result;
}
