import { describe, it, expect } from "bun:test";
import * as path from "node:path";
import { Project } from "ts-morph";
import { extractImports } from "../../src/analyzer/imports";

function createSourceFile(code: string, filename = "test.ts") {
  const project = new Project({
    useInMemoryFileSystem: true,
    compilerOptions: {
      target: 99,
      module: 99,
      moduleResolution: 99,
    },
  });
  return project.createSourceFile(filename, code);
}

describe("extractImports", () => {
  it("extracts static imports", () => {
    const sf = createSourceFile(`import { foo } from "./bar";`);
    const imports = extractImports(sf);
    expect(imports).toHaveLength(1);
    expect(imports[0].specifier).toBe("./bar");
    expect(imports[0].isTypeOnly).toBe(false);
    expect(imports[0].isDynamic).toBe(false);
    expect(imports[0].isReExport).toBe(false);
  });

  it("extracts type-only imports", () => {
    const sf = createSourceFile(`import type { Foo } from "./types";`);
    const imports = extractImports(sf);
    expect(imports).toHaveLength(1);
    expect(imports[0].specifier).toBe("./types");
    expect(imports[0].isTypeOnly).toBe(true);
  });

  it("extracts default imports", () => {
    const sf = createSourceFile(`import React from "react";`);
    const imports = extractImports(sf);
    expect(imports).toHaveLength(1);
    expect(imports[0].specifier).toBe("react");
  });

  it("extracts side-effect imports", () => {
    const sf = createSourceFile(`import "./polyfill";`);
    const imports = extractImports(sf);
    expect(imports).toHaveLength(1);
    expect(imports[0].specifier).toBe("./polyfill");
  });

  it("extracts dynamic imports with string literal", () => {
    const sf = createSourceFile(`const mod = import("./lazy");`);
    const imports = extractImports(sf);
    expect(imports).toHaveLength(1);
    expect(imports[0].specifier).toBe("./lazy");
    expect(imports[0].isDynamic).toBe(true);
    expect(imports[0].isTypeOnly).toBe(false);
  });

  it("skips dynamic imports with non-literal args", () => {
    const sf = createSourceFile(`const mod = import(variable);`);
    const imports = extractImports(sf);
    expect(imports).toHaveLength(0);
  });

  it("extracts re-exports", () => {
    const sf = createSourceFile(`export { foo } from "./bar";`);
    const imports = extractImports(sf);
    expect(imports).toHaveLength(1);
    expect(imports[0].specifier).toBe("./bar");
    expect(imports[0].isReExport).toBe(true);
  });

  it("extracts type-only re-exports", () => {
    const sf = createSourceFile(`export type { Foo } from "./types";`);
    const imports = extractImports(sf);
    expect(imports).toHaveLength(1);
    expect(imports[0].specifier).toBe("./types");
    expect(imports[0].isTypeOnly).toBe(true);
    expect(imports[0].isReExport).toBe(true);
  });

  it("extracts star re-exports", () => {
    const sf = createSourceFile(`export * from "./bar";`);
    const imports = extractImports(sf);
    expect(imports).toHaveLength(1);
    expect(imports[0].specifier).toBe("./bar");
    expect(imports[0].isReExport).toBe(true);
  });

  it("returns empty array for files with no imports", () => {
    const sf = createSourceFile(`export const x = 42;`);
    const imports = extractImports(sf);
    expect(imports).toHaveLength(0);
  });

  it("extracts multiple imports from a single file", () => {
    const sf = createSourceFile(`
      import { a } from "./a";
      import type { B } from "./b";
      const c = import("./c");
      export { d } from "./d";
    `);
    const imports = extractImports(sf);
    expect(imports).toHaveLength(4);
    expect(imports.map((i) => i.specifier)).toEqual(["./a", "./b", "./d", "./c"]);
  });

  it("records line and column numbers", () => {
    const sf = createSourceFile(`import { x } from "./foo";`);
    const imports = extractImports(sf);
    expect(imports[0].line).toBe(1);
    expect(imports[0].column).toBeGreaterThanOrEqual(0);
  });
});
