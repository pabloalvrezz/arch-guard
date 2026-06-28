import { describe, it, expect } from "bun:test";
import { sharedNoCrossGlob } from "../../src/rules/shared/no-cross-glob";
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

describe("shared/no-cross-glob", () => {
  it("is a NO-OP when no globs array is configured", () => {
    const graph: LayerGraph = {
      nodes: [
        makeNode({
          filePath: "/src/a.ts",
          layer: "domain",
          imports: ['from "../pkg/b"'],
          resolvedImports: ["/pkg/b.ts"],
          importLocations: [{ line: 1, column: 0 }],
        }),
        makeNode({
          filePath: "/pkg/b.ts",
          layer: "infrastructure",
        }),
      ],
      layers: ["domain", "infrastructure"],
      edges: [],
    };

    const config = makeConfig();
    const violations = sharedNoCrossGlob.check({ graph, config });

    expect(violations).toHaveLength(0);
  });

  it("is a NO-OP when globs has fewer than 2 entries", () => {
    const graph: LayerGraph = {
      nodes: [
        makeNode({
          filePath: "/src/a.ts",
          layer: "domain",
          imports: ['from "../pkg/b"'],
          resolvedImports: ["/pkg/b.ts"],
          importLocations: [{ line: 1, column: 0 }],
        }),
        makeNode({
          filePath: "/pkg/b.ts",
          layer: "infrastructure",
        }),
      ],
      layers: ["domain", "infrastructure"],
      edges: [],
    };

    const config = makeConfig({
      rules: { "shared/no-cross-glob": { globs: ["**/*.ts"] } },
    });
    const violations = sharedNoCrossGlob.check({ graph, config });

    expect(violations).toHaveLength(0);
  });

  it("fires when file in glob[0] imports file in glob[1]", () => {
    const graph: LayerGraph = {
      nodes: [
        makeNode({
          filePath: "/src/app.ts",
          layer: "app",
          imports: ['from "../pkg/utils"'],
          resolvedImports: ["/pkg/utils.ts"],
          importLocations: [{ line: 2, column: 5 }],
        }),
        makeNode({
          filePath: "/pkg/utils.ts",
          layer: "pkg",
        }),
      ],
      layers: ["app", "pkg"],
      edges: [],
    };

    const config = makeConfig({
      rules: {
        "shared/no-cross-glob": {
          globs: ["src/**", "pkg/**"],
        },
      },
    });
    const violations = sharedNoCrossGlob.check({ graph, config });

    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe("shared/no-cross-glob");
    expect(violations[0].file).toBe("/src/app.ts");
    expect(violations[0].line).toBe(2);
    expect(violations[0].column).toBe(5);
  });

  it("does NOT fire when both files are in the same glob", () => {
    const graph: LayerGraph = {
      nodes: [
        makeNode({
          filePath: "/src/a.ts",
          layer: "app",
          imports: ['from "./b"'],
          resolvedImports: ["/src/b.ts"],
          importLocations: [{ line: 1, column: 0 }],
        }),
        makeNode({
          filePath: "/src/b.ts",
          layer: "app",
        }),
      ],
      layers: ["app"],
      edges: [],
    };

    const config = makeConfig({
      rules: {
        "shared/no-cross-glob": {
          globs: ["src/**", "pkg/**"],
        },
      },
    });
    const violations = sharedNoCrossGlob.check({ graph, config });

    expect(violations).toHaveLength(0);
  });

  it("does NOT fire when target is not in any configured glob", () => {
    const graph: LayerGraph = {
      nodes: [
        makeNode({
          filePath: "/src/a.ts",
          layer: "app",
          imports: ['from "../lib/b"'],
          resolvedImports: ["/lib/b.ts"],
          importLocations: [{ line: 1, column: 0 }],
        }),
        makeNode({
          filePath: "/lib/b.ts",
          layer: "lib",
        }),
      ],
      layers: ["app", "lib"],
      edges: [],
    };

    const config = makeConfig({
      rules: {
        "shared/no-cross-glob": {
          globs: ["src/**", "pkg/**"],
        },
      },
    });
    const violations = sharedNoCrossGlob.check({ graph, config });

    expect(violations).toHaveLength(0);
  });

  it("does NOT fire when import is unresolvable (null)", () => {
    const graph: LayerGraph = {
      nodes: [
        makeNode({
          filePath: "/src/a.ts",
          layer: "app",
          imports: ['from "./unknown"'],
          resolvedImports: [null],
          importLocations: [{ line: 1, column: 0 }],
        }),
      ],
      layers: ["app"],
      edges: [],
    };

    const config = makeConfig({
      rules: {
        "shared/no-cross-glob": {
          globs: ["src/**", "pkg/**"],
        },
      },
    });
    const violations = sharedNoCrossGlob.check({ graph, config });

    expect(violations).toHaveLength(0);
  });

  it("works through the RuleEngine", () => {
    const engine = new RuleEngine();
    engine.register(sharedNoCrossGlob);

    const graph: LayerGraph = {
      nodes: [
        makeNode({
          filePath: "/src/app.ts",
          layer: "app",
          imports: ['from "../pkg/utils"'],
          resolvedImports: ["/pkg/utils.ts"],
          importLocations: [{ line: 1, column: 0 }],
        }),
        makeNode({
          filePath: "/pkg/utils.ts",
          layer: "pkg",
        }),
      ],
      layers: ["app", "pkg"],
      edges: [],
    };

    const config = makeConfig({
      rules: {
        "shared/no-cross-glob": {
          globs: ["src/**", "pkg/**"],
        },
      },
    });
    const violations = engine.run(graph, config);

    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe("shared/no-cross-glob");
  });
});
