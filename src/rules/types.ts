import type { LayerGraph } from "../analyzer/graph";
import type { ResolvedConfig } from "../config/types";

/**
 * Severity level for violations.
 * REQ-RUL-006: each rule honors per-rule severity: error|warn.
 */
export type Severity = "error" | "warn";

/**
 * A single violation detected by a rule.
 * REQ-RUL-004: violation record structure.
 */
export interface Violation {
  /** Rule identifier that produced this violation (e.g. "hex/layer-direction") */
  rule: string;
  /** Severity of this violation */
  severity: Severity;
  /** Absolute file path where the violation was found */
  file: string;
  /** Line number (1-indexed) */
  line: number;
  /** Column number (1-indexed) */
  column: number;
  /** Human-readable reason for the violation */
  reason: string;
}

/**
 * Context passed to every rule's check function.
 * Contains the full layer graph and resolved config.
 */
export interface RuleContext {
  /** The directed layer graph produced by the analyzer */
  graph: LayerGraph;
  /** The fully resolved config */
  config: ResolvedConfig;
}

/**
 * A rule that can be registered with the rule engine.
 * REQ-RUL-005: rule logic is config-driven — no hard-coded layer names inside rules.
 *
 * Rules are pure functions: check(ctx) → Violation[].
 */
export interface Rule {
  /** Unique rule identifier (e.g. "hex/layer-direction") */
  id: string;
  /** Default severity when no per-rule override is configured */
  defaultSeverity: Severity;
  /**
   * Check the graph for violations.
   * @param ctx — context with graph and config
   * @returns array of violations found
   */
  check(ctx: RuleContext): Violation[];
}
