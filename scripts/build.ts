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

console.log(`Build successful → ${result.outputs.length} file(s)`);
