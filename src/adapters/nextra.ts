import type { Blockquote, RootContent, Html } from 'mdast'
import type { AlertType } from '../transform/gfm-alerts.js'
import type { ResolvedPage } from '../core/source-resolver.js'
import type { TargetAdapter, NavConfigOutput } from './types.js'
import { groupByDirectory, formatDirectoryTitle } from './nav-tree.js'

/**
 * Alert type mapping: GFM → Nextra Callout type
 *
 * Nextra Callout types: info, warning, error, default
 */
const ALERT_TYPE_MAP: Record<AlertType, string> = {
  note: 'info',
  tip: 'default',
  important: 'info',
  warning: 'warning',
  caution: 'error',
}

export const nextraAdapter: TargetAdapter = {
  name: 'nextra',

  transformAlert(type: AlertType, node: Blockquote): RootContent[] {
    const calloutType = ALERT_TYPE_MAP[type]

    // Wrap the alert's own children in <Callout> tags so MDX re-parses the
    // markdown between them — preserving bold, links, code, and lists.
    const open: Html = { type: 'html', value: `<Callout type="${calloutType}">` }
    const close: Html = { type: 'html', value: '</Callout>' }

    return [open, ...node.children, close]
  },

  generateNavConfig(_pages: ResolvedPage[]): NavConfigOutput | null {
    // Nextra reads one _meta file per directory — see generatePerDirectoryNavConfig.
    return null
  },

  /**
   * One `_meta.js` per directory (Nextra 3+ dropped `_meta.json`). Key order
   * is sidebar order; values are titles — the page's title, or the folder
   * name for subfolders.
   */
  generatePerDirectoryNavConfig(pages: ResolvedPage[]): Map<string, NavConfigOutput> {
    const result = new Map<string, NavConfigOutput>()

    for (const [dir, entries] of groupByDirectory(pages)) {
      const meta: Record<string, string> = {}
      for (const { name, page } of entries) {
        meta[name] = page ? (page.title ?? name) : formatDirectoryTitle(name)
      }

      const filename = dir === '' ? '_meta.js' : `${dir}/_meta.js`
      result.set(filename, { filename, content: serializeMeta(meta) })
    }

    return result
  },

  parseNavConfig(content: string): Record<string, unknown> {
    return parseMeta(content)
  },

  mergePerDirectoryNavConfig(
    existing: Record<string, unknown>,
    generated: NavConfigOutput,
  ): NavConfigOutput {
    // Keep the user's entries (custom titles, separators, links) and their
    // order; append only the generated pages that aren't listed yet.
    const merged: Record<string, unknown> = { ...existing }
    for (const [name, title] of Object.entries(parseMeta(generated.content))) {
      if (!(name in merged)) merged[name] = title
    }

    return {
      filename: generated.filename,
      content: serializeMeta(merged),
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
    return ["import { Callout } from 'nextra/components'"]
  },
}

function serializeMeta(meta: Record<string, unknown>): string {
  return `export default ${JSON.stringify(meta, null, 2)}\n`
}

/**
 * Read a `_meta.js` written as `export default { …JSON… }`. Throws on
 * anything else (e.g. hand-written JS), so the caller leaves it untouched.
 */
function parseMeta(content: string): Record<string, unknown> {
  const body = content
    .trim()
    .replace(/^export\s+default\s+/, '')
    .replace(/;$/, '')
  return JSON.parse(body) as Record<string, unknown>
}
