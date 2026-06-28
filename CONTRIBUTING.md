# Contributing to arch-guard

Thanks for considering contributing! This project is in early stages and every contribution helps.

## How to contribute

### Report bugs

Open an issue using the [bug report template](https://github.com/pabloalvrezz/arch-guard/issues/new?template=bug_report.md). Include:

- Steps to reproduce
- Expected vs actual behavior
- Your environment (OS, runtime, version)
- The `.archguard.yml` config you were using

### Suggest features

Open an issue using the [feature request template](https://github.com/pabloalvrezz/arch-guard/issues/new?template=feature_request.md). Describe the problem and your proposed solution clearly.

### Submit code

1. Fork the repo
2. Create a branch: `git checkout -b feat/my-feature`
3. Make your changes
4. Run tests: `bun test`
5. Run typecheck: `bun run typecheck`
6. Run build: `bun run build`
7. Commit with conventional commits: `feat(scope): description`
8. Push and open a PR

### Code style

- TypeScript strict mode
- Conventional commits (`feat:`, `fix:`, `docs:`, `refactor:`, `chore:`)
- Tests required for new features
- Keep PRs under 400 lines when possible

### Architecture overview

```
src/
  cli/         — Commander entrypoint, flag parsing
  config/      — YAML/TOML discovery, loading, validation
  analyzer/    — AST traversal, import extraction, layer graph
  rules/       — Rule interface, engine, built-in rules
  reporter/    — Human and JSON output formatters
  hooks/       — Git hook installer/uninstaller
  shared/      — Exit codes, errors, utilities
```

The rule engine (`src/rules/`) is language-agnostic — it works on `LayerGraph` regardless of how it was built. Adding new language support means writing a new analyzer, not new rules.

## Questions?

Open a [Discussion](https://github.com/pabloalvrezz/arch-guard/discussions).
