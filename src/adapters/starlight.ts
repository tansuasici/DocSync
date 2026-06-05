import type { Blockquote, RootContent, Html } from 'mdast'
import type { AlertType } from '../transform/gfm-alerts.js'
import type { ResolvedPage } from '../core/source-resolver.js'
import type { TargetAdapter, NavConfigOutput } from './types.js'

/**
 * Alert type mapping: GFM → Starlight aside type
 *
 * Starlight aside types: note, tip, caution, danger
 */
const ALERT_TYPE_MAP: Record<AlertType, string> = {
  note: 'note',
  tip: 'tip',
  important: 'note',
  warning: 'caution',
  caution: 'danger',
}

export const starlightAdapter: TargetAdapter = {
  name: 'starlight',

  transformAlert(type: AlertType, node: Blockquote): RootContent[] {
    const asideType = ALERT_TYPE_MAP[type]

    // Starlight uses ::: directive syntax (Astro-flavored). Keep the
    // alert's children as real nodes between the markers so the aside body
    // keeps its markdown formatting.
    const open: Html = { type: 'html', value: `:::${asideType}` }
    const close: Html = { type: 'html', value: ':::' }

    return [open, ...node.children, close]
  },

  generateNavConfig(): NavConfigOutput | null {
    // Starlight uses frontmatter sidebar config + astro.config.mjs
    // No separate nav config file needed
    return null
  },

  generateFrontmatter(page: ResolvedPage): Record<string, unknown> {
    const fm: Record<string, unknown> = {
      title: page.title ?? 'Untitled',
    }

    if (page.description) {
      fm.description = page.description
    }

    // Starlight uses nested sidebar config in frontmatter
    fm.sidebar = { order: page.order }

    return fm
  },
}
