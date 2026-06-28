import * as path from "node:path";
import type { ConfigDocument, DiscoveredConfig, LayerDef, EdgeMap, RuleConfig, ResolvedConfig } from "./types";
import { discoverPerFileConfig } from "./discover";
import { loadConfig } from "./load";

/**
 * Two-tier config cascade.
 *
 * Tier 1 (global): CLI config — loaded once, applies to all files.
 * Tier 2 (per-file): nearest .archguard.* to each source file.
 *
 * Per-file wins over CLI config for `layers` and `edges` only.
 * `rules` are NOT inherited per-file (rules stay global to avoid surprise).
 *
 * Design decision documented in design.md: "Config cascade boundaries".
 */
export interface CascadeLayer {
  /** File path this layer config applies to */
  filePath: string;
  /** Merged layer definitions (per-file overrides global) */
  layers: Record<string, LayerDef>;
  /** Merged edge map (per-file overrides global) */
  edges: EdgeMap;
}

/**
 * Resolve the effective layer map and edge map for a specific file,
 * using the two-tier cascade: global config + per-file config.
 *
 * @param globalConfig - The resolved config from CLI discovery
 * @param filePath - The source file to resolve layers for
 * @returns Merged layers and edges for the file
 */
export function resolveForFile(
  globalConfig: ResolvedConfig,
  filePath: string
): CascadeLayer {
  // Check for per-file config
  const perFile = discoverPerFileConfig(filePath);
  if (perFile === null) {
    // No per-file config — use global
    return {
      filePath,
      layers: globalConfig.layers,
      edges: globalConfig.edges,
    };
  }

  // Load per-file config (may throw on parse error)
  let perFileDoc: ConfigDocument;
  try {
    perFileDoc = loadConfig(perFile);
  } catch {
    // If per-file config fails to load, fall back to global
    return {
      filePath,
      layers: globalConfig.layers,
      edges: globalConfig.edges,
    };
  }

  // Per-file wins for layers and edges only (design decision)
  return {
    filePath,
    layers: perFileDoc.layers ?? globalConfig.layers,
    edges: perFileDoc.edges ?? globalConfig.edges,
  };
}

/**
 * Resolve layers for a batch of files.
 * Returns a map from file path to its cascade layer.
 */
export function resolveBatch(
  globalConfig: ResolvedConfig,
  filePaths: string[]
): Map<string, CascadeLayer> {
  const result = new Map<string, CascadeLayer>();

  for (const filePath of filePaths) {
    result.set(filePath, resolveForFile(globalConfig, filePath));
  }

  return result;
}

/**
 * Get the effective rule config for a specific rule.
 * Rules are always global — per-file config does NOT override rules.
 */
export function resolveRuleConfig(
  globalConfig: ResolvedConfig,
  ruleId: string
): RuleConfig {
  return globalConfig.rules[ruleId] ?? {};
}
