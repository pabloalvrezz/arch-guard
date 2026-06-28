import type { Rule, RuleContext, Violation } from "../types";

/**
 * Shared no-circular rule.
 *
 * REQ-RUL-003: detects circular imports between layer-tagged nodes.
 *
 * Uses the graph's edge list to build an adjacency representation, then runs
 * DFS-based cycle detection. Reports violations on every node involved in a cycle.
 */
export const sharedNoCircular: Rule = {
  id: "shared/no-circular",
  defaultSeverity: "error",

  check(ctx: RuleContext): Violation[] {
    const violations: Violation[] = [];
    const { graph } = ctx;

    // Build adjacency list keyed by file path (only layer-tagged nodes)
    const nodeByPath = new Map<string, (typeof graph.nodes)[0]>();
    const adjacency = new Map<string, string[]>();

    for (const node of graph.nodes) {
      if (node.layer === null) continue;
      nodeByPath.set(node.filePath, node);
      adjacency.set(node.filePath, []);
    }

    // Populate edges: file → resolved import (if both are layer-tagged)
    for (const node of graph.nodes) {
      if (node.layer === null) continue;
      const neighbors = adjacency.get(node.filePath)!;

      for (const resolved of node.resolvedImports) {
        if (resolved !== null && adjacency.has(resolved)) {
          neighbors.push(resolved);
        }
      }
    }

    // DFS-based cycle detection
    const WHITE = 0; // unvisited
    const GRAY = 1; // in-progress (on stack)
    const BLACK = 2; // finished

    const color = new Map<string, number>();
    const parent = new Map<string, string | null>();

    for (const path of adjacency.keys()) {
      color.set(path, WHITE);
      parent.set(path, null);
    }

    const cyclePaths: string[][] = [];

    function dfs(u: string): void {
      color.set(u, GRAY);

      for (const v of adjacency.get(u) ?? []) {
        if (color.get(v) === GRAY) {
          // Found a back edge → cycle detected
          // Reconstruct cycle path
          const cycle: string[] = [v, u];
          let current = u;
          while (current !== v) {
            current = parent.get(current)!;
            if (current === null) break;
            cycle.push(current);
          }
          cycle.reverse();
          cyclePaths.push(cycle);
        } else if (color.get(v) === WHITE) {
          parent.set(v, u);
          dfs(v);
        }
      }

      color.set(u, BLACK);
    }

    // Run DFS from each unvisited node
    for (const path of adjacency.keys()) {
      if (color.get(path) === WHITE) {
        dfs(path);
      }
    }

    // Emit violations for each node involved in any cycle
    const violationNodes = new Set<string>();
    for (const cycle of cyclePaths) {
      for (const path of cycle) {
        violationNodes.add(path);
      }
    }

    for (const nodePath of violationNodes) {
      const node = nodeByPath.get(nodePath)!;
      // Find the cycle this node participates in for the reason message
      const cycle = cyclePaths.find((c) => c.includes(nodePath));
      const cycleStr = cycle ? cycle.join(" → ") + " → " + cycle[0] : nodePath;

      violations.push({
        rule: "shared/no-circular",
        severity: "error",
        file: node.filePath,
        line: 1,
        column: 1,
        reason: `Circular dependency detected: ${cycleStr}`,
      });
    }

    return violations;
  },
};
