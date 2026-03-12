<p align="center">
  <img src="./docsync_logo.png" alt="DocSync" width="120" />
</p>

# DocSync

[![License: MIT](https://img.shields.io/badge/license-MIT-green)](./LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)](https://www.typescriptlang.org/)
[![npm version](https://img.shields.io/npm/v/@tansuasici/docsync?color=blue)](https://www.npmjs.com/package/@tansuasici/docsync)

**Write docs once in GitHub Markdown, publish everywhere.**

DocSync transforms your GitHub-native markdown (`README.md`, `docs/*.md`) into framework-ready MDX. No more maintaining docs in two places.

```
README.md ──┐
docs/*.md ──┤── docsync build ──→ .docsync/*.mdx ──→ Fumadocs / Docusaurus / ...
             └── docsync.config.ts
```

## The Problem

You write documentation in markdown and it looks great on GitHub. But when you want a modern docs site (Fumadocs, Docusaurus, Nextra, Starlight), every framework demands its own directory structure, MDX format, and frontmatter conventions. You end up maintaining docs in two places.

DocSync bridges this gap. Keep your markdown as the single source of truth.

## Quick Start

```bash
npm install -D @tansuasici/docsync
npx docsync init
```

Edit the generated config:

```ts
// docsync.config.ts
import { defineConfig } from '@tansuasici/docsync'

export default defineConfig({
  sources: [
    { path: 'README.md', slug: 'index', title: 'Introduction' },
    { path: 'docs/**/*.md' },
  ],
  target: 'fumadocs',
  github: { repo: 'your-username/your-repo' },
})
```

Build:

```bash
npx docsync build
# ✓ index.mdx
# ✓ getting-started.mdx
# ✓ api.mdx
# Done! 3 files written to .docsync/
```

Point your docs framework to the output:

```ts
// source.config.ts (Fumadocs)
import { defineDocs } from 'fumadocs-mdx/config'

export const docs = defineDocs({
  dir: '.docsync',
})
```

## What It Does

| Input (GFM) | Output (MDX) |
|---|---|
| `> [!NOTE]` alerts | `<Callout>` components |
| `{curly braces}` in text | `\{escaped\}` for MDX |
| `<!-- HTML comments -->` | `{/* JSX comments */}` |
| `./docs/guide.md` links | `/docs/guide` site URLs |
| `./assets/logo.png` | GitHub raw URL |
| First `# Heading` | `title` frontmatter |
| First paragraph | `description` frontmatter |

It also generates navigation config (`meta.json` for Fumadocs) from your source ordering.

## Configuration

```ts
import { defineConfig } from '@tansuasici/docsync'

export default defineConfig({
  // Required
  sources: [
    { path: 'README.md', slug: 'index', title: 'Introduction' },
    { path: 'docs/**/*.md' },
    { path: 'CHANGELOG.md', slug: 'changelog', order: 99 },
  ],
  target: 'fumadocs', // or 'docusaurus', 'nextra', 'starlight'

  // Optional
  outDir: '.docsync',           // default: '.docsync'
  baseUrl: '/docs',             // default: '/docs'
  clean: true,                  // default: true
  github: {
    repo: 'user/repo',
    branch: 'main',             // default: 'main'
  },
})
```

### Source Entry Options

| Option | Type | Description |
|--------|------|-------------|
| `path` | `string` | File path or glob pattern (required) |
| `slug` | `string` | Override URL slug |
| `title` | `string` | Override page title |
| `description` | `string` | Override page description |
| `order` | `number` | Sidebar position (lower = higher) |

## Integration with Build Pipeline

```json
{
  "scripts": {
    "prebuild": "docsync build",
    "build": "next build",
    "dev": "docsync build && next dev"
  }
}
```

## Supported Targets

| Target | Status | Alert Syntax | Nav Config |
|--------|--------|-------------|------------|
| Fumadocs | Full support | `<Callout>` | `meta.json` |
| Docusaurus | Full support | `:::note` directive | `_category_.json` |
| Nextra | Full support | `<Callout>` | `_meta.json` |
| Starlight | Full support | `:::note` directive | frontmatter `sidebar` |

## How It Works

DocSync uses a [unified](https://unifiedjs.com/) / remark pipeline to transform markdown at the AST level:

1. **Parse** GFM markdown (tables, task lists, alerts, etc.)
2. **Transform** GitHub-specific syntax to MDX-compatible output
3. **Rewrite** relative links and images using the source map
4. **Inject** frontmatter (title, description) from content analysis
5. **Generate** framework-specific navigation config

This approach is reliable — no regex hacks, no string replacement. The AST handles edge cases like nested code blocks, frontmatter, and mixed content correctly.

## Contributing

Contributions are welcome! The codebase is TypeScript with a clean architecture:

```
src/
  cli/           CLI commands (citty)
  config/        Config schema (Zod) + loader (c12)
  core/          Build pipeline + source resolver
  transform/     Remark plugins (alerts, escaping, links, images)
  adapters/      Framework-specific output (Fumadocs, ...)
```

```bash
pnpm install
pnpm test        # 29 tests
pnpm typecheck   # TypeScript verification
pnpm build       # Build with tsup
```

## License

MIT
