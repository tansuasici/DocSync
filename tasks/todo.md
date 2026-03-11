# Task Board

---

## In Progress

### Task: Polish & publish (v0.1.0 — Phase 4)

**Goal**: Ship v0.1.0 to npm.

1. [ ] `docsync init` interactive wizard
2. [x] CLI output formatting (progress, errors, summary)
3. [ ] README.md for the package
4. [x] npm publish setup (package.json bin, exports, files)
5. [ ] End-to-end test with a real Fumadocs project

---

## Up Next

---

## Done

### Task: Project spec & MVP scope
- [x] Research: Fumadocs source API, competitor analysis, GFM→MDX challenges
- [x] Write project spec (`docs/SPEC.md`)
- [x] Record architecture decisions (ADR-001 through ADR-004)
- [x] Define MVP scope and get approval

### Task: Project scaffolding (v0.1.0 — Phase 1)
- [x] `pnpm init`, tsconfig, tsup, vitest setup
- [x] CLI skeleton with citty (`docsync build`, `docsync init`)
- [x] Config schema (Zod) + loader (c12) + `defineConfig()` helper
- [x] Source resolver (glob expansion, file discovery)
- [x] Basic tests for config loading and source resolution (17 tests passing)

### Task: Core transform pipeline (v0.1.0 — Phase 2)
- [x] Remark plugin: GitHub alerts → generic callout nodes
- [x] Remark plugin: escape `{}`, `<>`, `<!-- -->` for MDX
- [x] Remark plugin: rewrite relative `.md` links using source map
- [x] Remark plugin: rewrite image paths to GitHub raw URLs
- [x] Frontmatter synthesis (title from H1, description from first paragraph)
- [x] Pipeline orchestration (chain plugins, serialize output)

### Task: Fumadocs adapter (v0.1.0 — Phase 3)
- [x] Adapter interface (`TargetAdapter` type)
- [x] Fumadocs adapter: alert → `<Callout>` mapping
- [x] Fumadocs adapter: `meta.json` generation
- [x] Fumadocs adapter: frontmatter format
- [x] Smoke test: full pipeline → valid Fumadocs content

---

## Not Now
- [ ] Watch mode / dev server integration (v0.2)
- [ ] Docusaurus adapter (v0.2)
- [ ] Nextra adapter (v0.3+)
- [ ] Starlight adapter (v0.3+)
- [ ] `<details>/<summary>` → accordion conversion (v0.2)
- [ ] Mermaid diagram handling (v0.2)
- [ ] Monorepo support (v0.2)
- [ ] Bidirectional sync
- [ ] i18n / multi-language support
- [ ] GitHub Action for CI/CD
- [ ] Custom component mapping config
- [ ] Snapshot tests for each transform
