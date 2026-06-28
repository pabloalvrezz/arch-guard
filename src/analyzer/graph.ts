import * as path from "node:path";
import type { SourceFile } from "ts-morph";
import type { ResolvedConfig, LayerDef } from "../config/types";
import { extractImports } from "./imports";
import {
  resolveSpecifier,
  parseTsConfigPaths,
  type PathAlias,
} from "./resolve";
import { getCompilerPaths, type initProject } from "./project";
import picomatch from "picomatch";

/**
 * A node in the directed layer graph.
 */
export interface GraphNode {
  /** Absolute path of the source file */
  filePath: string;
  /** Layer name this file belongs to (null if no layer matches) */
  layer: string | null;
  /** Raw import specifiers */
  imports: string[];
  /** Resolved absolute paths of imports (null = unresolvable) */
  resolvedImports: (string | null)[];
  /** Line numbers of imports */
  importLines: number[];
}

/**
 * The full directed layer graph.
 */
export interface LayerGraph {
  /** All source files that were analyzed */
  nodes: GraphNode[];
  /** Unique layer names discovered */
  layers: string[];
  /** Adjacency: which layers import from which layers */
  edges: Array<{ from: string; to: string }>;
}

/**
 * Build a directed layer graph from a set of source files.
 *
 * REQ-ANL-004: directed layer graph: file → layer (by glob match) → imported files.
 * REQ-ANL-005: per-file parse errors → warning, continue scan.
 *
 * @param sourceFiles — array of ts-morph SourceFile instances
 * @param config — resolved config with layer definitions
 * @param project — ts-morph Project (for compiler paths)
 * @returns the LayerGraph
 */
export function buildLayerGraph(
  sourceFiles: SourceFile[],
  config: ResolvedConfig,
  project?: ReturnType<typeof import("./project").initProject> extends infer T
    ? T
    : never
): LayerGraph {
  // Parse path aliases from tsconfig
  let aliases: PathAlias[] = [];
  let rootDir: string | undefined;
  if (project) {
    const compilerPaths = getCompilerPaths(project);
    aliases = parseTsConfigPaths(compilerPaths);
    // Derive rootDir from the project's tsconfig location
    const tsconfigPath = project.getCompilerOptions().configFilePath;
    if (typeof tsconfigPath === "string") {
      rootDir = path.dirname(tsconfigPath);
    }
  }

  const nodes: GraphNode[] = [];
  const layerSet = new Set<string>();
  const edgeSet = new Set<string>();

  for (const sourceFile of sourceFiles) {
    const filePath = sourceFile.getFilePath();
    const layer = matchLayer(filePath, config.layers);

    try {
      const imports = extractImports(sourceFile);
      const resolvedImports: (string | null)[] = [];
      const importSpecifiers: string[] = [];
      const importLines: number[] = [];

      for (const imp of imports) {
        importSpecifiers.push(imp.specifier);
        importLines.push(imp.line);

        if (imp.isDynamic && imp.specifier) {
          // Dynamic import — resolve directly
          const resolved = resolveSpecifier(imp.specifier, filePath, aliases, rootDir);
          resolvedImports.push(resolved);
        } else if (imp.isReExport) {
          // Re-export — resolve for attribution
          const resolved = resolveSpecifier(imp.specifier, filePath, aliases, rootDir);
          resolvedImports.push(resolved);
        } else {
          // Static import
          const resolved = resolveSpecifier(imp.specifier, filePath, aliases, rootDir);
          resolvedImports.push(resolved);
        }
      }

      nodes.push({
        filePath,
        layer,
        imports: importSpecifiers,
        resolvedImports,
        importLines,
      });

      // Build edges between layers
      if (layer !== null) {
        layerSet.add(layer);
      }

      for (const resolved of resolvedImports) {
        if (resolved !== null) {
          const importedLayer = matchLayer(resolved, config.layers);
          if (importedLayer !== null) {
            layerSet.add(importedLayer);
            if (layer !== null && layer !== importedLayer) {
              const edgeKey = `${layer}→${importedLayer}`;
              edgeSet.add(edgeKey);
            }
          }
        }
      }
    } catch (err) {
      // REQ-ANL-005: per-file parse errors → warning, continue scan
      console.warn(
        `[arch-guard] warning: failed to analyze ${filePath}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  // Parse edge strings back into objects
  const edges = Array.from(edgeSet).map((e) => {
    const [from, to] = e.split("→");
    return { from, to };
  });

  return {
    nodes,
    layers: Array.from(layerSet).sort(),
    edges,
  };
}

/**
 * Match a file path against layer glob patterns.
 * Returns the first matching layer name, or null if no match.
 */
function matchLayer(
  filePath: string,
  layers: Record<string, LayerDef>
): string | null {
  // Normalize path separators for matching
  const normalizedPath = filePath.replace(/\\/g, "/");

  for (const [name, def] of Object.entries(layers)) {
    const globPattern = def.path.replace(/\\/g, "/");
    const isMatch = picomatch(globPattern);
    if (isMatch(normalizedPath)) {
      return name;
    }
  }

  return null;
}
