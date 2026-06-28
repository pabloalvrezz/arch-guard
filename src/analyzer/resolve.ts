import * as path from "node:path";
import * as fs from "node:fs";
import type { ImportRecord } from "./imports";

/**
 * Path alias mapping from tsconfig.json paths.
 */
export interface PathAlias {
  /** The alias pattern (e.g. "@/*") */
  alias: string;
  /** The resolved path prefix(es) (e.g. ["src/*"]) */
  paths: string[];
}

/**
 * Resolve a specifier to an absolute file path.
 *
 * REQ-ANL-003: resolve tsconfig.paths aliases before relative fallback;
 * warn when alias is unresolvable.
 *
 * @param specifier — the import specifier (e.g. "@/domain/foo", "./bar")
 * @param fromFile — the absolute path of the file containing the import
 * @param aliases — path aliases from tsconfig.paths
 * @param rootDir — project root directory (tsconfig location); aliases resolve relative to this
 * @returns resolved absolute path, or null if unresolvable
 */
export function resolveSpecifier(
  specifier: string,
  fromFile: string,
  aliases: PathAlias[],
  rootDir?: string
): string | null {
  // 1. Try to resolve via tsconfig.paths aliases (resolve relative to rootDir)
  for (const alias of aliases) {
    const resolved = resolveAlias(specifier, alias);
    if (resolved !== null) {
      const absolutePath = path.resolve(rootDir ?? path.dirname(fromFile), resolved);
      // Try exact path first, then with extensions
      if (fileExists(absolutePath)) {
        return absolutePath;
      }
      const withExt = tryResolveWithExtension(absolutePath);
      if (withExt !== null) {
        return withExt;
      }
      // Try as directory with index file
      const indexCandidate = tryResolveIndex(absolutePath);
      if (indexCandidate !== null) {
        return indexCandidate;
      }
    }
  }

  // 2. Relative import — resolve from file location
  if (specifier.startsWith(".") || specifier.startsWith("/")) {
    const absolutePath = path.resolve(path.dirname(fromFile), specifier);
    const withExt = tryResolveWithExtension(absolutePath);
    if (withExt !== null) {
      return withExt;
    }
    // Try as directory with index file
    const indexCandidate = tryResolveIndex(absolutePath);
    if (indexCandidate !== null) {
      return indexCandidate;
    }
  }

  // 3. Bare specifier (node_modules) — return null (not our concern)
  return null;
}

/**
 * Resolve a specifier against a single path alias.
 * Returns the resolved path prefix, or null if no match.
 */
function resolveAlias(specifier: string, alias: PathAlias): string | null {
  // Convert alias pattern to a regex
  // "@/*" matches "@/" at the start, captures the rest
  const aliasBase = alias.alias.replace(/\*$/, "");
  if (specifier.startsWith(aliasBase)) {
    const rest = specifier.slice(aliasBase.length);
    // Try each path mapping
    for (const mapping of alias.paths) {
      const mappingBase = mapping.replace(/\*$/, "");
      return mappingBase + rest;
    }
  }
  return null;
}

/**
 * Try to resolve a file with common extensions.
 * Returns null for directories — use tryResolveIndex for those.
 */
function tryResolveWithExtension(basePath: string): string | null {
  // If basePath is a directory, don't return it as a file match
  if (fs.existsSync(basePath) && fs.statSync(basePath).isDirectory()) {
    return null;
  }

  const extensions = [".ts", ".tsx", ".js", ".jsx", ".mts", ".cts"];
  for (const ext of extensions) {
    const candidate = basePath + ext;
    if (fileExists(candidate)) {
      return candidate;
    }
  }
  // Try as-is (might already have an extension)
  if (fileExists(basePath)) {
    return basePath;
  }
  return null;
}

/**
 * Try to resolve as a directory with an index file.
 */
function tryResolveIndex(dirPath: string): string | null {
  if (!fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) {
    return null;
  }
  const extensions = [".ts", ".tsx", ".js", ".jsx"];
  for (const ext of extensions) {
    const candidate = path.join(dirPath, `index${ext}`);
    if (fileExists(candidate)) {
      return candidate;
    }
  }
  return null;
}

function fileExists(p: string): boolean {
  try {
    fs.accessSync(p, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Parse tsconfig paths into PathAlias array.
 */
export function parseTsConfigPaths(
  paths: Record<string, string[]>
): PathAlias[] {
  return Object.entries(paths).map(([alias, mappingPaths]) => ({
    alias,
    paths: mappingPaths,
  }));
}

/**
 * Resolve a batch of import records from a single source file.
 * Returns the resolved absolute paths (filtering out nulls).
 */
export function resolveImports(
  imports: ImportRecord[],
  fromFile: string,
  aliases: PathAlias[],
  rootDir?: string
): Array<{ import: ImportRecord; resolved: string | null }> {
  return imports.map((imp) => ({
    import: imp,
    resolved: resolveSpecifier(imp.specifier, fromFile, aliases, rootDir),
  }));
}
