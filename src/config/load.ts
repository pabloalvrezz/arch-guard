import * as fs from "node:fs";
import * as path from "node:path";
import YAML from "yaml";
import TOML from "@iarna/toml";
import { ConfigError } from "../shared/errors";
import type { ConfigDocument, DiscoveredConfig } from "./types";
import { validateConfig, parseConfig } from "./schema";

/**
 * Load and validate a config file.
 *
 * REQ-CFG-002: parse YAML/TOML; on parse error, exit 2 with `config: <file>:<line>`.
 * REQ-CFG-003: validate against schema; on validation error, print field path + message.
 *
 * @throws {ConfigError} with exit code 2 on parse or validation failure
 */
export function loadConfig(discovered: DiscoveredConfig): ConfigDocument {
  const content = readFileSync(discovered.path);

  let raw: unknown;
  try {
    raw = parseFile(content, discovered);
  } catch (err) {
    const line = extractErrorLine(err);
    throw new ConfigError(
      `config: ${discovered.path}:${line} — ${extractErrorMessage(err)}`
    );
  }

  const errors = validateConfig(raw);
  if (errors.length > 0) {
    const formatted = errors
      .map((e) => `  ${e.path || "(root)"}: ${e.message}`)
      .join("\n");
    throw new ConfigError(
      `config: ${discovered.path} — validation failed:\n${formatted}`
    );
  }

  const doc = parseConfig(raw);
  if (doc === null) {
    throw new ConfigError(`config: ${discovered.path} — failed to parse config document`);
  }

  return doc;
}

/**
 * Read file contents synchronously.
 */
function readFileSync(filePath: string): string {
  try {
    return fs.readFileSync(filePath, "utf-8");
  } catch (err) {
    throw new ConfigError(`config: cannot read ${filePath} — ${(err as Error).message}`);
  }
}

/**
 * Parse file content based on format.
 */
function parseFile(
  content: string,
  discovered: DiscoveredConfig
): unknown {
  switch (discovered.format) {
    case "yml":
    case "yaml":
      return parseYAML(content, discovered.path);
    case "toml":
      return parseTOML(content, discovered.path);
    default:
      throw new ConfigError(`config: unsupported format "${discovered.format}"`);
  }
}

/**
 * Parse YAML content with line error tracking.
 */
function parseYAML(content: string, filePath: string): unknown {
  try {
    return YAML.parse(content);
  } catch (err) {
    // YAML parse errors include line info
    const yamlErr = err as { line?: number; message?: string; name?: string };
    const line = yamlErr.line ?? 1;
    const message = yamlErr.message ?? "YAML parse error";
    throw new Error(`${filePath}:${line}: ${message}`);
  }
}

/**
 * Parse TOML content with error wrapping.
 */
function parseTOML(content: string, filePath: string): unknown {
  try {
    return TOML.parse(content);
  } catch (err) {
    // @iarna/toml parse errors may include line info
    const tomlErr = err as { line?: number; message?: string };
    const line = tomlErr.line ?? 1;
    const message = tomlErr.message ?? "TOML parse error";
    throw new Error(`${filePath}:${line}: ${message}`);
  }
}

/**
 * Extract line number from an error message that may contain "file:line: ..." format.
 */
function extractErrorLine(err: unknown): number {
  if (err instanceof Error) {
    const match = err.message.match(/:(\d+):/);
    if (match) return parseInt(match[1], 10);
  }
  return 1;
}

/**
 * Extract clean error message from a parse error.
 */
function extractErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    // Strip file:line prefix if present
    const msg = err.message;
    const colonIdx = msg.indexOf(":");
    if (colonIdx !== -1) {
      const afterFile = msg.slice(colonIdx + 1);
      const secondColon = afterFile.indexOf(":");
      if (secondColon !== -1) {
        return afterFile.slice(secondColon + 1).trim();
      }
    }
    return msg;
  }
  return String(err);
}
