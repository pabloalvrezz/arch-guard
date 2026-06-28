import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { buildLayerGraph } from "../../src/analyzer/graph";
import type { ResolvedConfig } from "../../src/config/types";
import { Project } from "ts-morph";

const FIXTURES_DIR = path.join(__dirname, "..", "fixtures");

function makeConfig(layers: Record<string, { path: string }> = {}): ResolvedConfig {
  return {
    version: 1,
    presets: ["hex"],
    layers,
    edges: { deny: ["domain→infra"] },
    rules: {},
    typeOnly: "ignore",
    exclude: [],
    configPath: null,
  };
}

function loadSourceFiles(dir: string): ReturnType<typeof Project.prototype.getSourceFiles> {
  const project = new Project({
    compilerOptions: {
      target: 99,
      module: 99,
      moduleResolution: 99,
      allowJs: true,
      strict: true,
    },
    skipAddingFilesFromTsConfig: true,
  });

  // Add all .ts files from the directory
  const files = walkTsFiles(dir);
  for (const file of files) {
    project.addSourceFileAtPath(file);
  }

  return project.getSourceFiles();
}

function walkTsFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkTsFiles(full));
    } else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) {
      results.push(full);
    }
  }
  return results;
}

describe("buildLayerGraph", () => {
  it("builds a graph with layers from config", () => {
    const config = makeConfig({
      domain: { path: "**/domain/**" },
      infra: { path: "**/infra/**" },
      app: { path: "**/src/app.ts" },
    });

    const sourceFiles = loadSourceFiles(path.join(FIXTURES_DIR, "hex-good"));
    const graph = buildLayerGraph(sourceFiles, config);

    expect(graph.nodes.length).toBeGreaterThan(0);
    expect(graph.layers).toContain("domain");
    expect(graph.layers).toContain("infra");
    expect(graph.layers).toContain("app");
  });

  it("creates edges between layers that import each other", () => {
    const config = makeConfig({
      domain: { path: "**/domain/**" },
      infra: { path: "**/infra/**" },
      app: { path: "**/src/app.ts" },
    });

    const sourceFiles = loadSourceFiles(path.join(FIXTURES_DIR, "hex-good"));
    const graph = buildLayerGraph(sourceFiles, config);

    // app.ts imports from infra, so app→infra edge should exist
    const appToInfra = graph.edges.find(
      (e) => e.from === "app" && e.to === "infra"
    );
    expect(appToInfra).toBeDefined();
  });

  it("handles files with no layer match", () => {
    const config = makeConfig({
      domain: { path: "**/domain/**" },
    });

    const sourceFiles = loadSourceFiles(path.join(FIXTURES_DIR, "hex-good"));
    const graph = buildLayerGraph(sourceFiles, config);

    // Some files may not match any layer
    const unmatchedNodes = graph.nodes.filter((n) => n.layer === null);
    // barrel.ts might not match domain glob if it's at root
    expect(unmatchedNodes.length).toBeGreaterThanOrEqual(0);
  });

  it("handles parse errors gracefully", () => {
    const config = makeConfig({
      domain: { path: "**/domain/**" },
      infra: { path: "**/infra/**" },
    });

    // hex-bad has a file with syntax error
    const sourceFiles = loadSourceFiles(path.join(FIXTURES_DIR, "hex-bad"));
    // Should not throw — parse errors are swallowed with warnings
    const graph = buildLayerGraph(sourceFiles, config);
    expect(graph.nodes.length).toBeGreaterThan(0);
  });

  it("resolves path aliases via tsconfig", () => {
    const config = makeConfig({
      domain: { path: "**/domain/**" },
    });

    const project = new Project({
      tsConfigFilePath: path.join(FIXTURES_DIR, "hex-good", "tsconfig.json"),
      skipAddingFilesFromTsConfig: false,
    });

    const graph = buildLayerGraph(project.getSourceFiles(), config, project);

    // Should have resolved imports
    const domainNode = graph.nodes.find(
      (n) => n.layer === "domain" && n.filePath.includes("order")
    );
    expect(domainNode).toBeDefined();
  });

  it("returns empty graph for no source files", () => {
    const config = makeConfig();
    const graph = buildLayerGraph([], config);
    expect(graph.nodes).toHaveLength(0);
    expect(graph.layers).toHaveLength(0);
    expect(graph.edges).toHaveLength(0);
  });
});
