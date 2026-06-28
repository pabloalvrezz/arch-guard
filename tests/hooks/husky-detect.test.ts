import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { detectHusky, resolveHookDir } from "../../src/hooks/husky-detect";

const TMP = join(import.meta.dir, "__tmp_husky_detect");

beforeEach(() => {
  rmSync(TMP, { recursive: true, force: true });
  mkdirSync(TMP, { recursive: true });
});

afterEach(() => {
  rmSync(TMP, { recursive: true, force: true });
});

describe("detectHusky", () => {
  it("returns false when .husky/ does not exist", () => {
    expect(detectHusky(TMP)).toBe(false);
  });

  it("returns true when .husky/ has hook files", () => {
    const huskyDir = join(TMP, ".husky");
    mkdirSync(huskyDir);
    writeFileSync(join(huskyDir, "pre-commit"), "#!/bin/sh\necho hook\n");
    expect(detectHusky(TMP)).toBe(true);
  });

  it("returns false when .husky/ only has package.json", () => {
    const huskyDir = join(TMP, ".husky");
    mkdirSync(huskyDir);
    writeFileSync(join(huskyDir, "package.json"), "{}");
    expect(detectHusky(TMP)).toBe(false);
  });

  it("returns false when .husky/ only has README.md", () => {
    const huskyDir = join(TMP, ".husky");
    mkdirSync(huskyDir);
    writeFileSync(join(huskyDir, "README.md"), "# Husky\n");
    expect(detectHusky(TMP)).toBe(false);
  });

  it("ignores _/ internal directory", () => {
    const huskyDir = join(TMP, ".husky");
    const internalDir = join(huskyDir, "_");
    mkdirSync(internalDir, { recursive: true });
    writeFileSync(join(internalDir, "husky.sh"), "#!/bin/sh\n");
    // No real hook files — only internal
    expect(detectHusky(TMP)).toBe(false);
  });

  it("detects .sh extension hooks", () => {
    const huskyDir = join(TMP, ".husky");
    mkdirSync(huskyDir);
    writeFileSync(join(huskyDir, "pre-commit.sh"), "#!/bin/sh\n");
    expect(detectHusky(TMP)).toBe(true);
  });
});

describe("resolveHookDir", () => {
  it("returns .husky/ when husky is detected", () => {
    expect(resolveHookDir(TMP, true)).toBe(join(TMP, ".husky"));
  });

  it("returns .git/hooks/ for bare git", () => {
    expect(resolveHookDir(TMP, false)).toBe(join(TMP, ".git", "hooks"));
  });
});
