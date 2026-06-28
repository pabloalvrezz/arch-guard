import type { Violation } from "../rules/types";

/**
 * REQ-RPT-005: Deterministic output — sorted by file then line.
 *
 * Comparisons are lexicographic on file, numeric on line, numeric on column.
 * This guarantees byte-identical output across runs for the same input.
 */
export function sortViolations(violations: Violation[]): Violation[] {
  return [...violations].sort(compareViolations);
}

function compareViolations(a: Violation, b: Violation): number {
  const fileCmp = a.file.localeCompare(b.file);
  if (fileCmp !== 0) return fileCmp;

  const lineCmp = a.line - b.line;
  if (lineCmp !== 0) return lineCmp;

  return a.column - b.column;
}
