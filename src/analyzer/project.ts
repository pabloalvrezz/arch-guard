import { Project, type ProjectOptions } from "ts-morph";
import * as path from "node:path";
import * as fs from "node:fs";

/**
 * Initialize a ts-morph Project from the nearest tsconfig.json.
 *
 * REQ-ANL-001: MUST initialize from nearest tsconfig.json; skip if absent.
 *
 * @param rootDir — directory to start searching upward from
 * @returns ts-morph Project instance, or null if no tsconfig found
 */
export function initProject(rootDir: string): Project | null {
  const tsconfigPath = findTsConfig(rootDir);
  if (tsconfigPath === null) {
    return null;
  }

  return new Project({
    tsConfigFilePath: tsconfigPath,
    skipAddingFilesFromTsConfig: false,
  });
}

/**
 * Create a ts-morph Project with default settings (no tsconfig).
 * Useful for scanning files without a tsconfig.json.
 */
export function createDefaultProject(): Project {
  return new Project({
    compilerOptions: {
      target: 99, // ESNext
      module: 99, // ESNext
      moduleResolution: 99, // Bundler
      allowJs: true,
      strict: true,
    },
    skipAddingFilesFromTsConfig: true,
  });
}

/**
 * Find the nearest tsconfig.json by walking upward from the given directory.
 */
function findTsConfig(startDir: string): string | null {
  let current = path.resolve(startDir);
  const root = path.parse(current).root;

  while (current !== root) {
    const candidate = path.join(current, "tsconfig.json");
    if (fs.existsSync(candidate)) {
      return candidate;
    }
    current = path.dirname(current);
  }

  // Also check root
  const rootCandidate = path.join(root, "tsconfig.json");
  if (fs.existsSync(rootCandidate)) {
    return rootCandidate;
  }

  return null;
}

/**
 * Get the compiler options from a ts-morph project, including paths.
 */
export function getCompilerPaths(project: Project): Record<string, string[]> {
  const compilerOptions = project.getCompilerOptions();
  const paths = compilerOptions.paths ?? {};
  return paths as Record<string, string[]>;
}
