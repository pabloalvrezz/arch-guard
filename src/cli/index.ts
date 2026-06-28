#!/usr/bin/env node

import * as fs from "node:fs";
import * as path from "node:path";
import { Command } from "commander";
import { ExitCode } from "../shared/exit";
import { ArchGuardError } from "../shared/errors";
import { discoverConfig, loadConfig, resolveDefaults } from "../config";
import type { ResolvedConfig } from "../config";
import { initProject, createDefaultProject } from "../analyzer";
import { buildLayerGraph } from "../analyzer/graph";
import {
  RuleEngine,
  hexLayerDirection,
  cleanDependencyRule,
  sharedNoCircular,
  sharedNoCrossGlob,
} from "../rules";
import type { Violation } from "../rules";
import { sortViolations } from "../reporter";
import { renderHuman } from "../reporter/human";
import { renderJSON, buildSummary } from "../reporter/json";
import { installHook } from "../hooks/install";
import { uninstallHook } from "../hooks/uninstall";

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
  .option("--format <mode>", "output format: human | json (default: auto-detect TTY)")
  .option("--config <path>", "path to config file (default: auto-discover)")
  .option("--quiet", "suppress per-violation lines; summary only on stderr")
  .option("--staged", "scan only git-staged files (for pre-commit hooks)")
  .action(async (targetPath: string, opts: Record<string, unknown>) => {
    try {
      const format = resolveFormat(opts.format as string);
      const isTTY = process.stdout.isTTY ?? false;
      const quiet = Boolean(opts.quiet);
      const staged = Boolean(opts.staged);

      // 1. Resolve config
      const config = resolveConfig(targetPath, opts.config as string | undefined);

      // 2. Collect source files
      let sourceFilePaths: string[];
      if (staged) {
        sourceFilePaths = getStagedFiles();
        if (sourceFilePaths.length === 0) {
          outputResult([], format, isTTY, quiet, path.resolve(targetPath));
          return;
        }
      } else {
        sourceFilePaths = collectSourceFiles(path.resolve(targetPath));
      }

      if (sourceFilePaths.length === 0) {
        outputResult([], format, isTTY, quiet, path.resolve(targetPath));
        return;
      }

      // 3. Init analyzer project
      const project = initProject(path.resolve(targetPath)) ?? createDefaultProject();

      // Add source files to the project if they aren't already tracked
      for (const filePath of sourceFilePaths) {
        project.addSourceFileAtPath(filePath);
      }

      const sourceFiles = project.getSourceFiles().filter((sf) =>
        sourceFilePaths.includes(sf.getFilePath())
      );

      // 4. Build layer graph
      const graph = buildLayerGraph(sourceFiles, config, project);

      // 5. Register rules based on config presets
      const engine = new RuleEngine();
      if (config.presets.includes("hex")) {
        engine.register(hexLayerDirection);
      }
      if (config.presets.includes("clean")) {
        engine.register(cleanDependencyRule);
      }
      engine.register(sharedNoCircular);
      engine.register(sharedNoCrossGlob);

      // 6. Run rules
      const violations = engine.run(graph, config);

      // 7. Output
      const sorted = sortViolations(violations);
      outputResult(sorted, format, isTTY, quiet, path.resolve(targetPath));
    } catch (err) {
      if (err instanceof ArchGuardError) {
        process.stderr.write(`error: ${err.message}\n`);
        process.exit(err.code);
      }
      throw err;
    }
  });

// --- install-hook subcommand ---
program
  .command("install-hook")
  .description("Install a git pre-commit hook that runs arch-guard")
  .option("--scope <hook>", "hook type: pre-commit | pre-push", "pre-commit")
  .option("--dry-run", "print the planned hook content without writing")
  .action((opts: Record<string, unknown>) => {
    try {
      const projectRoot = findProjectRoot();
      const result = installHook({
        projectRoot,
        scope: (opts.scope as "pre-commit" | "pre-push") ?? "pre-commit",
        dryRun: Boolean(opts.dryRun),
      });

      if (result.dryRun) {
        process.stdout.write(`dry-run: would install hook at ${result.hookPath}\n`);
        if (result.huskyDetected) {
          process.stdout.write("  husky detected — installing to .husky/\n");
        }
        if (result.backedUp) {
          process.stdout.write(`  would backup existing hook to ${result.backupPath}\n`);
        }
      } else {
        process.stdout.write(`installed: ${result.hookPath}\n`);
        if (result.huskyDetected) {
          process.stdout.write("  husky detected — installed to .husky/\n");
        }
        if (result.backedUp) {
          process.stdout.write(`  backed up existing hook to ${result.backupPath}\n`);
        }
      }

      process.exit(ExitCode.Clean);
    } catch (err) {
      if (err instanceof ArchGuardError) {
        process.stderr.write(`error: ${err.message}\n`);
        process.exit(err.code);
      }
      throw err;
    }
  });

