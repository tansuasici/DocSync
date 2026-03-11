# DocSync — Project Specification

## Problem Statement

Developers write documentation in markdown (README.md, docs/*.md) that renders beautifully on GitHub. When they want a modern documentation site (Fumadocs, Docusaurus, Nextra, Starlight), every framework demands its own directory structure, file format (MDX), and frontmatter conventions. The result: documentation lives in two places, drifts out of sync, and doubles the maintenance burden.

**No open-source, framework-agnostic tool exists to bridge this gap.**

## Solution

DocSync is a CLI tool that transforms GitHub-native markdown into docs-framework-compatible output. Write once in GFM, publish everywhere.

```
repo/
  README.md              ← you write this (single source of truth)
  docs/
    getting-started.md
    configuration.md
    api-reference.md
  docsync.config.ts      ← DocSync config

$ npx docsync build

.docsync/                ← generated output (gitignored)
  getting-started.mdx
  configuration.mdx
  api-reference.mdx
  meta.json
```

The docs framework reads from `.docsync/` instead of a hand-maintained content directory.

---

## Core Concepts

### 1. Source Mapping

Config file defines which markdown files become which docs pages:

```ts
// docsync.config.ts
import { defineConfig } from 'docsync'

export default defineConfig({
  sources: [
    { path: 'README.md', slug: 'index', title: 'Introduction' },
    { path: 'docs/**/*.md' },
  ],
  target: 'fumadocs',
  outDir: '.docsync',
})
```

- `path`: glob pattern or explicit file path (repo-relative)
- `slug`: override auto-generated slug (optional)
- `title`: override title extraction (optional)
- Glob patterns auto-discover files; explicit paths give full control

### 2. GFM → MDX Transformation Pipeline

DocSync uses a remark/rehype pipeline to handle the conversion:

```
Input (GFM)
  → Parse (remark-parse + remark-gfm)
  → Transform GitHub alerts (> [!NOTE] → <Callout>)
  → Escape MDX-breaking syntax ({ } < > <!-- -->)
  → Rewrite relative links (./docs/foo.md → /docs/foo)
  → Rewrite image paths (relative → absolute or copied)
  → Inject frontmatter (title, description, sidebar position)
  → Serialize (remark-stringify or remark-mdx)
Output (MDX)
```

### 3. Target Adapters

Each docs framework has an adapter that handles framework-specific concerns:

| Concern | Fumadocs | Docusaurus | Nextra | Starlight |
|---------|----------|------------|--------|-----------|
| Output format | MDX | MDX | MDX | MDX |
| Alert component | `<Callout>` | `:::note` directive | `<Callout>` | `<Aside>` |
| Nav config | `meta.json` | `_category_.json` | `_meta.json` | frontmatter `sidebar` |
| Frontmatter | `title`, `description` | `title`, `sidebar_position` | `title` | `title`, `sidebar` |
| Link format | `/docs/slug` | `/docs/slug` | `/docs/slug` | `/docs/slug` |

MVP ships with Fumadocs only. Adapter interface is designed for extensibility.

### 4. Frontmatter Synthesis

GitHub READMEs don't have frontmatter. DocSync generates it:

- **title**: extracted from first `# Heading`, or from config override, or from filename
- **description**: extracted from first paragraph after heading (optional)
- **sidebar_position**: from config ordering or file discovery order
- Additional fields per target adapter requirements

### 5. Link Rewriting

The most complex transformation. Rules:

| Source link | Target | Action |
|-------------|--------|--------|
| `./docs/guide.md` | In source map | Rewrite to docs-site URL (`/docs/guide`) |
| `./docs/guide.md#section` | In source map | Rewrite URL, preserve anchor |
| `./src/index.ts` | NOT in source map | Rewrite to GitHub raw URL |
| `https://example.com` | External | Pass through unchanged |
| `#section` | Anchor only | Pass through unchanged |
| `../README.md` | In source map | Resolve relative path, rewrite |

Config option for GitHub base URL (for non-doc file links):

```ts
defineConfig({
  github: {
    repo: 'user/repo',
    branch: 'main', // default
  },
})
```

---

## Architecture

```
docsync/
  src/
    cli/                    # CLI entry point (commander or citty)
      index.ts
      commands/
        build.ts
        init.ts
    config/                 # Config loading & validation
      schema.ts             # Zod schema for docsync.config.ts
      loader.ts             # Load & validate config
    core/                   # Framework-agnostic engine
      pipeline.ts           # Orchestrates the full transform
      source-resolver.ts    # Glob expansion, file discovery
      link-rewriter.ts      # Relative link transformation
      frontmatter.ts        # Frontmatter generation/injection
    transform/              # Remark/rehype plugins
      gfm-alerts.ts         # > [!NOTE] → component
      escape-mdx.ts         # Escape { } < > etc.
      rewrite-links.ts      # Custom remark plugin for links
      rewrite-images.ts     # Image path handling
    adapters/               # Target framework adapters
      types.ts              # Adapter interface
      fumadocs.ts           # Fumadocs-specific output
    utils/
      markdown.ts           # Markdown parsing utilities
      fs.ts                 # File system helpers
  tests/
    fixtures/               # Test markdown files
    transform/              # Transform unit tests
    adapters/               # Adapter tests
    integration/            # End-to-end tests
```

