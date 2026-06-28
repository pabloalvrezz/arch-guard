import { describe, it, expect } from "bun:test";
import { sortViolations } from "../../src/reporter/sort";
import type { Violation } from "../../src/rules/types";

function v(overrides: Partial<Violation> = {}): Violation {
  return {
    rule: "hex/layer-direction",
    severity: "error",
    file: "/src/domain/foo.ts",
    line: 10,
    column: 5,
    reason: "domain imports infra",
    ...overrides,
  };
}

describe("sortViolations", () => {
  it("returns empty array for empty input", () => {
    expect(sortViolations([])).toEqual([]);
  });

  it("preserves single-element order", () => {
    const input = [v({ file: "/a.ts", line: 1 })];
    expect(sortViolations(input)).toEqual(input);
  });

  it("sorts by file first (lexicographic)", () => {
    const input = [
      v({ file: "/src/b.ts", line: 1 }),
      v({ file: "/src/a.ts", line: 1 }),
    ];
    const sorted = sortViolations(input);
    expect(sorted[0].file).toBe("/src/a.ts");
    expect(sorted[1].file).toBe("/src/b.ts");
  });

  it("sorts by line within same file", () => {
    const input = [
      v({ file: "/src/a.ts", line: 20 }),
      v({ file: "/src/a.ts", line: 5 }),
    ];
    const sorted = sortViolations(input);
    expect(sorted[0].line).toBe(5);
    expect(sorted[1].line).toBe(20);
  });

  it("sorts by column within same file and line", () => {
    const input = [
      v({ file: "/src/a.ts", line: 10, column: 15 }),
      v({ file: "/src/a.ts", line: 10, column: 3 }),
    ];
    const sorted = sortViolations(input);
    expect(sorted[0].column).toBe(3);
    expect(sorted[1].column).toBe(15);
  });

  it("sorts multiple violations deterministically", () => {
    const input = [
      v({ file: "/src/domain/b.ts", line: 15 }),
      v({ file: "/src/infra/a.ts", line: 1 }),
      v({ file: "/src/domain/a.ts", line: 10 }),
      v({ file: "/src/domain/b.ts", line: 5 }),
    ];
    const sorted = sortViolations(input);
    expect(sorted.map((s) => `${s.file}:${s.line}`)).toEqual([
      "/src/domain/a.ts:10",
      "/src/domain/b.ts:5",
      "/src/domain/b.ts:15",
      "/src/infra/a.ts:1",
    ]);
  });

  it("does not mutate the original array", () => {
    const input = [v({ line: 20 }), v({ line: 5 })];
    const original = [...input];
    sortViolations(input);
    expect(input).toEqual(original);
  });
});