// --- uninstall-hook subcommand ---
program
  .command("uninstall-hook")
  .description("Remove the arch-guard git hook and restore any backup")
  .action(() => {
    try {
      const projectRoot = findProjectRoot();
      const result = uninstallHook({ projectRoot });

      if (result.restoredBackup) {
        process.stdout.write(`restored: ${result.backupPath} → ${result.hookPath}\n`);
      } else {
        process.stdout.write(`removed: ${result.hookPath}\n`);
      }

      process.exit(ExitCode.Clean);
    } catch (err) {
      if (err instanceof ArchGuardError) {
        process.stderr.write(`error: ${err.message}\n`);
        process.exit(err.code);
      }
      throw err;
    }
  });

// Handle unknown commands → exit 2 (REQ-CLI-006)
program.exitOverride();

try {
  program.parse();
} catch (err) {
  if (err instanceof Error && "code" in err) {
    const cmdErr = err as { code: string; message: string };

    if (cmdErr.code === "commander.helpDisplayed" || cmdErr.code === "commander.version") {
      process.exit(ExitCode.Clean);
    }

    if (cmdErr.code === "commander.unknownCommand") {
      process.stderr.write(`error: unknown command '${cmdErr.message}'\n`);
      process.exit(ExitCode.Fatal);
    }
  }
  throw err;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

type OutputFormat = "human" | "json";

function resolveFormat(raw: string | undefined): OutputFormat {
  if (raw === "json") return "json";
  if (raw === "human") return "human";
  // "auto" or undefined → detect TTY
  return process.stdout.isTTY ? "human" : "json";
}

function resolveConfig(targetPath: string, configPath?: string): ResolvedConfig {
  let discovered = null;

  if (configPath) {
    const ext = path.extname(configPath);
    const format = ext === ".toml" ? "toml" : ext === ".yaml" ? "yaml" : "yml";
    discovered = { path: path.resolve(configPath), format: format as "yml" | "yaml" | "toml" };
  } else {
    discovered = discoverConfig(path.resolve(targetPath));
  }

  if (discovered) {
    const doc = loadConfig(discovered);
    const resolved = resolveDefaults(doc);
    resolved.configPath = discovered.path;
    return resolved;
  }

  return resolveDefaults(null);
}

function getStagedFiles(): string[] {
  const result = Bun.spawnSync(
    ["git", "diff", "--cached", "--name-only", "--diff-filter=ACM"],
    { cwd: process.cwd(), stdout: "pipe", stderr: "pipe" }
  );

  if (result.exitCode !== 0) {
    return [];
  }

  const output = result.stdout.toString().trim();
  if (!output) return [];

  return output
    .split("\n")
    .filter((f) => /\.(ts|tsx|js|jsx|mts|cts|mjs|cjs)$/.test(f))
    .map((f) => path.resolve(process.cwd(), f));
}

function collectSourceFiles(dirPath: string): string[] {
  const extensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mts", ".cts"]);
  const results: string[] = [];

  function walk(currentDir: string) {
    let entries: string[];
    try {
      entries = fs.readdirSync(currentDir);
    } catch {
      return;
    }

    for (const entry of entries) {
      if (entry === "node_modules" || entry === ".git" || entry === "dist") continue;
      if (entry.startsWith(".")) continue;

      const fullPath = path.join(currentDir, entry);
      let stat: fs.Stats;
      try {
        stat = fs.statSync(fullPath);
      } catch {
        continue;
      }

      if (stat.isDirectory()) {
        walk(fullPath);
      } else if (extensions.has(path.extname(entry))) {
        results.push(fullPath);
      }
    }
  }

  walk(dirPath);
  return results;
}

function outputResult(
  violations: Violation[],
  format: OutputFormat,
  isTTY: boolean,
  quiet: boolean,
  projectRoot?: string
) {
  if (format === "json") {
    const report = renderJSON(violations, quiet);
    process.stdout.write(JSON.stringify(report, null, 2) + "\n");
  } else {
    const summary = buildSummary(violations);
    const output = renderHuman(
      { violations, summary },
      { isTTY, quiet, projectRoot }
    );
    process.stdout.write(output + "\n");
  }

  process.exit(violations.length > 0 ? ExitCode.Violations : ExitCode.Clean);
}

function findProjectRoot(): string {
  let current = process.cwd();
  const root = path.parse(current).root;

  while (current !== root) {
    if (
      fs.existsSync(path.join(current, "package.json")) ||
      fs.existsSync(path.join(current, ".git"))
    ) {
      return current;
    }
    current = path.dirname(current);
  }

  return process.cwd();
}
