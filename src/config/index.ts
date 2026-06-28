/**
 * Config module — barrel export.
 *
 * Config pipeline: discover → load → validate → resolve defaults → cascade
 */
export type {
  ConfigDocument,
  ConfigParseError,
  ConfigValidationError,
  DiscoveredConfig,
  EdgeMap,
  LayerDef,
  PresetOption,
  ResolvedConfig,
  RuleConfig,
  RuleSeverity,
  TypeOnlyMode,
} from "./types";

export { validateConfig, parseConfig } from "./schema";
export { discoverConfig, discoverPerFileConfig, findGitRoot } from "./discover";
export { loadConfig } from "./load";
export { resolveDefaults, ZERO_CONFIG, DEFAULT_RESOLVED } from "./defaults";
export { resolveForFile, resolveBatch, resolveRuleConfig, type CascadeLayer } from "./cascade";
