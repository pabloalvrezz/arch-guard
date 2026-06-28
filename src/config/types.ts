export type RuleSeverity = "error" | "warn";

/**
 * Layer definition — maps a layer name to a glob pattern.
 */
export interface LayerDef {
  /** Glob pattern matching files that belong to this layer */
  path: string;
}

/**
 * Edge map — controls allowed and denied dependency directions.
 * Edges are expressed as "from→to" strings (e.g. "domain→infra").
 */
export interface EdgeMap {
  /** Explicitly allowed edges (bypass deny) */
  allow?: string[];
  /** Explicitly denied edges (violation if matched) */
  deny?: string[];
}

/**
 * Per-rule configuration overrides.
 */
export interface RuleConfig {
  /** Severity override for this rule */
  severity?: RuleSeverity;
  /** Glob patterns to ignore for this rule */
  ignore?: string[];
  /** Whether to enforce type-only imports for this rule */
  enforceTypeOnly?: boolean;
  /** Glob patterns for shared/no-cross-glob rule activation */
  globs?: string[];
}

/**
 * Project-level type-only import handling.
 * Default: 'ignore' (type imports are non-violating).
 */
export type TypeOnlyMode = "ignore" | "enforce";

/**
 * Preset option — which built-in preset to activate.
 * null means both presets are active (zero-config).
 */
export type PresetOption = "hex" | "clean" | null;

/**
 * Raw config document as parsed from .archguard.yml / .archguard.toml.
 * Version field is a schema discriminator (currently only version 1).
 */
export interface ConfigDocument {
  /** Schema version — currently only 1 is valid */
  version?: number;
  /** Active preset: 'hex', 'clean', or omit for both */
  preset?: PresetOption;
  /** Layer definitions: name → { path: glob } */
  layers?: Record<string, LayerDef>;
  /** Edge overrides for all rules */
  edges?: EdgeMap;
  /** Per-rule configuration */
  rules?: Record<string, RuleConfig>;
  /** Global type-only import mode */
  typeOnly?: TypeOnlyMode;
  /** Glob patterns to exclude from scanning */
  exclude?: string[];
}

/**
 * Resolved config — the fully hydrated config after applying defaults
 * and cascade merging. This is what the analyzer and rule engine consume.
 */
export interface ResolvedConfig {
  /** Schema version (always 1 for now) */
  version: 1;
  /** Active presets */
  presets: PresetOption[];
  /** Merged layer definitions */
  layers: Record<string, LayerDef>;
  /** Merged edge map */
  edges: EdgeMap;
  /** Resolved per-rule configs */
  rules: Record<string, RuleConfig>;
  /** Global type-only import mode */
  typeOnly: TypeOnlyMode;
  /** Exclude patterns */
  exclude: string[];
  /** Path to the config file that was loaded (null if zero-config) */
  configPath: string | null;
}

/**
 * Info about a discovered config file.
 */
export interface DiscoveredConfig {
  /** Absolute path to the config file */
  path: string;
  /** File format */
  format: "yml" | "yaml" | "toml";
}

/**
 * Parse error with file and line information.
 */
export interface ConfigParseError {
  /** Absolute path to the file */
  file: string;
  /** Line number where the error occurred (1-indexed) */
  line: number;
  /** Error message */
  message: string;
}

/**
 * Validation error with field path and message.
 */
export interface ConfigValidationError {
  /** Dotted path to the invalid field (e.g. "layers.domain.path") */
  path: string;
  /** Human-readable error message */
  message: string;
}
