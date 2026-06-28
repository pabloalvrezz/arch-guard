import { describe, it, expect } from "bun:test";
import { renderJSON, buildSummary } from "../../src/reporter/json";
import type { Violation } from "../../src/rules/types";

function makeViolations(): Violation[] {
  return [
    {
      rule: "hex/layer-direction",
      severity: "error",
      file: "/src/domain/order.ts",
      line: 3,
      column: 1,
      reason: "domain imports infra",
    },
    {
      rule: "clean/dependency-rule",
      severity: "warn",
      file: "/src/use-cases/create.ts",
      line: 7,
      column: 12,
      reason: "use-case imports framework",
    },
    {
      rule: "hex/layer-direction",
      severity: "error",
      file: "/src/domain/user.ts",
      line: 1,
      column: 5,
      reason: "domain imports infra",
    },
  ];
}

describe("renderJSON", () => {
  it("returns valid JSONReport with version 0.1.0", () => {
    const report = renderJSON(makeViolations());
    expect(report.version).toBe("0.1.0");
  });

  it("includes all violations", () => {
    const report = renderJSON(makeViolations());
    expect(report.violations).toHaveLength(3);
  });

  it("includes summary with correct total", () => {
    const report = renderJSON(makeViolations());
    expect(report.summary.total).toBe(3);
  });

  it("counts by severity correctly", () => {
    const report = renderJSON(makeViolations());
    expect(report.summary.bySeverity.error).toBe(2);
    expect(report.summary.bySeverity.warn).toBe(1);
  });

  it("counts by rule correctly", () => {
    const report = renderJSON(makeViolations());
    expect(report.summary.byRule["hex/layer-direction"]).toBe(2);
    expect(report.summary.byRule["clean/dependency-rule"]).toBe(1);
  });

  it("sets worstSeverity to error when errors exist", () => {
    const report = renderJSON(makeViolations());
    expect(report.summary.worstSeverity).toBe("error");
  });

  it("serializes to valid JSON string", () => {
    const report = renderJSON(makeViolations());
    const json = JSON.stringify(report);
    const parsed = JSON.parse(json);
    expect(parsed.version).toBe("0.1.0");
    expect(parsed.violations).toHaveLength(3);
  });

  it("handles empty violations array", () => {
    const report = renderJSON([]);
    expect(report.version).toBe("0.1.0");
    expect(report.summary.total).toBe(0);
    expect(report.summary.worstSeverity).toBeNull();
    expect(report.violations).toEqual([]);
  });
});

describe("buildSummary", () => {
  it("returns zeroed summary for empty input", () => {
    const summary = buildSummary([]);
    expect(summary.total).toBe(0);
    expect(summary.bySeverity.error).toBe(0);
    expect(summary.bySeverity.warn).toBe(0);
    expect(summary.worstSeverity).toBeNull();
  });

  it("sets worstSeverity to warn when only warns exist", () => {
    const violations: Violation[] = [
      {
        rule: "test/rule",
        severity: "warn",
        file: "/a.ts",
        line: 1,
        column: 1,
        reason: "test",
      },
    ];
    const summary = buildSummary(violations);
    expect(summary.worstSeverity).toBe("warn");
  });
});
