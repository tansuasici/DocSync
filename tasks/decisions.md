# Architecture Decision Records

Track important technical decisions here so they don't get lost between sessions.

---

## Format

```markdown
### ADR-[number]: [Short title]
- **Date**: YYYY-MM-DD
- **Status**: proposed | accepted | rejected | superseded
- **Context**: [What problem are we solving? What constraint exists?]
- **Options**:
  - A) [Option] — Pros: ... / Cons: ...
  - B) [Option] — Pros: ... / Cons: ...
- **Decision**: [Which option and why]
- **Consequences**: [What changes as a result? Any risks?]
```

---

## Example

### ADR-001: Use Zod for request validation
- **Date**: 2026-03-01
- **Status**: accepted
- **Context**: API endpoints accept user input without validation. Need runtime validation with TypeScript type inference.
- **Options**:
  - A) Zod — Pros: TypeScript-first, small bundle, great DX / Cons: another dependency
  - B) Joi — Pros: mature, battle-tested / Cons: no TS inference, larger
  - C) Manual validation — Pros: no dependency / Cons: error-prone, verbose
- **Decision**: Zod (A). TypeScript inference eliminates duplicate type definitions. Small enough to justify the dependency.
- **Consequences**: All route handlers must validate input with Zod schemas. Schemas live in `src/schemas/`.

---

<!-- Add new decisions below this line -->

### ADR-001: Package name — docsync
- **Date**: 2026-03-11
- **Status**: accepted
- **Context**: Need a memorable, descriptive npm package name for the project.
- **Options**:
  - A) docsync — Pros: short, descriptive (docs + sync), npm'de müsait / Cons: generic
  - B) markbridge — Pros: unique / Cons: less descriptive
  - C) repo2docs — Pros: very descriptive / Cons: ugly, npm naming convention
- **Decision**: docsync (A). Short, memorable, available on npm, describes exactly what the tool does.
- **Consequences**: npm package published as `docsync`, CLI command is `docsync`.

---

### ADR-002: Config format — TypeScript
- **Date**: 2026-03-11
- **Status**: accepted
- **Context**: Users need a config file to define source mappings and target framework. Need type safety and autocomplete.
- **Options**:
  - A) TypeScript (`docsync.config.ts`) with c12+jiti — Pros: type safety, autocomplete, aligns with framework configs / Cons: requires jiti for loading
  - B) JSON/YAML — Pros: simple, no build step / Cons: no type safety, no autocomplete, no comments
  - C) JavaScript — Pros: flexible / Cons: no type safety
- **Decision**: TypeScript (A). c12+jiti handles loading seamlessly. `defineConfig()` helper provides autocomplete. Consistent with Vite, Fumadocs, Astro config patterns.
- **Consequences**: Ship `defineConfig()` from main package export. Depend on c12+jiti for config loading.

---

### ADR-003: Output strategy — file generation
- **Date**: 2026-03-11
- **Status**: accepted
- **Context**: Need to decide how DocSync feeds content to docs frameworks. Two approaches: generate files to disk, or provide a runtime source plugin.
- **Options**:
  - A) Generate MDX files to `.docsync/` directory — Pros: framework-agnostic, simple, debuggable (inspect output), works with any framework's existing file-based content loading / Cons: extra build step, gitignored files
  - B) Fumadocs custom source plugin — Pros: tighter integration, no intermediate files / Cons: Fumadocs-only, harder to debug, couples to framework internals
- **Decision**: File generation (A). Simpler, works with any framework, output is inspectable. Frameworks point their content dir to `.docsync/`.
- **Consequences**: `.docsync/` added to `.gitignore`. `docsync build` runs as prebuild step. Each adapter generates framework-specific files (meta.json, frontmatter format, etc.).

---

### ADR-004: MVP scope — Fumadocs only
- **Date**: 2026-03-11
- **Status**: accepted
- **Context**: Supporting multiple frameworks from day one would spread effort thin and delay release.
- **Options**:
  - A) Fumadocs only — Pros: focused, ship fast, validate core pipeline / Cons: limited audience initially
  - B) Fumadocs + Docusaurus — Pros: wider audience / Cons: 2x adapter work, harder to test
  - C) Framework-agnostic MDX only — Pros: universal / Cons: no nav config, incomplete experience
- **Decision**: Fumadocs only (A). Ship a complete, polished experience for one framework. Adapter interface designed for extensibility so adding frameworks later is straightforward.
- **Consequences**: v0.1 ships with Fumadocs adapter. Adapter interface (`TargetAdapter`) is designed from day 1 for multi-framework support. Docusaurus target planned for v0.2.
