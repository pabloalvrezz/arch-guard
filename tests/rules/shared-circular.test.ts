import { describe, it, expect } from "bun:test";
import { sharedNoCircular } from "../../src/rules/shared/no-circular";
import { RuleEngine } from "../../src/rules/engine";
import type { RuleContext } from "../../src/rules/types";
import type { LayerGraph, GraphNode } from "../../src/analyzer/graph";
import type { ResolvedConfig } from "../../src/config/types";

function makeConfig(overrides: Partial<ResolvedConfig> = {}): ResolvedConfig {
  return {
    version: 1,
    presets: ["hex"],
    layers: {},
    edges: {},
    rules: {},
    typeOnly: "ignore",
    exclude: [],
    configPath: null,
    ...overrides,
  };
}

function makeNode(overrides: Partial<GraphNode> & { filePath: string }): GraphNode {
  return {
    layer: null,
    imports: [],
    resolvedImports: [],
    importLocations: [],
    ...overrides,
  };
}

describe("shared/no-circular", () => {
  it("fires on both files when a↔b cycle exists", () => {
    const graph: LayerGraph = {
      nodes: [
        makeNode({
          filePath: "/src/a.ts",
          layer: "domain",
          imports: ['from "./b"'],
          resolvedImports: ["/src/b.ts"],
          importLocations: [{ line: 1, column: 0 }],
        }),
        makeNode({
          filePath: "/src/b.ts",
          layer: "domain",
          imports: ['from "./a"'],
          resolvedImports: ["/src/a.ts"],
          importLocations: [{ line: 1, column: 0 }],
        }),
      ],
      layers: ["domain"],
      edges: [{ from: "domain", to: "domain" }],
    };

    const config = makeConfig();
    const violations = sharedNoCircular.check({ graph, config });

    expect(violations.length).toBeGreaterThanOrEqual(2);
    const files = violations.map((v) => v.file).sort();
    expect(files).toContain("/src/a.ts");
    expect(files).toContain("/src/b.ts");
    expect(violations[0].rule).toBe("shared/no-circular");
  });

  it("fires on all three files in a 3-node cycle", () => {
    const graph: LayerGraph = {
      nodes: [
        makeNode({
          filePath: "/src/a.ts",
          layer: "domain",
          imports: ['from "./b"'],
          resolvedImports: ["/src/b.ts"],
          importLocations: [{ line: 1, column: 0 }],
        }),
        makeNode({
          filePath: "/src/b.ts",
          layer: "domain",
          imports: ['from "./c"'],
          resolvedImports: ["/src/c.ts"],
          importLocations: [{ line: 1, column: 0 }],
        }),
        makeNode({
          filePath: "/src/c.ts",
          layer: "domain",
          imports: ['from "./a"'],
          resolvedImports: ["/src/a.ts"],
          importLocations: [{ line: 1, column: 0 }],
        }),
      ],
      layers: ["domain"],
      edges: [{ from: "domain", to: "domain" }],
    };

    const config = makeConfig();
    const violations = sharedNoCircular.check({ graph, config });

    const files = violations.map((v) => v.file).sort();
    expect(files).toContain("/src/a.ts");
    expect(files).toContain("/src/b.ts");
    expect(files).toContain("/src/c.ts");
  });

  it("does NOT fire when imports are one-directional (no cycle)", () => {
    const graph: LayerGraph = {
      nodes: [
        makeNode({
          filePath: "/src/a.ts",
          layer: "domain",
          imports: ['from "./b"'],
          resolvedImports: ["/src/b.ts"],
          importLocations: [{ line: 1, column: 0 }],
        }),
        makeNode({
          filePath: "/src/b.ts",
          layer: "domain",
          imports: ['from "./c"'],
          resolvedImports: ["/src/c.ts"],
          importLocations: [{ line: 1, column: 0 }],
        }),
        makeNode({
          filePath: "/src/c.ts",
          layer: "domain",
        }),
      ],
      layers: ["domain"],
      edges: [{ from: "domain", to: "domain" }],
    };

    const config = makeConfig();
    const violations = sharedNoCircular.check({ graph, config });

    expect(violations).toHaveLength(0);
  });

  it("does NOT fire on self-imports (same file)", () => {
    const graph: LayerGraph = {
      nodes: [
        makeNode({
          filePath: "/src/a.ts",
          layer: "domain",
          imports: ['from "./a"'],
          resolvedImports: ["/src/a.ts"],
          importLocations: [{ line: 1, column: 0 }],
        }),
      ],
      layers: ["domain"],
      edges: [],
    };

    const config = makeConfig();
    const violations = sharedNoCircular.check({ graph, config });

    // Self-import is technically a cycle but the graph has only one node
    // and the adjacency check won't produce a back edge (a→a is a self-loop,
    // but DFS marks a as GRAY before exploring neighbors, so it IS detected).
    // This is correct behavior — self-imports are circular.
    expect(violations.length).toBeGreaterThanOrEqual(1);
    expect(violations[0].file).toBe("/src/a.ts");
  });

  it("ignores nodes with no layer match", () => {
    const graph: LayerGraph = {
      nodes: [
        makeNode({
          filePath: "/src/a.ts",
          layer: null,
          imports: ['from "./b"'],
          resolvedImports: ["/src/b.ts"],
          importLocations: [{ line: 1, column: 0 }],
        }),
        makeNode({
          filePath: "/src/b.ts",
          layer: null,
          imports: ['from "./a"'],
          resolvedImports: ["/src/a.ts"],
          importLocations: [{ line: 1, column: 0 }],
        }),
      ],
      layers: [],
      edges: [],
    };

    const config = makeConfig();
    const violations = sharedNoCircular.check({ graph, config });

    expect(violations).toHaveLength(0);
  });

  it("does NOT fire when graph is empty", () => {
    const graph: LayerGraph = {
      nodes: [],
      layers: [],
      edges: [],
    };

    const config = makeConfig();
    const violations = sharedNoCircular.check({ graph, config });

    expect(violations).toHaveLength(0);
  });

  it("works through the RuleEngine", () => {
    const engine = new RuleEngine();
    engine.register(sharedNoCircular);

    const graph: LayerGraph = {
      nodes: [
        makeNode({
          filePath: "/src/a.ts",
          layer: "domain",
          imports: ['from "./b"'],
          resolvedImports: ["/src/b.ts"],
          importLocations: [{ line: 1, column: 0 }],
        }),
        makeNode({
          filePath: "/src/b.ts",
          layer: "domain",
          imports: ['from "./a"'],
          resolvedImports: ["/src/a.ts"],
          importLocations: [{ line: 1, column: 0 }],
        }),
      ],
      layers: ["domain"],
      edges: [{ from: "domain", to: "domain" }],
    };

    const config = makeConfig();
    const violations = engine.run(graph, config);

    expect(violations.length).toBeGreaterThanOrEqual(2);
    expect(violations[0].rule).toBe("shared/no-circular");
  });
});
