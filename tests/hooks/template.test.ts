import { describe, it, expect } from "bun:test";
import { getHookTemplate } from "../../src/hooks/template";

describe("getHookTemplate", () => {
  it("returns a POSIX-shell pre-commit hook", () => {
    const hook = getHookTemplate("pre-commit");
    expect(hook).toContain("#!/bin/sh");
    expect(hook).toContain("arch-guard check --staged");
    expect(hook).toContain("exit $?");
  });

  it("returns a POSIX-shell pre-push hook", () => {
    const hook = getHookTemplate("pre-push");
    expect(hook).toContain("#!/bin/sh");
    expect(hook).toContain("arch-guard check .");
    expect(hook).toContain("exit $?");
  });

  it("pre-commit hook blocks on exit code", () => {
    const hook = getHookTemplate("pre-commit");
    // REQ-HOK-007: blocks commit on exit 1
    expect(hook).toContain("exit $?");
  });

  it("pre-push hook blocks on exit code", () => {
    const hook = getHookTemplate("pre-push");
    expect(hook).toContain("exit $?");
  });
});
