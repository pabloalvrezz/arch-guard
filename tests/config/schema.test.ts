import { describe, it, expect } from "bun:test";
import { validateConfig } from "../../src/config/schema";

describe("validateConfig", () => {
  it("returns no errors for a valid minimal config", () => {
    const errors = validateConfig({ version: 1 });
    expect(errors).toHaveLength(0);
  });

  it("returns no errors for a fully valid config", () => {
    const doc = {
      version: 1,
      preset: "hex",
      layers: {
        domain: { path: "src/domain/**" },
        infra: { path: "src/infra/**" },
      },
      edges: {
        deny: ["domain→infra"],
        allow: ["infra→domain"],
      },
      rules: {
        "hex/layer-direction": {
          severity: "warn",
          ignore: ["src/legacy/**"],
          enforceTypeOnly: true,
        },
      },
      typeOnly: "enforce",
      exclude: ["node_modules/**", "dist/**"],
    };
    const errors = validateConfig(doc);
    expect(errors).toHaveLength(0);
  });

  it("rejects non-object config", () => {
    const errors = validateConfig("not an object");
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].path).toBe("");
    expect(errors[0].message).toContain("must be an object");
  });

  it("rejects invalid version", () => {
    const errors = validateConfig({ version: 2 });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].path).toBe("version");
  });

  it("rejects invalid preset", () => {
    const errors = validateConfig({ version: 1, preset: "invalid" });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].path).toBe("preset");
  });

  it("accepts preset null", () => {
    const errors = validateConfig({ version: 1, preset: null });
    expect(errors).toHaveLength(0);
  });

  it("rejects layers not a map", () => {
    const errors = validateConfig({ version: 1, layers: "notamap" });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].path).toBe("layers");
    expect(errors[0].message).toContain("must be a map");
  });

  it("rejects layer without path string", () => {
    const errors = validateConfig({
      version: 1,
      layers: { domain: { path: 123 } },
    });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].path).toBe("layers.domain.path");
  });

  it("rejects edges not an object", () => {
    const errors = validateConfig({ version: 1, edges: "notanobj" });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].path).toBe("edges");
  });

  it("rejects edges.allow not an array", () => {
    const errors = validateConfig({ version: 1, edges: { allow: "single" } });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].path).toBe("edges.allow");
  });

  it("rejects non-string items in edges.deny", () => {
    const errors = validateConfig({ version: 1, edges: { deny: [123] } });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].path).toBe("edges.deny[0]");
  });

  it("rejects rules not an object", () => {
    const errors = validateConfig({ version: 1, rules: ["not", "an", "object"] });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].path).toBe("rules");
  });

  it("rejects rule with invalid severity", () => {
    const errors = validateConfig({
      version: 1,
      rules: { "hex/layer-direction": { severity: "critical" } },
    });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].path).toBe("rules.hex/layer-direction.severity");
  });

  it("rejects rule.ignore not an array", () => {
    const errors = validateConfig({
      version: 1,
      rules: { "hex/layer-direction": { ignore: "pattern" } },
    });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].path).toBe("rules.hex/layer-direction.ignore");
  });

  it("rejects rule.enforceTypeOnly not a boolean", () => {
    const errors = validateConfig({
      version: 1,
      rules: { "hex/layer-direction": { enforceTypeOnly: "yes" } },
    });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].path).toBe("rules.hex/layer-direction.enforceTypeOnly");
  });

  it("rejects typeOnly with invalid value", () => {
    const errors = validateConfig({ version: 1, typeOnly: "always" });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].path).toBe("typeOnly");
  });

  it("rejects exclude not an array", () => {
    const errors = validateConfig({ version: 1, exclude: "pattern" });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].path).toBe("exclude");
  });

  it("rejects non-string items in exclude", () => {
    const errors = validateConfig({ version: 1, exclude: [123, true] });
    expect(errors.length).toBe(2);
    expect(errors[0].path).toBe("exclude[0]");
    expect(errors[1].path).toBe("exclude[1]");
  });

  it("collects multiple errors", () => {
    const errors = validateConfig({
      version: 2,
      preset: "bad",
      layers: "nope",
      edges: 42,
    });
    expect(errors.length).toBeGreaterThanOrEqual(4);
  });
});
