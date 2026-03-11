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

  generateNavConfig(pages: ResolvedPage[]): NavConfigOutput {
    const pageNames = pages.map((p) => {
      // meta.json uses filenames without extension
      const parts = p.slug.split('/')
      return parts[parts.length - 1]
    })

    const meta = {
      title: 'Documentation',
      pages: pageNames,
    }

    return {
      filename: 'meta.json',
      content: JSON.stringify(meta, null, 2) + '\n',
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
