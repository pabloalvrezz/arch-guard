import * as path from "node:path";
import pc from "picocolors";
import type { Severity } from "../rules/types";
import type { HumanReport, ReporterOptions } from "./types";

/**
 * REQ-RPT-001: Human output is TTY-aware — colors via picocolors on TTY,
 * plain text when stdout is piped.
 *
 * REQ-RPT-002: Each violation renders as a structured list entry.
 * REQ-RPT-003: Summary shows total + per-severity + per-rule counts.
 * REQ-RPT-006: --quiet suppresses per-violation lines.
 */
export function renderHuman(report: HumanReport, opts: ReporterOptions): string {
  const lines: string[] = [];
  const root = opts.projectRoot ? path.resolve(opts.projectRoot) : undefined;

  function relPath(fullPath: string): string {
    if (!root) return fullPath;
    const r = path.relative(root, fullPath);
    return r.startsWith(".") ? r : `./${r}`;
  }

  // Also replace absolute paths in reason strings (e.g. cycle paths in no-circular)
  function cleanReason(reason: string): string {
    if (!root) return reason;
    return reason.replaceAll(root, ".");
  }

  // Per-violation list entries (unless quiet)
  if (!opts.quiet) {
    for (const v of report.violations) {
      const sevLabel = v.severity === "error" ? "error" : "warn";
      const file = relPath(v.file);
      const location = `${file}:${v.line}:${v.column}`;
      const reason = cleanReason(v.reason);
      const indent = "         "; // aligns with severity label

      if (opts.isTTY) {
        const sevColor = severityColor(v.severity);
        lines.push(`  ${pc.bold(sevColor(sevLabel))}  ${pc.dim(v.rule)}`);
        lines.push(`  ${pc.dim(location)}`);
        lines.push(`  ${sevColor(reason)}`);
      } else {
        lines.push(`  ${sevLabel}  ${v.rule}`);
        lines.push(`  ${indent}${location}`);
        lines.push(`  ${indent}${reason}`);
      }
      lines.push(""); // blank line between violations
    }

    // Remove trailing blank line
    if (report.violations.length > 0) {
      lines.pop();
    }
  }

  // Blank line before summary when there are violations
  if (report.violations.length > 0) {
    lines.push("");
  }

  // Summary block
  const { summary } = report;

  if (opts.isTTY) {
    lines.push(formatSummaryTTY(summary));
  } else {
    lines.push(formatSummaryPlain(summary));
  }

  return lines.join("\n");
}

/**
 * REQ-RPT-003: Summary color-coded by worst severity.
 * Green when clean, yellow when only warns, red when any error.
 */
function formatSummaryTTY(summary: {
  total: number;
  bySeverity: Record<Severity, number>;
  byRule: Record<string, number>;
  worstSeverity: Severity | null;
}): string {
  if (summary.total === 0) {
    return pc.green("0 violations");
  }

  const parts: string[] = [];

  // Total — colored by worst severity
  const totalStr = `${summary.total} violation${summary.total === 1 ? "" : "s"}`;
  parts.push(worstColor(summary.worstSeverity)(totalStr));

  // Per-severity breakdown
  const sevParts: string[] = [];
  if (summary.bySeverity.error > 0) {
    sevParts.push(pc.red(`${summary.bySeverity.error} error${summary.bySeverity.error === 1 ? "" : "s"}`));
  }
  if (summary.bySeverity.warn > 0) {
    sevParts.push(pc.yellow(`${summary.bySeverity.warn} warn${summary.bySeverity.warn === 1 ? "" : "s"}`));
  }
  if (sevParts.length > 0) {
    parts.push(`(${sevParts.join(", ")})`);
  }

  // Per-rule breakdown
  const ruleParts: string[] = [];
  for (const [rule, count] of Object.entries(summary.byRule)) {
    ruleParts.push(`${rule}: ${count}`);
  }
  if (ruleParts.length > 0) {
    parts.push(`[${ruleParts.join(", ")}]`);
  }

  return parts.join(" ");
}

function formatSummaryPlain(summary: {
  total: number;
  bySeverity: Record<Severity, number>;
  byRule: Record<string, number>;
}): string {
  if (summary.total === 0) {
    return "0 violations";
  }

  const parts: string[] = [`${summary.total} violation${summary.total === 1 ? "" : "s"}`];

  const sevParts: string[] = [];
  if (summary.bySeverity.error > 0) {
    sevParts.push(`${summary.bySeverity.error} error${summary.bySeverity.error === 1 ? "" : "s"}`);
  }
  if (summary.bySeverity.warn > 0) {
    sevParts.push(`${summary.bySeverity.warn} warn${summary.bySeverity.warn === 1 ? "" : "s"}`);
  }
  if (sevParts.length > 0) {
    parts.push(`(${sevParts.join(", ")})`);
  }

  const ruleParts: string[] = [];
  for (const [rule, count] of Object.entries(summary.byRule)) {
    ruleParts.push(`${rule}: ${count}`);
  }
  if (ruleParts.length > 0) {
    parts.push(`[${ruleParts.join(", ")}]`);
  }

  return parts.join(" ");
}

function severityColor(severity: Severity): (s: string) => string {
  return severity === "error" ? pc.red : pc.yellow;
}

function worstColor(worst: Severity | null): (s: string) => string {
  if (worst === "error") return pc.red;
  if (worst === "warn") return pc.yellow;
  return pc.green;
}
