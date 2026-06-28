# arch-guard

Statically enforce hexagonal and clean architecture boundaries in TypeScript and JavaScript codebases.

arch-guard analyzes your project's import graph and reports violations of architectural layer rules — before they become technical debt.

## Quick Start

```bash
# Scan a directory with zero config (both hex + clean presets active)
bun x arch-guard check ./src

# Scan with JSON output
bun x arch-guard check ./src --format json

# Scan only staged files (for pre-commit hooks)
bun x arch-guard check --staged ./src
```

## Installation

```bash
# Bun
bun add -D arch-guard

# npm
npm install --save-dev arch-guard

# yarn
yarn add --dev arch-guard
```

## Configuration

arch-guard works out of the box with sensible defaults. Create an `.archguard.yml` file in your project root to customize:

```yaml
version: 1

# Active preset: "hex", "clean", or omit for both
preset: null

# Layer definitions — maps layer names to glob patterns
layers:
  domain:
    path: "**/domain/**"
  application:
    path: "**/application/**"
  interface-adapters:
    path: "**/interface-adapters/**"
  infrastructure:
    path: "**/infrastructure/**"

# Edge rules — allowed and denied dependency directions
edges:
  deny:
    - "domain→infrastructure"
    - "domain→interface-adapters"
    - "application→infrastructure"
    - "application→interface-adapters"

# Per-rule configuration
rules:
  hex/layer-direction:
    severity: error
    ignore:
      - "**/*.test.ts"
  shared/no-circular:
    severity: error

# Type-only import handling: "ignore" (default) or "enforce"
typeOnly: ignore

# Glob patterns to exclude from scanning
exclude:
  - "**/*.test.ts"
  - "**/*.spec.ts"
```

You can also use `.archguard.yaml` or `.archguard.toml`.

### Config Discovery

arch-guard walks upward from the scan path to the git root, looking for config files. The first match wins. You can also pass `--config <path>` to specify a config file explicitly.

## Rules

### Hexagonal Architecture (`hex/layer-direction`)

Enforces dependency direction in hexagonal architecture. Dependencies must flow inward:

```
infrastructure → application → domain
```

**Default denied edges:**
| From | To | Reason |
|------|-----|--------|
| domain | infrastructure | Domain must not depend on infrastructure |
| domain | interface-adapters | Domain must not depend on adapters |
| application | infrastructure | Application must not depend on infrastructure |
| application | interface-adapters | Application must not depend on adapters |

**Default layers:**
- `domain` — `**/domain/**`
- `application` — `**/application/**`
- `interface-adapters` — `**/interface-adapters/**`
- `infrastructure` — `**/infrastructure/**`

### Clean Architecture (`clean/dependency-rule`)

Enforces Uncle Bob's Dependency Rule: outer layers must never import inner layers.

```
frameworks-drivers → interface-adapters → use-cases → entities
```

**Default denied edges:**
| From | To | Reason |
|------|-----|--------|
| entities | use-cases | Entities must not import use-cases |
| entities | interface-adapters | Entities must not import adapters |
| entities | frameworks-drivers | Entities must not import frameworks |
| use-cases | interface-adapters | Use cases must not import adapters |
| use-cases | frameworks-drivers | Use cases must not import frameworks |
| interface-adapters | frameworks-drivers | Adapters must not import frameworks |

**Default layers:**
- `entities` — `**/entities/**`
- `use-cases` — `**/use-cases/**`
- `interface-adapters` — `**/interface-adapters/**`
- `frameworks-drivers` — `**/frameworks-drivers/**`

### Circular Dependencies (`shared/no-circular`)

Detects circular import chains across all layers. Reports every file involved in any cycle.

### Cross-Glob Imports (`shared/no-cross-glob`)

When configured with two or more glob patterns, reports imports that cross between different globs. Only active when explicitly configured in `rules.shared/no-cross-glob.globs`.

## Git Hooks

arch-guard can install git hooks that run automatically before each commit:

```bash
# Install pre-commit hook
arch-guard install-hook

# Install pre-push hook
arch-guard install-hook --scope pre-push

# Preview what would be installed
arch-guard install-hook --dry-run

# Remove the hook and restore any backup
arch-guard uninstall-hook
```

### Husky Support

If [Husky](https://typicode.github.io/husky/) is detected in your project, arch-guard installs hooks to `.husky/` instead of `.git/hooks/`.

## CLI Reference

```
arch-guard check <path> [options]

Arguments:
  path                  Directory or file to scan

Options:
  --format <mode>       Output format: human | json (default: auto-detect TTY)
  --config <path>       Path to config file (default: auto-discover)
  --quiet               Suppress per-violation lines; summary only on stderr
  --staged              Scan only git-staged files (for pre-commit hooks)
  --help                Display help for command

arch-guard install-hook [options]

Options:
  --scope <hook>        Hook type: pre-commit | pre-push (default: pre-commit)
  --dry-run             Print planned hook content without writing

arch-guard uninstall-hook

Options:
  --help                Display help for command
```

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Clean — no violations found |
| 1 | Violations found |
| 2 | Fatal error (config parse, invalid arguments) |

### Output

Human-friendly format showing violations grouped by severity, with relative paths and clear location info:

```text
  error  hex/layer-direction
           ./src/domain/order.ts:42:5
           Forbidden dependency: domain → infrastructure (denied by domain→infrastructure)

  error  shared/no-circular
           ./src/app/core/models/Client.ts:1:1
           Circular dependency detected: ./app/core/models/Client.ts → ./app/core/models/Project.ts → ./app/core/models/Client.ts

  warn  shared/no-cross-glob
          ./src/legacy/old-module.ts:15:3
          Cross-glob import: file in glob[0] imports from glob[1]

2 violations (1 error, 1 warn) [hex/layer-direction: 1, shared/no-circular: 1]
```

JSON output for CI / tooling pipelines:

```json
{
  "version": "0.1.0",
  "summary": {
    "total": 2,
    "bySeverity": { "error": 1, "warn": 1 },
    "byRule": { "hex/layer-direction": 1, "shared/no-circular": 1 },
    "worstSeverity": "error"
  },
  "violations": [
    {
      "rule": "hex/layer-direction",
      "severity": "error",
      "file": "/project/src/domain/order.ts",
      "line": 42,
      "column": 5,
      "reason": "Forbidden dependency: domain → infrastructure"
    }
  ]
}
```

Use `--quiet` to suppress per-violation lines — only the summary line is shown:

```bash
arch-guard check ./src --quiet
# → 5 violations (5 errors)
```

## Examples

### Scan a project with zero config

```bash
arch-guard check ./src
```

### Use a specific config file

```bash
arch-guard check ./src --config ./config/archguard.yml
```

### JSON output for CI pipelines

```bash
arch-guard check ./src --format json --quiet
```

### Pre-commit hook workflow

```bash
# Install the hook
arch-guard install-hook

# Now every commit automatically checks staged files
git add .
git commit -m "feat: add new feature"  # arch-guard runs automatically
```

### Enforce only hexagonal architecture

```yaml
# .archguard.yml
version: 1
preset: hex
```

### Ignore test files

```yaml
version: 1
exclude:
  - "**/*.test.ts"
  - "**/*.spec.ts"
  - "**/test/**"
  - "**/tests/**"
```

## Development

```bash
# Install dependencies
bun install

# Run from source
bun run dev check ./src

# Run tests
bun test

# Typecheck
bun run typecheck

# Build
bun run build
```

## License

MIT — see [LICENSE](./LICENSE) for details.
