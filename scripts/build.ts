#!/usr/bin/env bun

/**
 * Build script for arch-guard.
 * Uses bun build with --target=node for dual runtime compatibility
 * (Bun primary, Node ≥18 compatible).
 *
 * Usage: bun run scripts/build.ts
 */

const result = await Bun.build({
  entrypoints: ["./src/cli/index.ts"],
  outdir: "./dist",
  target: "node",
  format: "esm",
  splitting: true,
  sourcemap: "none",
  minify: false,
});

if (!result.success) {
  console.error("Build failed:");
  for (const log of result.logs) {
    console.error(log);
  }
  process.exit(1);
}

// Rename index.js → cli.js for package.json bin entry
const { cpSync, rmSync } = await import("node:fs");
for (const output of result.outputs) {
  const src = output.path;
  const dest = src.replace("/index.js", "/cli.js");
  if (src !== dest) {
    cpSync(src, dest);
    rmSync(src);
    console.log(`  → ${dest}`);
  }
}

console.log(`Build successful → ${result.outputs.length} file(s)`);
