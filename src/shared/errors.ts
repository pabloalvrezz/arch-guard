import { ExitCode } from "./exit";

/**
 * Base error class for arch-guard.
 * All domain errors extend this so the CLI can catch and map to ExitCode.Fatal.
 */
export class ArchGuardError extends Error {
  readonly code: ExitCode;

  constructor(message: string, code: ExitCode = ExitCode.Fatal) {
    super(message);
    this.name = "ArchGuardError";
    this.code = code;
  }
}

/**
 * Configuration-related error (bad file, invalid schema).
 */
export class ConfigError extends ArchGuardError {
  constructor(message: string) {
    super(message, ExitCode.Fatal);
    this.name = "ConfigError";
  }
}

/**
 * Analyzer error (parse failure, unresolvable path).
 */
export class AnalyzerError extends ArchGuardError {
  constructor(message: string) {
    super(message, ExitCode.Fatal);
    this.name = "AnalyzerError";
  }
}
