import { describe, it, expect } from "bun:test";
import { hexLayerDirection } from "../../src/rules/hex/layer-direction";
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

describe("hex/layer-direction", () => {
  it("fires violation when domain imports infra", () => {
    const graph: LayerGraph = {
      nodes: [
        makeNode({
          filePath: "/src/domain/order.ts",
          layer: "domain",
          imports: ['from "../infra/db"'],
          resolvedImports: ["/src/infra/db.ts"],
          importLocations: [{ line: 1, column: 0 }],
        }),
        makeNode({
          filePath: "/src/infra/db.ts",
          layer: "infrastructure",
        }),
      ],
      layers: ["domain", "infrastructure"],
      edges: [{ from: "domain", to: "infrastructure" }],
    };

    const config = makeConfig({
      edges: { deny: ["domain→infrastructure"] },
    });

    const violations = hexLayerDirection.check({ graph, config });
    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe("hex/layer-direction");
    expect(violations[0].file).toBe("/src/domain/order.ts");
    expect(violations[0].line).toBe(1);
    expect(violations[0].column).toBe(0);
    expect(violations[0].reason).toContain("domain → infrastructure");
  });

  it("fires violation when domain imports interface-adapters", () => {
    const graph: LayerGraph = {
      nodes: [
        makeNode({
          filePath: "/src/domain/order.ts",
          layer: "domain",
          imports: ['from "../interface-adapters/http"'],
          resolvedImports: ["/src/interface-adapters/http.ts"],
          importLocations: [{ line: 1, column: 0 }],
        }),
        makeNode({
          filePath: "/src/interface-adapters/http.ts",
          layer: "interface-adapters",
        }),
      ],
      layers: ["domain", "interface-adapters"],
      edges: [{ from: "domain", to: "interface-adapters" }],
    };

    const config = makeConfig({
      edges: { deny: ["domain→interface-adapters"] },
    });

    const violations = hexLayerDirection.check({ graph, config });
    expect(violations).toHaveLength(1);
    expect(violations[0].reason).toContain("domain → interface-adapters");
  });

  it("fires violation when application imports infra", () => {
    const graph: LayerGraph = {
      nodes: [
        makeNode({
          filePath: "/src/application/usecase.ts",
          layer: "application",
          imports: ['from "../infrastructure/db"'],
          resolvedImports: ["/src/infrastructure/db.ts"],
          importLocations: [{ line: 1, column: 0 }],
        }),
        makeNode({
          filePath: "/src/infrastructure/db.ts",
          layer: "infrastructure",
        }),
      ],
      layers: ["application", "infrastructure"],
      edges: [{ from: "application", to: "infrastructure" }],
    };

    const config = makeConfig({
      edges: { deny: ["application→infrastructure"] },
    });

    const violations = hexLayerDirection.check({ graph, config });
    expect(violations).toHaveLength(1);
    expect(violations[0].reason).toContain("application → infrastructure");
  });

  it("does NOT fire when domain imports application (allowed direction)", () => {
    const graph: LayerGraph = {
      nodes: [
        makeNode({
          filePath: "/src/domain/order.ts",
          layer: "domain",
          imports: ['from "../application/usecase"'],
          resolvedImports: ["/src/application/usecase.ts"],
          importLocations: [{ line: 1, column: 0 }],
        }),
        makeNode({
          filePath: "/src/application/usecase.ts",
          layer: "application",
        }),
      ],
      layers: ["domain", "application"],
      edges: [{ from: "domain", to: "application" }],
    };

    const config = makeConfig({
      edges: { deny: ["domain→infrastructure", "domain→interface-adapters"] },
    });

    const violations = hexLayerDirection.check({ graph, config });
    expect(violations).toHaveLength(0);
  });

  it("does NOT fire for same-layer imports", () => {
    const graph: LayerGraph = {
      nodes: [
        makeNode({
          filePath: "/src/domain/order.ts",
          layer: "domain",
          imports: ['from "./user"'],
          resolvedImports: ["/src/domain/user.ts"],
          importLocations: [{ line: 1, column: 0 }],
        }),
        makeNode({
          filePath: "/src/domain/user.ts",
          layer: "domain",
        }),
      ],
      layers: ["domain"],
      edges: [],
    };

    const config = makeConfig({
      edges: { deny: ["domain→infrastructure"] },
    });

    const violations = hexLayerDirection.check({ graph, config });
    expect(violations).toHaveLength(0);
  });

  it("skips nodes with no layer match", () => {
    const graph: LayerGraph = {
      nodes: [
        makeNode({
          filePath: "/src/barrel.ts",
          layer: null,
          imports: ['from "./domain/order"'],
          resolvedImports: ["/src/domain/order.ts"],
          importLocations: [{ line: 1, column: 0 }],
        }),
      ],
      layers: ["domain"],
      edges: [],
    };

    const config = makeConfig({
      edges: { deny: ["domain→infrastructure"] },
    });

    const violations = hexLayerDirection.check({ graph, config });
    expect(violations).toHaveLength(0);
  });

  it("skips unresolvable imports (null resolved)", () => {
    const graph: LayerGraph = {
      nodes: [
        makeNode({
          filePath: "/src/domain/order.ts",
          layer: "domain",
          imports: ['from "./unknown"'],
          resolvedImports: [null],
          importLocations: [{ line: 1, column: 0 }],
        }),
      ],
      layers: ["domain"],
      edges: [],
    };

    const config = makeConfig({
      edges: { deny: ["domain→infrastructure"] },
    });

    const violations = hexLayerDirection.check({ graph, config });
    expect(violations).toHaveLength(0);
  });

  it("fires multiple violations for multiple forbidden edges", () => {
    const graph: LayerGraph = {
      nodes: [
        makeNode({
          filePath: "/src/domain/order.ts",
          layer: "domain",
          imports: [
            'from "../infrastructure/db"',
            'from "../interface-adapters/http"',
          ],
          resolvedImports: [
            "/src/infrastructure/db.ts",
            "/src/interface-adapters/http.ts",
          ],
          importLocations: [{ line: 1, column: 0 }, { line: 2, column: 0 }],
        }),
        makeNode({
          filePath: "/src/infrastructure/db.ts",
          layer: "infrastructure",
        }),
        makeNode({
          filePath: "/src/interface-adapters/http.ts",
          layer: "interface-adapters",
        }),
      ],
      layers: ["domain", "infrastructure", "interface-adapters"],
      edges: [
        { from: "domain", to: "infrastructure" },
        { from: "domain", to: "interface-adapters" },
      ],
    };

    const config = makeConfig({
      edges: {
        deny: ["domain→infrastructure", "domain→interface-adapters"],
      },
    });

    const violations = hexLayerDirection.check({ graph, config });
    expect(violations).toHaveLength(2);
  });

  it("works through the RuleEngine", () => {
    const engine = new RuleEngine();
    engine.register(hexLayerDirection);

    const graph: LayerGraph = {
      nodes: [
        makeNode({
          filePath: "/src/domain/order.ts",
          layer: "domain",
          imports: ['from "../infrastructure/db"'],
          resolvedImports: ["/src/infrastructure/db.ts"],
          importLocations: [{ line: 1, column: 0 }],
        }),
        makeNode({
          filePath: "/src/infrastructure/db.ts",
          layer: "infrastructure",
        }),
      ],
      layers: ["domain", "infrastructure"],
      edges: [{ from: "domain", to: "infrastructure" }],
    };

    const config = makeConfig({
      edges: { deny: ["domain→infrastructure"] },
    });

    const violations = engine.run(graph, config);
    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe("hex/layer-direction");
  });
});
