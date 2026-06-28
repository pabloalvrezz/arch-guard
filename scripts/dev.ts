#!/usr/bin/env bun

/**
 * Development script — runs the CLI directly from source.
 *
 * Usage: bun run scripts/dev.ts check ./src
 *        bun run scripts/dev.ts --help
 */

import { $ } from "bun";

const args = process.argv.slice(2);
await $`bun run src/cli/index.ts ${args}`;
