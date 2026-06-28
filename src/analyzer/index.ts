/**
 * Analyzer module — barrel export.
 *
 * Pipeline: init project → extract imports → resolve paths → build graph
 */

// Project initialization
export { initProject, createDefaultProject, getCompilerPaths } from "./project";

// Import extraction
export type { ImportRecord } from "./imports";
export { extractImports } from "./imports";

// Path resolution
export type { PathAlias } from "./resolve";
export { resolveSpecifier, parseTsConfigPaths, resolveImports } from "./resolve";

// Layer graph
export type { GraphNode, LayerGraph } from "./graph";
export { buildLayerGraph } from "./graph";
