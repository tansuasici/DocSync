import type { Blockquote, RootContent, Html } from 'mdast'
import type { AlertType } from '../transform/gfm-alerts.js'
import type { ResolvedPage } from '../core/source-resolver.js'
import type { TargetAdapter, NavConfigOutput } from './types.js'

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

  generateNavConfig(pages: ResolvedPage[]): NavConfigOutput {
    // Nextra uses _meta.json with page-name: title/config pairs
    const meta: Record<string, string | { title: string }> = {}

    for (const page of pages) {
      const name = page.slug === 'index' ? 'index' : page.slug.split('/').pop()!
      meta[name] = page.title ?? name
    }

    return {
      filename: '_meta.json',
      content: JSON.stringify(meta, null, 2) + '\n',
    }
  },

  mergeNavConfig(existing: Record<string, unknown>, pages: ResolvedPage[]): NavConfigOutput {
    const merged: Record<string, unknown> = { ...existing }

    // Add new pages that don't exist in the current config
    for (const page of pages) {
      const name = page.slug === 'index' ? 'index' : page.slug.split('/').pop()!
      if (!(name in merged)) {
        merged[name] = page.title ?? name
      }
    }

    return {
      filename: '_meta.json',
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
    return ["import { Callout } from 'nextra/components'"]
  },
}
