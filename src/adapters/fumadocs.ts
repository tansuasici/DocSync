import type { Blockquote, RootContent, Html } from 'mdast'
import type { AlertType } from '../transform/gfm-alerts.js'
import type { ResolvedPage } from '../core/source-resolver.js'
import type { NavConfig } from '../config/schema.js'
import type { TargetAdapter, NavConfigOutput } from './types.js'
import { groupByDirectory, formatDirectoryTitle } from './nav-tree.js'

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

/** meta.json `pages` syntax that does not name a page or folder */
const REST = '...'
const SEPARATOR = /^---.*---$|^---$/
const LINK = /^(?:external:)?(?:\[[^\]]+\])?\[[^\]]+\]\([^)]+\)$/

export const fumadocsAdapter: TargetAdapter = {
  name: 'fumadocs',

  // Fumadocs wraps each heading (and its TOC entry) in a self-anchor.
  unwrapHeadingLinks: true,

  supportsNav: true,

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

  generatePerDirectoryNavConfig(
    pages: ResolvedPage[],
    nav: NavConfig = {},
  ): Map<string, NavConfigOutput> {
    const generated = new Map<string, string[]>()
    for (const [dir, entries] of groupByDirectory(pages)) {
      generated.set(dir, entries.map((e) => e.name))
    }
    const overrides = new Map(
      Object.entries(nav).map(([dir, entry]) => [dir.replace(/^\/+|\/+$/g, ''), entry]),
    )

    const result = new Map<string, NavConfigOutput>()
    for (const dir of new Set([...generated.keys(), ...overrides.keys()])) {
      const override = overrides.get(dir)
      const { title, pages: order, ...extra } = override ?? {}

      // An explicit `pages` list is written verbatim (separators, `...`,
      // links); otherwise the generated order is kept.
      const meta: Record<string, unknown> = {
        title: title ?? defaultTitle(dir),
        ...extra,
      }
      const pageList = order ?? generated.get(dir)
      if (pageList) meta.pages = pageList

      const filename = dir === '' ? 'meta.json' : `${dir}/meta.json`
      result.set(filename, {
        filename,
        content: JSON.stringify(meta, null, 2) + '\n',
        explicit: override !== undefined,
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

  validateNavConfig(output: NavConfigOutput, available: Set<string>): string[] {
    const meta = JSON.parse(output.content) as { pages?: unknown }
    // Without a `pages` list Fumadocs shows everything — nothing to check.
    if (!Array.isArray(meta.pages)) return []

    const warnings: string[] = []
    const listed = new Set<string>()
    let hasRest = false

    for (const entry of meta.pages) {
      if (typeof entry !== 'string') continue
      if (entry === REST) {
        hasRest = true
        continue
      }
      if (SEPARATOR.test(entry) || LINK.test(entry)) continue

      // `...folder` inlines a folder, `!page` excludes one — both name it.
      const name = entry.replace(/^(\.\.\.|!)/, '')
      listed.add(name)
      if (!available.has(name)) {
        warnings.push(`${output.filename}: "${entry}" matches no page or folder`)
      }
    }

    // Fumadocs treats `pages` as exhaustive: anything not listed (and not
    // caught by `...`) is built and routed but absent from the sidebar.
    // A subfolder's index is reachable through the folder label itself.
    if (!hasRest) {
      const isRoot = output.filename === 'meta.json'
      const hidden = [...available]
        .filter((name) => !listed.has(name) && (isRoot || name !== 'index'))
        .sort()
      if (hidden.length > 0) {
        warnings.push(
          `${output.filename}: not in "pages", so hidden from the sidebar: ${hidden.join(', ')} ` +
            `(list them, or add "..." to include the rest)`,
        )
      }
    }

    return warnings
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

function defaultTitle(dir: string): string {
  return dir === '' ? 'Documentation' : formatDirectoryTitle(dir.split('/').pop()!)
}
