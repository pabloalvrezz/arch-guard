import type { Severity, Violation } from "../rules/types";

/**
 * REQ-RPT-004: JSON output schema for MVP.
 */
export interface JSONReport {
  /** Semver version of the report schema */
  version: "0.1.0";
  /** Aggregate summary of the scan */
  summary: ReportSummary;
  /** All violations, sorted deterministically */
  violations: Violation[];
}

/**
 * REQ-RPT-003: Summary showing total + per-severity + per-rule counts.
 */
export interface ReportSummary {
  /** Total number of violations */
  total: number;
  /** Count by severity */
  bySeverity: Record<Severity, number>;
  /** Count by rule id */
  byRule: Record<string, number>;
  /** Worst severity present (error > warn); null when no violations */
  worstSeverity: Severity | null;
}

/**
 * REQ-RPT-001/002/003: Human-readable report context.
 */
export interface HumanReport {
  /** Sorted violations to render */
  violations: Violation[];
  /** Pre-computed summary */
  summary: ReportSummary;
}

/**
 * Options controlling reporter behavior.
 */
export interface ReporterOptions {
  /** Whether stdout is a TTY (enables colors) */
  isTTY: boolean;
  /** REQ-RPT-006: suppress per-violation lines, only summary on stderr */
  quiet: boolean;
  /** Project root path — violations paths are shown relative to this */
  projectRoot?: string;
}