### Adapter Interface

```ts
interface TargetAdapter {
  name: string

  /** Transform a GFM alert to framework-specific component */
  transformAlert(type: AlertType, content: string): MdxNode

  /** Generate navigation/sidebar config file */
  generateNavConfig(pages: ResolvedPage[]): FileOutput

  /** Generate frontmatter for a page */
  generateFrontmatter(page: ResolvedPage): Record<string, unknown>

  /** Framework-specific link format */
  formatLink(slug: string): string

  /** Any post-processing on final MDX */
  postProcess?(content: string): string
}
```

---

## GFM → MDX Conversion Matrix

### Handled Automatically

| GFM Feature | MDX Output | Plugin/Method |
|-------------|-----------|---------------|
| Tables | Tables (pass-through) | remark-gfm |
| Task lists | Task lists (pass-through) | remark-gfm |
| Strikethrough | Strikethrough (pass-through) | remark-gfm |
| Footnotes | Footnotes (pass-through) | remark-gfm |
| `> [!NOTE]` alerts | Framework callout component | Custom remark plugin |
| `{` `}` in text | `\{` `\}` escaped | Custom remark plugin |
| `<` `>` in text | `\<` `\>` or `{'<'}` escaped | Custom remark plugin |
| `<!-- comment -->` | `{/* comment */}` | Custom remark plugin |
| `<br>` void elements | `<br />` self-closed | Custom rehype plugin |
| Relative `.md` links | Docs-site URLs | Custom remark plugin |
| Autolinks `<url>` | `[url](url)` | Custom remark plugin |

### Conversion Challenges (Severity Ranked)

| # | Challenge | Severity | Strategy |
|---|-----------|----------|----------|
| 1 | Curly braces `{}` | Critical | Regex escape in text nodes, skip code blocks |
| 2 | `<details>/<summary>` | High | Convert to framework accordion/details component |
| 3 | GitHub alerts | High | Map to framework callout via adapter |
| 4 | Angle brackets in text | High | Escape or wrap in expression |
| 5 | Relative links | Medium | Link rewriter with source map lookup |
| 6 | Mermaid diagrams | Medium | Pass through as code block (framework handles rendering) |
| 7 | HTML comments | Medium | Convert to JSX comments |
| 8 | Image paths | Medium | Copy to output or rewrite to GitHub raw URL |
| 9 | `@user` / `#123` refs | Low | Strip or convert to plain text (configurable) |
| 10 | Badge images | Low | Pass through (standard markdown images) |

---

## MVP Scope (v0.1.0)

### In Scope

1. **CLI with two commands**: `docsync build` and `docsync init`
2. **TypeScript config file**: `docsync.config.ts` with Zod validation
3. **Single target**: Fumadocs adapter only
4. **Core transforms**:
   - GFM alert → Fumadocs `<Callout>` conversion
   - Curly brace / angle bracket escaping
   - HTML comment → JSX comment conversion
   - Autolink → standard link conversion
   - Void element self-closing (`<br>` → `<br />`)
5. **Link rewriting**: relative `.md` links → docs-site slugs
6. **Frontmatter synthesis**: title (from H1), description (from first paragraph)
7. **Navigation**: Generate `meta.json` from source ordering
8. **Image handling**: Rewrite to GitHub raw URL (simplest approach)
9. **Output**: Generated MDX files in `.docsync/` directory

### Out of Scope (v0.2+)

- Watch mode / dev server integration
- Monorepo support (multiple package READMEs)
- Additional framework adapters (Docusaurus, Nextra, Starlight)
- `<details>/<summary>` → accordion conversion
- Mermaid rendering
- Bidirectional sync
- Custom component mapping config
- i18n / multi-language support
- GitHub Action for CI/CD

---

## Tech Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Language | TypeScript | Type safety, ecosystem alignment with docs frameworks |
| Package manager | pnpm | Fast, disk-efficient, good monorepo support |
| CLI framework | citty (unjs) | Lightweight, TypeScript-first, ESM-native |
| Config loading | c12 + jiti (unjs) | Loads .ts/.js/.json config files with TypeScript support |
| Schema validation | Zod | Runtime validation + TypeScript inference |
| Markdown parsing | unified + remark | Industry standard, plugin ecosystem |
| MDX serialization | remark-mdx | Direct AST manipulation |
| GFM support | remark-gfm | Tables, task lists, strikethrough, footnotes |
| File globbing | fast-glob | Fast, reliable glob expansion |
| Testing | Vitest | Fast, TypeScript-native, ESM support |
| Build | tsup | Zero-config TypeScript bundler |
| Linting | ESLint + Prettier | Standard tooling |

### Why These Choices

**citty over commander/yargs**: Smaller, TypeScript-first, ESM-native. No legacy baggage. From the unjs ecosystem which DocSync aligns with.

