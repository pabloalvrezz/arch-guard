import { describe, it, expect } from "bun:test";
import { cleanDependencyRule } from "../../src/rules/clean/dependency-rule";
import { RuleEngine } from "../../src/rules/engine";
import type { RuleContext } from "../../src/rules/types";
import type { LayerGraph, GraphNode } from "../../src/analyzer/graph";
import type { ResolvedConfig } from "../../src/config/types";

function makeConfig(overrides: Partial<ResolvedConfig> = {}): ResolvedConfig {
  return {
    version: 1,
    presets: ["clean"],
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

const CLEAN_DENY = [
  "entities→use-cases",
  "entities→interface-adapters",
  "entities→frameworks-drivers",
  "use-cases→interface-adapters",
  "use-cases→frameworks-drivers",
  "interface-adapters→frameworks-drivers",
];

describe("clean/dependency-rule", () => {
  it("fires when entities imports use-cases", () => {
    const graph: LayerGraph = {
      nodes: [
        makeNode({
          filePath: "/src/entities/order.ts",
          layer: "entities",
          imports: ['from "../use-cases/create-order"'],
          resolvedImports: ["/src/use-cases/create-order.ts"],
          importLocations: [{ line: 1, column: 0 }],
        }),
        makeNode({
          filePath: "/src/use-cases/create-order.ts",
          layer: "use-cases",
        }),
      ],
      layers: ["entities", "use-cases"],
      edges: [{ from: "entities", to: "use-cases" }],
    };

    const config = makeConfig({ edges: { deny: CLEAN_DENY } });
    const violations = cleanDependencyRule.check({ graph, config });

    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe("clean/dependency-rule");
    expect(violations[0].file).toBe("/src/entities/order.ts");
    expect(violations[0].reason).toContain("entities → use-cases");
  });

  it("fires when entities imports frameworks-drivers (deepest violation)", () => {
    const graph: LayerGraph = {
      nodes: [
        makeNode({
          filePath: "/src/entities/user.ts",
          layer: "entities",
          imports: ['from "../frameworks-drivers/config"'],
          resolvedImports: ["/src/frameworks-drivers/config.ts"],
          importLocations: [{ line: 3, column: 10 }],
        }),
        makeNode({
          filePath: "/src/frameworks-drivers/config.ts",
          layer: "frameworks-drivers",
        }),
      ],
      layers: ["entities", "frameworks-drivers"],
      edges: [{ from: "entities", to: "frameworks-drivers" }],
    };

    const config = makeConfig({ edges: { deny: CLEAN_DENY } });
    const violations = cleanDependencyRule.check({ graph, config });

    expect(violations).toHaveLength(1);
    expect(violations[0].line).toBe(3);
    expect(violations[0].column).toBe(10);
    expect(violations[0].reason).toContain("entities → frameworks-drivers");
  });

  it("fires when use-cases imports interface-adapters", () => {
    const graph: LayerGraph = {
      nodes: [
        makeNode({
          filePath: "/src/use-cases/create-order.ts",
          layer: "use-cases",
          imports: ['from "../interface-adapters/http"'],
          resolvedImports: ["/src/interface-adapters/http.ts"],
          importLocations: [{ line: 1, column: 0 }],
        }),
        makeNode({
          filePath: "/src/interface-adapters/http.ts",
          layer: "interface-adapters",
        }),
      ],
      layers: ["use-cases", "interface-adapters"],
      edges: [{ from: "use-cases", to: "interface-adapters" }],
    };

    const config = makeConfig({ edges: { deny: CLEAN_DENY } });
    const violations = cleanDependencyRule.check({ graph, config });

    expect(violations).toHaveLength(1);
    expect(violations[0].reason).toContain("use-cases → interface-adapters");
  });

  it("fires when interface-adapters imports frameworks-drivers", () => {
    const graph: LayerGraph = {
      nodes: [
        makeNode({
          filePath: "/src/interface-adapters/http.ts",
          layer: "interface-adapters",
          imports: ['from "../frameworks-drivers/express"'],
          resolvedImports: ["/src/frameworks-drivers/express.ts"],
          importLocations: [{ line: 1, column: 0 }],
        }),
        makeNode({
          filePath: "/src/frameworks-drivers/express.ts",
          layer: "frameworks-drivers",
        }),
      ],
      layers: ["interface-adapters", "frameworks-drivers"],
      edges: [{ from: "interface-adapters", to: "frameworks-drivers" }],
    };

    const config = makeConfig({ edges: { deny: CLEAN_DENY } });
    const violations = cleanDependencyRule.check({ graph, config });

    expect(violations).toHaveLength(1);
    expect(violations[0].reason).toContain("interface-adapters → frameworks-drivers");
  });

  it("does NOT fire when use-cases imports entities (allowed direction)", () => {
    const graph: LayerGraph = {
      nodes: [
        makeNode({
          filePath: "/src/use-cases/create-order.ts",
          layer: "use-cases",
          imports: ['from "../entities/order"'],
          resolvedImports: ["/src/entities/order.ts"],
          importLocations: [{ line: 1, column: 0 }],
        }),
        makeNode({
          filePath: "/src/entities/order.ts",
          layer: "entities",
        }),
      ],
      layers: ["entities", "use-cases"],
      edges: [{ from: "use-cases", to: "entities" }],
    };

    const config = makeConfig({ edges: { deny: CLEAN_DENY } });
    const violations = cleanDependencyRule.check({ graph, config });

    expect(violations).toHaveLength(0);
  });

  it("does NOT fire when frameworks-drivers imports interface-adapters (allowed)", () => {
    const graph: LayerGraph = {
      nodes: [
        makeNode({
          filePath: "/src/frameworks-drivers/express.ts",
          layer: "frameworks-drivers",
          imports: ['from "../interface-adapters/http"'],
          resolvedImports: ["/src/interface-adapters/http.ts"],
          importLocations: [{ line: 1, column: 0 }],
        }),
        makeNode({
          filePath: "/src/interface-adapters/http.ts",
          layer: "interface-adapters",
        }),
      ],
      layers: ["interface-adapters", "frameworks-drivers"],
      edges: [{ from: "frameworks-drivers", to: "interface-adapters" }],
    };

    const config = makeConfig({ edges: { deny: CLEAN_DENY } });
    const violations = cleanDependencyRule.check({ graph, config });

    expect(violations).toHaveLength(0);
  });

  it("does NOT fire for same-layer imports", () => {
    const graph: LayerGraph = {
      nodes: [
        makeNode({
          filePath: "/src/entities/order.ts",
          layer: "entities",
          imports: ['from "./user"'],
          resolvedImports: ["/src/entities/user.ts"],
          importLocations: [{ line: 1, column: 0 }],
        }),
        makeNode({
          filePath: "/src/entities/user.ts",
          layer: "entities",
        }),
      ],
      layers: ["entities"],
      edges: [],
    };

    const config = makeConfig({ edges: { deny: CLEAN_DENY } });
    const violations = cleanDependencyRule.check({ graph, config });

    expect(violations).toHaveLength(0);
  });

  it("works through the RuleEngine", () => {
    const engine = new RuleEngine();
    engine.register(cleanDependencyRule);

    const graph: LayerGraph = {
      nodes: [
        makeNode({
          filePath: "/src/entities/order.ts",
          layer: "entities",
          imports: ['from "../use-cases/create-order"'],
          resolvedImports: ["/src/use-cases/create-order.ts"],
          importLocations: [{ line: 1, column: 0 }],
        }),
        makeNode({
          filePath: "/src/use-cases/create-order.ts",
          layer: "use-cases",
        }),
      ],
      layers: ["entities", "use-cases"],
      edges: [{ from: "entities", to: "use-cases" }],
    };

    const config = makeConfig({ edges: { deny: CLEAN_DENY } });
    const violations = engine.run(graph, config);

    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe("clean/dependency-rule");
  });
});
