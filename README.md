# DocSync

Transform GitHub markdown into docs-framework-compatible output. Write once in GFM, publish everywhere.

## The Problem

You write documentation in markdown — `README.md`, `docs/*.md` — and it looks great on GitHub. But when you want a modern docs site (Fumadocs, Docusaurus, Nextra, Starlight), every framework demands its own directory structure, MDX format, and frontmatter conventions. You end up maintaining docs in two places.

**DocSync bridges this gap.** Keep your markdown as the single source of truth. DocSync handles the rest.

## Quick Start

```bash
npm install -D docsync
npx docsync init
```

Edit the generated config:

```ts
// docsync.config.ts
import { defineConfig } from 'docsync'

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

DocSync reads your GitHub-native markdown and produces framework-ready MDX:

| Input (GFM) | Output (MDX) |
|---|---|
| `> [!NOTE]` alerts | `<Callout>` components |
| `{curly braces}` in text | `\{escaped\}` for MDX |
| `<!-- HTML comments -->` | `{/* JSX comments */}` |
| `./docs/guide.md` links | `/docs/guide` URLs |
| `./assets/logo.png` | GitHub raw URL |
| First `# Heading` | `title` frontmatter |
| First paragraph | `description` frontmatter |

It also generates navigation config (`meta.json` for Fumadocs) from your source ordering.

## Configuration

```ts
import { defineConfig } from 'docsync'

export default defineConfig({
  // Required
  sources: [
    { path: 'README.md', slug: 'index', title: 'Introduction' },
    { path: 'docs/**/*.md' },
    { path: 'CHANGELOG.md', slug: 'changelog', order: 99 },
  ],
  target: 'fumadocs',

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

- **Fumadocs** — full support (v0.1.0)
- Docusaurus — planned (v0.2)
- Nextra — planned
- Starlight — planned

## License

MIT
