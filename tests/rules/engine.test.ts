import { describe, it, expect } from "bun:test";
import { RuleEngine } from "../../src/rules/engine";
import type { Rule, RuleContext, Violation } from "../../src/rules/types";
import type { LayerGraph } from "../../src/analyzer/graph";
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

function makeGraph(overrides: Partial<LayerGraph> = {}): LayerGraph {
  return {
    nodes: [],
    layers: [],
    edges: [],
    ...overrides,
  };
}

function createMockRule(
  id: string,
  violations: Violation[]
): Rule {
  return {
    id,
    defaultSeverity: "error",
    check: () => violations,
  };
}

describe("RuleEngine", () => {
  it("registers and runs a single rule", () => {
    const engine = new RuleEngine();
    const violation: Violation = {
      rule: "test/rule",
      severity: "error",
      file: "/src/domain/foo.ts",
      line: 1,
      column: 1,
      reason: "test violation",
    };
    engine.register(createMockRule("test/rule", [violation]));

    const result = engine.run(makeGraph(), makeConfig());
    expect(result).toHaveLength(1);
    expect(result[0].rule).toBe("test/rule");
  });

  it("runs multiple rules and collects all violations", () => {
    const engine = new RuleEngine();
    const v1: Violation = {
      rule: "rule-a",
      severity: "error",
      file: "/src/a.ts",
      line: 1,
      column: 1,
      reason: "violation a",
    };
    const v2: Violation = {
      rule: "rule-b",
      severity: "warn",
      file: "/src/b.ts",
      line: 5,
      column: 3,
      reason: "violation b",
    };
    engine.register(createMockRule("rule-a", [v1]));
    engine.register(createMockRule("rule-b", [v2]));

    const result = engine.run(makeGraph(), makeConfig());
    expect(result).toHaveLength(2);
    expect(result.map((v) => v.rule)).toEqual(["rule-a", "rule-b"]);
  });

  it("deduplicates violations by rule+file+line+column", () => {
    const engine = new RuleEngine();
    const violation: Violation = {
      rule: "test/rule",
      severity: "error",
      file: "/src/foo.ts",
      line: 10,
      column: 1,
      reason: "duplicate",
    };
    engine.register(createMockRule("test/rule", [violation, violation]));

    const result = engine.run(makeGraph(), makeConfig());
    expect(result).toHaveLength(1);
  });

  it("applies severity override from config", () => {
    const engine = new RuleEngine();
    const violation: Violation = {
      rule: "test/rule",
      severity: "error",
      file: "/src/foo.ts",
      line: 1,
      column: 1,
      reason: "test",
    };
    engine.register(createMockRule("test/rule", [violation]));

    const config = makeConfig({
      rules: { "test/rule": { severity: "warn" } },
    });
    const result = engine.run(makeGraph(), config);
    expect(result[0].severity).toBe("warn");
  });

  it("respects default severity when no override", () => {
    const engine = new RuleEngine();
    const violation: Violation = {
      rule: "test/rule",
      severity: "warn",
      file: "/src/foo.ts",
      line: 1,
      column: 1,
      reason: "test",
    };
    engine.register(createMockRule("test/rule", [violation]));

    const result = engine.run(makeGraph(), makeConfig());
    expect(result[0].severity).toBe("warn");
  });

  it("filters violations matching ignore globs", () => {
    const engine = new RuleEngine();
    const v1: Violation = {
      rule: "test/rule",
      severity: "error",
      file: "/src/domain/legacy/foo.ts",
      line: 1,
      column: 1,
      reason: "ignored",
    };
    const v2: Violation = {
      rule: "test/rule",
      severity: "error",
      file: "/src/domain/order.ts",
      line: 1,
      column: 1,
      reason: "not ignored",
    };
    engine.register(createMockRule("test/rule", [v1, v2]));

    const config = makeConfig({
      rules: { "test/rule": { ignore: ["**/domain/legacy/**"] } },
    });
    const result = engine.run(makeGraph(), config);
    expect(result).toHaveLength(1);
    expect(result[0].file).toBe("/src/domain/order.ts");
  });

  it("returns empty array when no rules registered", () => {
    const engine = new RuleEngine();
    const result = engine.run(makeGraph(), makeConfig());
    expect(result).toHaveLength(0);
  });

  it("returns empty array when graph has no nodes and rule checks graph", () => {
    const engine = new RuleEngine();
    const graphAwareRule: Rule = {
      id: "test/rule",
      defaultSeverity: "error",
      check: (ctx) => {
        // Only returns violations when graph has nodes
        if (ctx.graph.nodes.length === 0) return [];
        return [
          {
            rule: "test/rule",
            severity: "error",
            file: "/src/foo.ts",
            line: 1,
            column: 1,
            reason: "test",
          },
        ];
      },
    };
    engine.register(graphAwareRule);

    const result = engine.run(makeGraph({ nodes: [] }), makeConfig());
    expect(result).toHaveLength(0);
  });
});
