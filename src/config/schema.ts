import type {
  ConfigDocument,
  ConfigValidationError,
  PresetOption,
  RuleConfig,
  TypeOnlyMode,
} from "./types";

/**
 * JSON Schema definition for ConfigDocument (version 1).
 * Used for structural validation of parsed config files.
 */
const CONFIG_SCHEMA_VERSION = 1;

/**
 * Validate a parsed config document against the schema.
 * Returns an array of validation errors. Empty array = valid.
 *
 * REQ-CFG-003: on validation error, print field path + message.
 */
export function validateConfig(doc: unknown): ConfigValidationError[] {
  const errors: ConfigValidationError[] = [];

  if (doc === null || doc === undefined || typeof doc !== "object") {
    errors.push({ path: "", message: "config must be an object" });
    return errors;
  }

  const raw = doc as Record<string, unknown>;

  // --- version field ---
  if (raw.version !== undefined) {
    if (typeof raw.version !== "number" || raw.version !== CONFIG_SCHEMA_VERSION) {
      errors.push({
        path: "version",
        message: `version must be ${CONFIG_SCHEMA_VERSION}, got ${String(raw.version)}`,
      });
    }
  }

  // --- preset ---
  if (raw.preset !== undefined) {
    const preset = raw.preset as unknown;
    if (preset !== null && preset !== "hex" && preset !== "clean") {
      errors.push({
        path: "preset",
        message: `preset must be "hex", "clean", or null, got ${JSON.stringify(preset)}`,
      });
    }
  }

  // --- layers ---
  if (raw.layers !== undefined) {
    if (typeof raw.layers !== "object" || Array.isArray(raw.layers)) {
      errors.push({ path: "layers", message: "layers must be a map" });
    } else {
      const layers = raw.layers as Record<string, unknown>;
      for (const [name, def] of Object.entries(layers)) {
        if (typeof def !== "object" || def === null || Array.isArray(def)) {
          errors.push({
            path: `layers.${name}`,
            message: `layer "${name}" must be an object with a "path" field`,
          });
        } else {
          const layerDef = def as Record<string, unknown>;
          if (typeof layerDef.path !== "string") {
            errors.push({
              path: `layers.${name}.path`,
              message: `layer "${name}" must have a string "path" field`,
            });
          }
        }
      }
    }
  }

  // --- edges ---
  if (raw.edges !== undefined) {
    if (typeof raw.edges !== "object" || raw.edges === null || Array.isArray(raw.edges)) {
      errors.push({ path: "edges", message: "edges must be an object" });
    } else {
      const edges = raw.edges as Record<string, unknown>;
      for (const key of ["allow", "deny"]) {
        if (edges[key] !== undefined) {
          if (!Array.isArray(edges[key])) {
            errors.push({ path: `edges.${key}`, message: `edges.${key} must be an array` });
          } else {
            for (const [i, item] of (edges[key] as unknown[]).entries()) {
              if (typeof item !== "string") {
                errors.push({
                  path: `edges.${key}[${i}]`,
                  message: `edges.${key}[${i}] must be a string`,
                });
              }
            }
          }
        }
      }
    }
  }

  // --- rules ---
  if (raw.rules !== undefined) {
    if (typeof raw.rules !== "object" || raw.rules === null || Array.isArray(raw.rules)) {
      errors.push({ path: "rules", message: "rules must be an object" });
    } else {
      const rules = raw.rules as Record<string, unknown>;
      for (const [name, ruleCfg] of Object.entries(rules)) {
        if (typeof ruleCfg !== "object" || ruleCfg === null || Array.isArray(ruleCfg)) {
          errors.push({
            path: `rules.${name}`,
            message: `rule "${name}" must be an object`,
          });
        } else {
          validateRuleConfig(`rules.${name}`, ruleCfg as Record<string, unknown>, errors);
        }
      }
    }
  }

  // --- typeOnly ---
  if (raw.typeOnly !== undefined) {
    if (raw.typeOnly !== "ignore" && raw.typeOnly !== "enforce") {
      errors.push({
        path: "typeOnly",
        message: `typeOnly must be "ignore" or "enforce", got ${JSON.stringify(raw.typeOnly)}`,
      });
    }
  }

  // --- exclude ---
  if (raw.exclude !== undefined) {
    if (!Array.isArray(raw.exclude)) {
      errors.push({ path: "exclude", message: "exclude must be an array" });
    } else {
      for (const [i, item] of (raw.exclude as unknown[]).entries()) {
        if (typeof item !== "string") {
          errors.push({
            path: `exclude[${i}]`,
            message: `exclude[${i}] must be a string`,
          });
        }
      }
    }
  }

  return errors;
}

/**
 * Validate a single rule config entry.
 */
function validateRuleConfig(
  basePath: string,
  rule: Record<string, unknown>,
  errors: ConfigValidationError[]
): void {
  if (rule.severity !== undefined && rule.severity !== "error" && rule.severity !== "warn") {
    errors.push({
      path: `${basePath}.severity`,
      message: `severity must be "error" or "warn"`,
    });
  }

  if (rule.ignore !== undefined) {
    if (!Array.isArray(rule.ignore)) {
      errors.push({ path: `${basePath}.ignore`, message: "ignore must be an array" });
    }
  }

  if (rule.enforceTypeOnly !== undefined && typeof rule.enforceTypeOnly !== "boolean") {
    errors.push({
      path: `${basePath}.enforceTypeOnly`,
      message: "enforceTypeOnly must be a boolean",
    });
  }

  if (rule.globs !== undefined) {
    if (!Array.isArray(rule.globs)) {
      errors.push({ path: `${basePath}.globs`, message: "globs must be an array" });
    }
  }
}

/**
 * Reconstruct a ConfigDocument from a validated raw object.
 * This is the type-safe "parse" step after structural validation.
 */
export function parseConfig(doc: unknown): ConfigDocument | null {
  if (doc === null || doc === undefined || typeof doc !== "object") {
    return null;
  }
  const raw = doc as Record<string, unknown>;
  const result: ConfigDocument = {};

  if (raw.version !== undefined) result.version = raw.version as number;
  if (raw.preset !== undefined) result.preset = raw.preset as PresetOption;
  if (raw.layers !== undefined) result.layers = raw.layers as ConfigDocument["layers"];
  if (raw.edges !== undefined) result.edges = raw.edges as ConfigDocument["edges"];
  if (raw.rules !== undefined) result.rules = raw.rules as Record<string, RuleConfig>;
  if (raw.typeOnly !== undefined) result.typeOnly = raw.typeOnly as TypeOnlyMode;
  if (raw.exclude !== undefined) result.exclude = raw.exclude as string[];

  return result;
}
