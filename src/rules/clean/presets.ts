import type { LayerDef, EdgeMap } from "../../config/types";

/**
 * Clean architecture layers (Uncle Bob).
 *
 * REQ-RUL-002: clean/dependency-rule is parameterized by the active preset's edge map.
 * These are the default layer definitions for the clean preset.
 */
export const CLEAN_LAYERS: Record<string, LayerDef> = {
  entities: { path: "**/entities/**" },
  "use-cases": { path: "**/use-cases/**" },
  "interface-adapters": { path: "**/interface-adapters/**" },
  "frameworks-drivers": { path: "**/frameworks-drivers/**" },
};

/**
 * Default edge deny rules for clean architecture.
 *
 * Uncle Bob's Dependency Rule: outer layers must never import inner layers.
 * Dependencies flow inward: frameworks → interface-adapters → use-cases → entities.
 *
 * Entities (innermost):     may import nothing outer
 * Use cases:                may import only entities
 * Interface adapters:       may import use-cases + entities
 * Frameworks/drivers:       may import anything (outermost)
 */
export const CLEAN_EDGES: EdgeMap = {
  deny: [
    // entities cannot import outer layers
    "entities→use-cases",
    "entities→interface-adapters",
    "entities→frameworks-drivers",
    // use-cases cannot import outer layers
    "use-cases→interface-adapters",
    "use-cases→frameworks-drivers",
    // interface-adapters cannot import outer layers
    "interface-adapters→frameworks-drivers",
  ],
};
