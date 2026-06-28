import type { Violation } from "../rules/types";
import type { JSONReport, ReportSummary } from "./types";

/**
 * REQ-RPT-004: JSON output matches stable schema:
 * `{ version, summary, violations }` with `version: "0.1.0"`.
 *
 * REQ-RPT-006: quiet mode suppresses per-violation entries;
 * only summary is included.
 *
 * Output is deterministic (violations must be pre-sorted by caller).
 */
export function renderJSON(violations: Violation[], quiet?: boolean): JSONReport {
  return {
    version: "0.1.0",
    summary: buildSummary(violations),
    violations: quiet ? [] : violations,
  };
}

/**
 * REQ-RPT-003: Build summary with total + per-severity + per-rule counts.
 */
export function buildSummary(violations: Violation[]): ReportSummary {
  const bySeverity: Record<string, number> = { error: 0, warn: 0 };
  const byRule: Record<string, number> = {};
  let worstSeverity: "error" | "warn" | null = null;

  for (const v of violations) {
    bySeverity[v.severity] = (bySeverity[v.severity] ?? 0) + 1;
    byRule[v.rule] = (byRule[v.rule] ?? 0) + 1;

    if (v.severity === "error") {
      worstSeverity = "error";
    } else if (worstSeverity !== "error") {
      worstSeverity = "warn";
    }
  }

  return {
    total: violations.length,
    bySeverity: bySeverity as Record<"error" | "warn", number>,
    byRule,
    worstSeverity,
  };
}
