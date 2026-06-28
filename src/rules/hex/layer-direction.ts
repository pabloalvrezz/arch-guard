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

    // Check each node's imports for layer-direction violations
    for (const node of graph.nodes) {
      if (node.layer === null) continue;

      // Check each resolved import
      for (let i = 0; i < node.resolvedImports.length; i++) {
        const resolved = node.resolvedImports[i];
        if (resolved === null) continue;

        // Find the layer of the imported file
        const importedLayer = findLayerOfImport(resolved, graph);
        if (importedLayer === null) continue;

        // Skip same-layer imports
        if (importedLayer === node.layer) continue;

        // Check if this edge is in the deny list
        const edgeKey = `${node.layer}→${importedLayer}`;
        if (denyEdges.has(edgeKey)) {
          violations.push({
            rule: "hex/layer-direction",
            severity: "error", // Will be overridden by engine
            file: node.filePath,
            line: node.importLines[i],
            column: 1, // Column not tracked at graph level
            reason: `Forbidden dependency: ${node.layer} → ${importedLayer} (denied by ${edgeKey})`,
          });
        }
      }
    }

    return violations;
  },
};

/**
 * Find the layer of a resolved import path by checking the graph nodes.
 */
function findLayerOfImport(
  resolvedPath: string,
  graph: { nodes: Array<{ filePath: string; layer: string | null }> }
): string | null {
  for (const node of graph.nodes) {
    if (node.filePath === resolvedPath) {
      return node.layer;
    }
  }
  return null;
}
