import type { Blockquote, RootContent, Html } from 'mdast'
import type { AlertType } from '../transform/gfm-alerts.js'
import type { ResolvedPage } from '../core/source-resolver.js'
import type { TargetAdapter, NavConfigOutput } from './types.js'
import { toString } from 'mdast-util-to-string'

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

  transformAlert(type: AlertType, node: Blockquote): RootContent {
    const calloutType = ALERT_TYPE_MAP[type]
    const content = toString(node)

    // Generate an HTML node with Callout JSX
    const htmlNode: Html = {
      type: 'html',
      value: `<Callout type="${calloutType}">\n${content}\n</Callout>`,
    }

    return htmlNode
  },

  generateNavConfig(pages: ResolvedPage[]): NavConfigOutput | null {
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
