/**
 * Minimal glob matching.
 * Supports: *, **, and literal characters.
 *
 * Extracted shared helper used by both engine.ts and no-cross-glob.ts.
 */
export function matchGlob(pattern: string, value: string): boolean {
  const normalized = value.replace(/^\/+/, "");
  const regexStr = pattern
    .replace(/\./g, "\\.")
    .replace(/\*\*/g, "{{GLOBSTAR}}")
    .replace(/\*/g, "[^/]*")
    .replace(/\{\{GLOBSTAR\}\}/g, ".*");
  const regex = new RegExp(`^${regexStr}$`);
  return regex.test(normalized);
}
