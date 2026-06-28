import { describe, it, expect } from "bun:test";
import { resolveDefaults, ZERO_CONFIG, DEFAULT_RESOLVED } from "../../src/config/defaults";
import type { ConfigDocument } from "../../src/config/types";

describe("resolveDefaults", () => {
  it("returns default resolved config when null", () => {
    const resolved = resolveDefaults(null);
    expect(resolved.version).toBe(1);
    expect(resolved.presets).toEqual(["hex", "clean"]);
    expect(resolved.layers).toEqual({});
    expect(resolved.edges).toEqual({});
    expect(resolved.rules).toEqual({});
    expect(resolved.typeOnly).toBe("ignore");
    expect(resolved.exclude).toEqual([]);
    expect(resolved.configPath).toBeNull();
  });

  it("returns both presets when preset is null (zero-config)", () => {
    const resolved = resolveDefaults(ZERO_CONFIG);
    expect(resolved.presets).toEqual(["hex", "clean"]);
  });

  it("returns single preset when preset is 'hex'", () => {
    const doc: ConfigDocument = { version: 1, preset: "hex" };
    const resolved = resolveDefaults(doc);
    expect(resolved.presets).toEqual(["hex"]);
  });

  it("returns single preset when preset is 'clean'", () => {
    const doc: ConfigDocument = { version: 1, preset: "clean" };
    const resolved = resolveDefaults(doc);
    expect(resolved.presets).toEqual(["clean"]);
  });

  it("preserves layers from config", () => {
    const doc: ConfigDocument = {
      version: 1,
      layers: {
        domain: { path: "src/domain/**" },
        infra: { path: "src/infra/**" },
      },
    };
    const resolved = resolveDefaults(doc);
    expect(resolved.layers).toEqual({
      domain: { path: "src/domain/**" },
      infra: { path: "src/infra/**" },
    });
  });

  it("preserves edges from config", () => {
    const doc: ConfigDocument = {
      version: 1,
      edges: { deny: ["domain→infra"] },
    };
    const resolved = resolveDefaults(doc);
    expect(resolved.edges).toEqual({ deny: ["domain→infra"] });
  });

  it("preserves rules from config", () => {
    const doc: ConfigDocument = {
      version: 1,
      rules: {
        "hex/layer-direction": { severity: "warn" },
      },
    };
    const resolved = resolveDefaults(doc);
    expect(resolved.rules["hex/layer-direction"]).toEqual({ severity: "warn" });
  });

  it("preserves typeOnly from config", () => {
    const doc: ConfigDocument = { version: 1, typeOnly: "enforce" };
    const resolved = resolveDefaults(doc);
    expect(resolved.typeOnly).toBe("enforce");
  });

  it("preserves exclude from config", () => {
    const doc: ConfigDocument = { version: 1, exclude: ["node_modules/**"] };
    const resolved = resolveDefaults(doc);
    expect(resolved.exclude).toEqual(["node_modules/**"]);
  });

  it("returns a copy, not the same reference", () => {
    const resolved1 = resolveDefaults(null);
    const resolved2 = resolveDefaults(null);
    expect(resolved1).not.toBe(resolved2);
    expect(resolved1).toEqual(resolved2);
  });
});

describe("DEFAULT_RESOLVED", () => {
  it("has version 1", () => {
    expect(DEFAULT_RESOLVED.version).toBe(1);
  });

  it("has both presets active", () => {
    expect(DEFAULT_RESOLVED.presets).toEqual(["hex", "clean"]);
  });
});
