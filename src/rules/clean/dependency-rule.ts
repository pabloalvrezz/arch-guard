import type { Rule, RuleContext, Violation } from "../types";

/**
 * Clean architecture dependency-direction rule.
 *
 * REQ-RUL-002: parameterized by the active preset's edge map.
 * REQ-RUL-005: config-driven — no hard-coded layer names inside rules.
 *
 * Enforces the Uncle Bob dependency direction: outer layers must never import
 * inner layers. A violation fires when an outer layer imports an inner layer.
 */
export const cleanDependencyRule: Rule = {
  id: "clean/dependency-rule",
  defaultSeverity: "error",

  check(ctx: RuleContext): Violation[] {
    const violations: Violation[] = [];
    const { graph, config } = ctx;

    // Build the deny set from config edges
    const denyEdges = new Set(config.edges.deny ?? []);

    // Pre-build layer lookup map for O(1) import→layer resolution
    const layerByPath = new Map<string, string | null>();
    for (const node of graph.nodes) {
      if (node.filePath) {
        layerByPath.set(node.filePath, node.layer);
      }
    }

    // Check each node's imports for dependency-direction violations
    for (const node of graph.nodes) {
      if (node.layer === null) continue;

      for (let i = 0; i < node.resolvedImports.length; i++) {
        const resolved = node.resolvedImports[i];
        if (resolved === null) continue;

        const importedLayer = layerByPath.get(resolved) ?? null;
        if (importedLayer === null) continue;

        // Skip same-layer imports
        if (importedLayer === node.layer) continue;

        // Check if this edge is in the deny list
        const edgeKey = `${node.layer}→${importedLayer}`;
        if (denyEdges.has(edgeKey)) {
          const loc = node.importLocations[i];
          violations.push({
            rule: "clean/dependency-rule",
            severity: "error",
            file: node.filePath,
            line: loc.line,
            column: loc.column,
            reason: `Clean architecture violation: ${node.layer} → ${importedLayer} (denied by ${edgeKey})`,
          });
        }
      }
    }

    return violations;
  },
};
