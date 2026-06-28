import type { LayerDef, EdgeMap } from "../../config/types";

/**
 * Hexagonal architecture layers.
 *
 * REQ-RUL-001: hex/layer-direction is parameterized by the active preset's edge map.
 * These are the default layer definitions for the hex preset.
 */
export const HEX_LAYERS: Record<string, LayerDef> = {
  domain: { path: "**/domain/**" },
  application: { path: "**/application/**" },
  "interface-adapters": { path: "**/interface-adapters/**" },
  infrastructure: { path: "**/infrastructure/**" },
};

/**
 * Default edge deny rules for hexagonal architecture.
 *
 * The hexagonal architecture enforces dependency direction:
 * - Domain should NOT depend on infrastructure or interface adapters
 * - Application should NOT depend on infrastructure or interface adapters
 * - Dependencies flow inward: infrastructure → application → domain
 */
export const HEX_EDGES: EdgeMap = {
  deny: [
    "domain→infrastructure",
    "domain→interface-adapters",
    "application→infrastructure",
    "application→interface-adapters",
  ],
};
