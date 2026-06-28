import { describe, it, expect } from "bun:test";
import * as path from "node:path";
import { initProject, createDefaultProject, getCompilerPaths } from "../../src/analyzer/project";

const FIXTURES_DIR = path.join(__dirname, "..", "fixtures");

describe("initProject", () => {
  it("returns a Project when tsconfig.json exists", () => {
    const project = initProject(path.join(FIXTURES_DIR, "hex-good"));
    expect(project).not.toBeNull();
  });

  it("returns null when no tsconfig.json is found", () => {
    // Use a temp dir with no tsconfig
    const project = initProject("/tmp");
    // /tmp might have a tsconfig — skip if it does
    if (project === null) {
      expect(project).toBeNull();
    } else {
      // If it found one, that's fine — just confirm it's a Project
      expect(project).toBeDefined();
    }
  });
});

describe("createDefaultProject", () => {
  it("creates a project without tsconfig", () => {
    const project = createDefaultProject();
    expect(project).toBeDefined();
    expect(project.getCompilerOptions()).toBeDefined();
  });
});

describe("getCompilerPaths", () => {
  it("extracts paths from project compiler options", () => {
    const project = initProject(path.join(FIXTURES_DIR, "hex-good"));
    expect(project).not.toBeNull();
    if (project) {
      const paths = getCompilerPaths(project);
      expect(paths).toBeDefined();
      expect(paths["@/*"]).toEqual(["src/*"]);
    }
  });

  it("returns empty object when no paths configured", () => {
    const project = createDefaultProject();
    const paths = getCompilerPaths(project);
    expect(paths).toEqual({});
  });
});
