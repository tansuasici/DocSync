import type { Blockquote, RootContent, Html } from 'mdast'
import type { AlertType } from '../transform/gfm-alerts.js'
import type { ResolvedPage } from '../core/source-resolver.js'
import type { TargetAdapter, NavConfigOutput } from './types.js'

/**
 * Alert type mapping: GFM → Fumadocs Callout type
 *
 * Fumadocs Callout types: info, warn, error
 * GFM alert types: note, tip, important, warning, caution
 */
const ALERT_TYPE_MAP: Record<AlertType, string> = {
  note: 'info',
  tip: 'info',
  important: 'info',
  warning: 'warn',
  caution: 'error',
}

export const fumadocsAdapter: TargetAdapter = {
  name: 'fumadocs',

  transformAlert(type: AlertType, node: Blockquote): RootContent[] {
    const calloutType = ALERT_TYPE_MAP[type]

    // Wrap the alert's own children in <Callout> tags. MDX re-parses the
    // markdown between the tags, so bold/links/code/lists are preserved.
    const open: Html = { type: 'html', value: `<Callout type="${calloutType}">` }
    const close: Html = { type: 'html', value: '</Callout>' }

    return [open, ...node.children, close]
  },

  generateNavConfig(_pages: ResolvedPage[]): NavConfigOutput | null {
    // Fumadocs needs per-directory meta.json files.
    // Return null here — we handle it in generatePerDirectoryNavConfig.
    return null
  },

  generatePerDirectoryNavConfig(pages: ResolvedPage[]): Map<string, NavConfigOutput> {
    const dirs = new Map<string, ResolvedPage[]>()

    for (const page of pages) {
      const parts = page.slug.split('/')
      if (parts.length === 1) {
        // Top-level page (e.g. "index", "evaluation")
        const group = dirs.get('') ?? []
        group.push(page)
        dirs.set('', group)
      } else {
        // Nested page (e.g. "core/agents")
        const dir = parts.slice(0, -1).join('/')
        const group = dirs.get(dir) ?? []
        group.push(page)
        dirs.set(dir, group)
      }
    }

    const result = new Map<string, NavConfigOutput>()

    // Root meta.json: ordered by first page's order in each group
    const rootEntries: { name: string; order: number }[] = []
    for (const [dir, dirPages] of dirs.entries()) {
      const minOrder = Math.min(...dirPages.map((p) => p.order))
      if (dir === '') {
        // Top-level pages added individually
        for (const p of dirPages) {
          rootEntries.push({ name: p.slug, order: p.order })
        }
      } else {
        rootEntries.push({ name: dir, order: minOrder })
      }
    }
    rootEntries.sort((a, b) => a.order - b.order)
    const rootPages = rootEntries.map((e) => e.name)

    result.set('meta.json', {
      filename: 'meta.json',
      content: JSON.stringify({ title: 'Documentation', pages: rootPages }, null, 2) + '\n',
    })

    // Per-directory meta.json
    for (const [dir, dirPages] of dirs.entries()) {
      if (dir === '') continue
      const title = dir.split('/').pop()!
      const capitalizedTitle = formatDirectoryTitle(title)
      const pageNames = dirPages.map((p) => p.slug.split('/').pop()!)

      result.set(`${dir}/meta.json`, {
        filename: `${dir}/meta.json`,
        content: JSON.stringify({ title: capitalizedTitle, pages: pageNames }, null, 2) + '\n',
      })
    }

    return result
  },

  mergePerDirectoryNavConfig(
    existing: Record<string, unknown>,
    generated: NavConfigOutput,
  ): NavConfigOutput {
    const gen = JSON.parse(generated.content) as { title: string; pages: string[] }
    const existingPages = Array.isArray(existing.pages) ? existing.pages : []

    // Preserve the user's title (if they set one) and their page ordering /
    // custom entries (separators, external links, etc.), appending only the
    // generated pages that aren't already listed.
    const merged = {
      ...existing,
      title: typeof existing.title === 'string' ? existing.title : gen.title,
      pages: [
        ...existingPages,
        ...gen.pages.filter((p) => !existingPages.includes(p)),
      ],
    }

    return {
      filename: generated.filename,
      content: JSON.stringify(merged, null, 2) + '\n',
    }
  },

  generateFrontmatter(page: ResolvedPage): Record<string, unknown> {
    const fm: Record<string, unknown> = {
      title: page.title ?? 'Untitled',
    }

    if (page.description) {
      fm.description = page.description
    }

    return fm
  },

  getImports(): string[] {
    return ["import { Callout } from 'fumadocs-ui/components/callout'"]
  },
}

/** Known acronyms that should be uppercased in directory titles */
const ACRONYMS = new Set(['llm', 'mcp', 'api', 'rag', 'cli', 'sdk', 'spi', 'bdi', 'fsm'])

function formatDirectoryTitle(name: string): string {
  if (ACRONYMS.has(name.toLowerCase())) {
    return name.toUpperCase()
  }
  return name.charAt(0).toUpperCase() + name.slice(1)
}
