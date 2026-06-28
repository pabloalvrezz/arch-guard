import type { Rule, RuleContext, Violation } from "../types";

/**
 * Hexagonal architecture layer-direction rule.
 *
 * REQ-RUL-001: parameterized by the active preset's edge map.
 * REQ-RUL-005: config-driven — no hard-coded layer names inside rules.
 *
 * Checks each graph edge against the configured deny list.
 * If an edge matches a deny rule, emits a violation.
 */
export const hexLayerDirection: Rule = {
  id: "hex/layer-direction",
  defaultSeverity: "error",

  check(ctx: RuleContext): Violation[] {
    const violations: Violation[] = [];
    const { graph, config } = ctx;

    // Build the deny set from config edges
    const denyEdges = new Set(config.edges.deny ?? []);

    // Pre-build layer lookup map for O(1) import→layer resolution
    const layerByPath = new Map<string, string | null>();
    for (const node of graph.nodes) {
      // Only cache nodes that have been resolved (have a file path)
      if (node.filePath) {
        layerByPath.set(node.filePath, node.layer);
      }
    }

    // Check each node's imports for layer-direction violations
    for (const node of graph.nodes) {
      if (node.layer === null) continue;

      // Check each resolved import
      for (let i = 0; i < node.resolvedImports.length; i++) {
        const resolved = node.resolvedImports[i];
        if (resolved === null) continue;

        // Find the layer of the imported file (O(1) via pre-built map)
        const importedLayer = layerByPath.get(resolved) ?? null;
        if (importedLayer === null) continue;

        // Skip same-layer imports
        if (importedLayer === node.layer) continue;

        // Check if this edge is in the deny list
        const edgeKey = `${node.layer}→${importedLayer}`;
        if (denyEdges.has(edgeKey)) {
          const loc = node.importLocations[i];
          violations.push({
            rule: "hex/layer-direction",
            severity: "error", // Will be overridden by engine
            file: node.filePath,
            line: loc.line,
            column: loc.column,
            reason: `Forbidden dependency: ${node.layer} → ${importedLayer} (denied by ${edgeKey})`,
          });
        }
      }
    }

    return violations;
  },
};


