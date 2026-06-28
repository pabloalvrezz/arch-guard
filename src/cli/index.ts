#!/usr/bin/env node

import { Command } from "commander";
import { ExitCode } from "../shared/exit";

const program = new Command();

program
  .name("arch-guard")
  .description(
    "Statically enforce hexagonal and clean architecture boundaries in TS/JS codebases"
  )
  .version("0.1.0");

// --- check subcommand ---
program
  .command("check")
  .description("Scan source files for architecture violations")
  .argument("<path>", "directory or file to scan")
  .option("--format <mode>", "output format: human | json (default: auto-detect TTY)", "auto")
  .option("--config <path>", "path to config file (default: auto-discover)")
  .option("--quiet", "suppress per-violation lines; summary only on stderr")
  .option("--staged", "scan only git-staged files (for pre-commit hooks)")
  .action((_path: string, _opts: Record<string, unknown>) => {
    // Stub — implemented in PR 6 (reporter) + PR 3 (analyzer)
    console.log("arch-guard check — not yet implemented");
    process.exit(ExitCode.Clean);
  });

// --- install-hook subcommand ---
program
  .command("install-hook")
  .description("Install a git pre-commit hook that runs arch-guard")
  .option("--scope <hook>", "hook type: pre-commit | pre-push", "pre-commit")
  .option("--dry-run", "print the planned hook content without writing")
  .action((_opts: Record<string, unknown>) => {
    // Stub — implemented in PR 7 (hook installer)
    console.log("arch-guard install-hook — not yet implemented");
    process.exit(ExitCode.Clean);
  });

// --- uninstall-hook subcommand ---
program
  .command("uninstall-hook")
  .description("Remove the arch-guard git hook and restore any backup")
  .action(() => {
    // Stub — implemented in PR 7 (hook installer)
    console.log("arch-guard uninstall-hook — not yet implemented");
    process.exit(ExitCode.Clean);
  });

// Handle unknown commands → exit 2 (REQ-CLI-006)
// exitOverride() makes commander throw instead of calling process.exit(),
// so we catch and map specific error codes to exit behaviors.
program.exitOverride();

try {
  program.parse();
} catch (err) {
  if (err instanceof Error && "code" in err) {
    const cmdErr = err as { code: string; message: string };

    // --help and --version: commander already printed output, exit clean
    if (cmdErr.code === "commander.helpDisplayed" || cmdErr.code === "commander.version") {
      process.exit(ExitCode.Clean);
    }

    // Unknown command → exit 2 (REQ-CLI-006)
    if (cmdErr.code === "commander.unknownCommand") {
      process.stderr.write(`error: unknown command '${cmdErr.message}'\n`);
      process.exit(ExitCode.Fatal);
    }
  }
  // Unexpected error — rethrow
  throw err;
}