**c12 + jiti over cosmiconfig**: Native TypeScript config support without extra setup. Handles `docsync.config.ts` out of the box with proper type checking.

**remark/rehype over regex**: AST-based transformation is reliable for structural changes. Regex breaks on edge cases (nested code blocks, frontmatter, etc.).

**Vitest over Jest**: ESM-native, no config ceremony, snapshot testing for transform output.

---

## Config Schema

```ts
interface DocSyncConfig {
  /** Source files to include */
  sources: SourceEntry[]

  /** Target docs framework */
  target: 'fumadocs' // | 'docusaurus' | 'nextra' | 'starlight' (future)

  /** Output directory for generated files (default: '.docsync') */
  outDir?: string

  /** GitHub repository info for external link rewriting */
  github?: {
    repo: string    // 'user/repo'
    branch?: string // default: 'main'
  }

  /** Base URL path for docs (default: '/docs') */
  baseUrl?: string

  /** Clean output directory before build (default: true) */
  clean?: boolean
}

interface SourceEntry {
  /** File path or glob pattern (repo-relative) */
  path: string

  /** Override slug (for explicit entries only) */
  slug?: string

  /** Override page title */
  title?: string

  /** Override page description */
  description?: string

  /** Sidebar position (lower = higher) */
  order?: number
}
```

---

## User Journey

### 1. Install

```bash
npm install -D docsync
```

### 2. Initialize

```bash
npx docsync init
# Asks: Which framework? → fumadocs
# Asks: Where are your docs? → docs/
# Creates: docsync.config.ts
# Updates: .gitignore (adds .docsync/)
```

### 3. Configure

```ts
// docsync.config.ts
import { defineConfig } from 'docsync'

export default defineConfig({
  sources: [
    { path: 'README.md', slug: 'index', title: 'Introduction' },
    { path: 'docs/**/*.md' },
  ],
  target: 'fumadocs',
  github: { repo: 'user/my-project' },
})
```

### 4. Build

```bash
npx docsync build
# ✓ Found 5 source files
# ✓ Transformed README.md → .docsync/index.mdx
# ✓ Transformed docs/getting-started.md → .docsync/getting-started.mdx
# ✓ Transformed docs/configuration.md → .docsync/configuration.mdx
# ✓ Generated .docsync/meta.json
# Done! 5 files written to .docsync/
```

### 5. Wire up Fumadocs

```ts
// source.config.ts (Fumadocs)
import { defineDocs } from 'fumadocs-mdx/config'

export const docs = defineDocs({
  dir: '.docsync', // point to DocSync output
})
```

### 6. Add to build pipeline

```json
// package.json
{
  "scripts": {
    "prebuild": "docsync build",
    "build": "next build",
    "dev": "docsync build && next dev"
  }
}
```

---

## Success Criteria

### v0.1.0 (MVP)
- [ ] `docsync init` creates a valid config file
- [ ] `docsync build` transforms GFM → MDX correctly for Fumadocs
- [ ] GitHub alerts convert to `<Callout>` components
- [ ] Relative links between source files rewrite correctly
- [ ] Frontmatter is auto-generated with title and description
- [ ] Generated output works with Fumadocs out of the box
- [ ] Published on npm as `docsync`

### v0.2.0
- [ ] Watch mode for dev workflow
- [ ] Docusaurus adapter
- [ ] `<details>/<summary>` conversion
- [ ] Monorepo source support

### v1.0.0
- [ ] All major framework adapters (Fumadocs, Docusaurus, Nextra, Starlight)
- [ ] GitHub Action for CI/CD
- [ ] Comprehensive test suite with real-world repos
- [ ] Production documentation site (built with DocSync, obviously)

---

## Open Questions (Resolved)

| Question | Decision | Rationale |
|----------|----------|-----------|
| Config format? | TypeScript (`docsync.config.ts`) | Type safety, autocomplete, aligns with framework configs |
| Watch mode in MVP? | No — v0.2 | Keep MVP focused on correctness, not DX polish |
| Monorepo in MVP? | No — v0.2 | Additional complexity in source resolution |
| Output strategy? | Generate files to `.docsync/` | Simpler than Fumadocs custom source plugin; works with any framework |
| Package name? | `docsync` | Short, descriptive, memorable |

---

## Competitive Landscape

| Tool | Type | Limitation |
|------|------|-----------|
| GitBook Git Sync | Commercial SaaS | Vendor lock-in, not self-hosted |
| Mintlify | Commercial SaaS | One-time generation, not sync |
| Nextra Remote Content | Framework feature | Nextra-only, manual wiring |
| Starlight symlinks | Workaround | Breaks multilingual, git tracking |
| Docusaurus plugin-includes | Community plugin | Fragile, limited transform |
| MkDocs monorepo plugin | Open source | Python ecosystem only |
| **DocSync** | **Open source CLI** | **Framework-agnostic, full transform pipeline** |

DocSync is the only open-source tool that provides framework-agnostic, AST-based GFM→MDX transformation with automatic link rewriting and frontmatter synthesis.
