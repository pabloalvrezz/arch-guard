import { describe, it, expect } from "bun:test";
import { renderHuman } from "../../src/reporter/human";
import type { HumanReport, ReporterOptions } from "../../src/reporter/types";
import type { Violation } from "../../src/rules/types";

function makeReport(violations: Violation[] = []): HumanReport {
  const bySeverity: Record<string, number> = { error: 0, warn: 0 };
  const byRule: Record<string, number> = {};
  let worstSeverity: "error" | "warn" | null = null;

  for (const v of violations) {
    bySeverity[v.severity] = (bySeverity[v.severity] ?? 0) + 1;
    byRule[v.rule] = (byRule[v.rule] ?? 0) + 1;
    if (v.severity === "error") worstSeverity = "error";
    else if (worstSeverity !== "error") worstSeverity = "warn";
  }

  return {
    violations,
    summary: {
      total: violations.length,
      bySeverity: bySeverity as Record<"error" | "warn", number>,
      byRule,
      worstSeverity,
    },
  };
}

const ttyOpts: ReporterOptions = { isTTY: true, quiet: false };
const pipeOpts: ReporterOptions = { isTTY: false, quiet: false };
const quietOpts: ReporterOptions = { isTTY: true, quiet: true };

describe("renderHuman", () => {
  it("shows '0 violations' for clean scan (TTY)", () => {
    const output = renderHuman(makeReport([]), ttyOpts);
    expect(output).toContain("0 violations");
  });

  it("shows '0 violations' for clean scan (piped)", () => {
    const output = renderHuman(makeReport([]), pipeOpts);
    expect(output).toContain("0 violations");
  });

  it("renders violation line in file:line:column - rule - reason format", () => {
    const v: Violation = {
      rule: "hex/layer-direction",
      severity: "error",
      file: "/src/domain/order.ts",
      line: 3,
      column: 1,
      reason: "domain imports infra",
    };
    const output = renderHuman(makeReport([v]), pipeOpts);
    expect(output).toContain("/src/domain/order.ts:3:1 - hex/layer-direction - domain imports infra");
  });

  it("renders multiple violations (piped, no color codes)", () => {
    const violations: Violation[] = [
      { rule: "hex/layer-direction", severity: "error", file: "/a.ts", line: 1, column: 1, reason: "bad" },
      { rule: "clean/dependency-rule", severity: "warn", file: "/b.ts", line: 5, column: 2, reason: "also bad" },
    ];
    const output = renderHuman(makeReport(violations), pipeOpts);
    expect(output).toContain("/a.ts:1:1 - hex/layer-direction - bad");
    expect(output).toContain("/b.ts:5:2 - clean/dependency-rule - also bad");
  });

  it("includes per-severity counts in summary", () => {
    const violations: Violation[] = [
      { rule: "hex/layer-direction", severity: "error", file: "/a.ts", line: 1, column: 1, reason: "bad" },
      { rule: "hex/layer-direction", severity: "error", file: "/b.ts", line: 1, column: 1, reason: "bad" },
      { rule: "clean/dependency-rule", severity: "warn", file: "/c.ts", line: 1, column: 1, reason: "meh" },
    ];
    const output = renderHuman(makeReport(violations), pipeOpts);
    expect(output).toContain("3 violations");
    expect(output).toContain("2 errors");
    expect(output).toContain("1 warn");
  });

  it("includes per-rule counts in summary", () => {
    const violations: Violation[] = [
      { rule: "hex/layer-direction", severity: "error", file: "/a.ts", line: 1, column: 1, reason: "bad" },
      { rule: "clean/dependency-rule", severity: "warn", file: "/b.ts", line: 1, column: 1, reason: "meh" },
    ];
    const output = renderHuman(makeReport(violations), pipeOpts);
    expect(output).toContain("hex/layer-direction: 1");
    expect(output).toContain("clean/dependency-rule: 1");
  });

  it("suppresses violation lines in quiet mode", () => {
    const v: Violation = {
      rule: "hex/layer-direction",
      severity: "error",
      file: "/a.ts",
      line: 1,
      column: 1,
      reason: "bad",
    };
    const output = renderHuman(makeReport([v]), quietOpts);
    expect(output).not.toContain("/a.ts:1:1");
    expect(output).toContain("1 violation");
  });

  it("quiet mode still shows summary", () => {
    const output = renderHuman(makeReport([]), quietOpts);
    expect(output).toContain("0 violations");
  });
});
