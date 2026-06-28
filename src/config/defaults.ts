import type { ConfigDocument, ResolvedConfig, TypeOnlyMode } from "./types";

/**
 * Zero-config defaults.
 *
 * REQ-CFG-006: with no config file present, both hex and clean presets active.
 * Design decision: both presets active by default.
 */
export const ZERO_CONFIG: ConfigDocument = {
  version: 1,
  preset: null, // null = both presets active
  layers: {},
  edges: {},
  rules: {},
  typeOnly: "ignore",
  exclude: [],
};

/**
 * Default resolved config — applied when no config file is found.
 */
export const DEFAULT_RESOLVED: ResolvedConfig = {
  version: 1,
  presets: ["hex", "clean"],
  layers: {},
  edges: {},
  rules: {},
  typeOnly: "ignore",
  exclude: [],
  configPath: null,
};

/**
 * Resolve a ConfigDocument into a ResolvedConfig by applying defaults.
 *
 * When preset is null (or omitted), both hex and clean presets are active.
 * When preset is a string, only that preset is active.
 */
export function resolveDefaults(doc: ConfigDocument | null): ResolvedConfig {
  if (doc === null) {
    return { ...DEFAULT_RESOLVED };
  }

  const presets = resolvePresets(doc.preset);

  return {
    version: 1,
    presets,
    layers: doc.layers ?? {},
    edges: doc.edges ?? {},
    rules: doc.rules ?? {},
    typeOnly: doc.typeOnly ?? ("ignore" as TypeOnlyMode),
    exclude: doc.exclude ?? [],
    configPath: null, // set by the caller after loading
  };
}

/**
 * Resolve preset option into an array of active presets.
 */
function resolvePresets(preset: ConfigDocument["preset"]): ("hex" | "clean")[] {
  if (preset === null || preset === undefined) {
    // Zero-config: both presets active
    return ["hex", "clean"];
  }
  return [preset];
}
