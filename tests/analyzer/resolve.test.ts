import { describe, it, expect } from "bun:test";
import * as path from "node:path";
import {
  resolveSpecifier,
  parseTsConfigPaths,
  resolveImports,
} from "../../src/analyzer/resolve";
import type { ImportRecord } from "../../src/analyzer/imports";

const FIXTURES_DIR = path.join(__dirname, "..", "fixtures");

describe("resolveSpecifier", () => {
  const aliases = parseTsConfigPaths({
    "@/*": ["src/*"],
  });

  it("resolves tsconfig.paths alias to absolute path", () => {
    const fromFile = path.join(FIXTURES_DIR, "hex-good", "src", "app.ts");
    const rootDir = path.join(FIXTURES_DIR, "hex-good");
    const resolved = resolveSpecifier("@/domain/order", fromFile, aliases, rootDir);
    expect(resolved).toBe(
      path.join(FIXTURES_DIR, "hex-good", "src", "domain", "order.ts")
    );
  });

  it("resolves relative import to absolute path", () => {
    const fromFile = path.join(FIXTURES_DIR, "hex-good", "src", "app.ts");
    const resolved = resolveSpecifier("./infra/db", fromFile, aliases);
    expect(resolved).toBe(
      path.join(FIXTURES_DIR, "hex-good", "src", "infra", "db.ts")
    );
  });

  it("resolves relative import with extension", () => {
    const fromFile = path.join(FIXTURES_DIR, "hex-good", "src", "app.ts");
    const resolved = resolveSpecifier("./infra/db.ts", fromFile, aliases);
    expect(resolved).toBe(
      path.join(FIXTURES_DIR, "hex-good", "src", "infra", "db.ts")
    );
  });

  it("returns null for unresolvable alias", () => {
    const fromFile = path.join(FIXTURES_DIR, "hex-good", "src", "app.ts");
    const resolved = resolveSpecifier("@/nonexistent/file", fromFile, aliases);
    expect(resolved).toBeNull();
  });

  it("returns null for bare specifiers (node_modules)", () => {
    const fromFile = path.join(FIXTURES_DIR, "hex-good", "src", "app.ts");
    const resolved = resolveSpecifier("react", fromFile, aliases);
    expect(resolved).toBeNull();
  });

  it("resolves directory with index file", () => {
    // Create a temp directory structure for this test
    const fs = require("node:fs");
    const os = require("node:os");
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "archguard-resolve-"));
    const srcDir = path.join(tmpDir, "src");
    fs.mkdirSync(srcDir, { recursive: true });
    fs.writeFileSync(path.join(srcDir, "index.ts"), "export {}");
    fs.writeFileSync(path.join(srcDir, "app.ts"), "export {}");

    const fromFile = path.join(tmpDir, "src", "app.ts");
    const resolved = resolveSpecifier("./", fromFile, []);
    // Should resolve to src/index.ts
    expect(resolved).toBe(path.join(srcDir, "index.ts"));

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});

describe("parseTsConfigPaths", () => {
  it("converts paths record to PathAlias array", () => {
    const paths = parseTsConfigPaths({
      "@/*": ["src/*"],
      "@lib/*": ["libs/*", "packages/*"],
    });
    expect(paths).toHaveLength(2);

    const atAlias = paths.find((p) => p.alias === "@/*");
    expect(atAlias).toBeDefined();
    expect(atAlias!.paths).toEqual(["src/*"]);

    const libAlias = paths.find((p) => p.alias === "@lib/*");
    expect(libAlias).toBeDefined();
    expect(libAlias!.paths).toEqual(["libs/*", "packages/*"]);
  });

  it("handles empty paths", () => {
    const paths = parseTsConfigPaths({});
    expect(paths).toHaveLength(0);
  });
});

describe("resolveImports", () => {
  const aliases = parseTsConfigPaths({
    "@/*": ["src/*"],
  });

  it("resolves a batch of imports from a file", () => {
    const fromFile = path.join(FIXTURES_DIR, "hex-good", "src", "app.ts");
    const imports: ImportRecord[] = [
      { specifier: "./infra/db", isTypeOnly: false, isDynamic: false, isReExport: false, line: 1, column: 0 },
      { specifier: "./infra/logger", isTypeOnly: false, isDynamic: false, isReExport: false, line: 2, column: 0 },
    ];

    const results = resolveImports(imports, fromFile, aliases);
    expect(results).toHaveLength(2);
    expect(results[0].resolved).toBe(
      path.join(FIXTURES_DIR, "hex-good", "src", "infra", "db.ts")
    );
    expect(results[1].resolved).toBe(
      path.join(FIXTURES_DIR, "hex-good", "src", "infra", "logger.ts")
    );
  });

  it("returns null for unresolvable imports", () => {
    const fromFile = path.join(FIXTURES_DIR, "hex-good", "src", "app.ts");
    const imports: ImportRecord[] = [
      { specifier: "react", isTypeOnly: false, isDynamic: false, isReExport: false, line: 1, column: 0 },
      { specifier: "./infra/db", isTypeOnly: false, isDynamic: false, isReExport: false, line: 2, column: 0 },
    ];

    const results = resolveImports(imports, fromFile, aliases);
    expect(results[0].resolved).toBeNull();
    expect(results[1].resolved).not.toBeNull();
  });
});
