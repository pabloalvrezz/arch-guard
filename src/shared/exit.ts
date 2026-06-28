/**
 * Exit codes for arch-guard CLI.
 * REQ-CLI-002: 0 = clean, 1 = violations found, 2 = fatal error.
 */
export enum ExitCode {
  /** No violations found */
  Clean = 0,
  /** Violations found */
  Violations = 1,
  /** Fatal error (config, parse, internal) */
  Fatal = 2,
}
