import type { Blockquote, RootContent, Html } from 'mdast'
import type { AlertType } from '../transform/gfm-alerts.js'
import type { ResolvedPage } from '../core/source-resolver.js'
import type { TargetAdapter, NavConfigOutput } from './types.js'

/**
 * Alert type mapping: GFM → Docusaurus admonition type
 *
 * Docusaurus types: note, tip, info, warning, danger
 */
const ALERT_TYPE_MAP: Record<AlertType, string> = {
  note: 'note',
  tip: 'tip',
  important: 'info',
  warning: 'warning',
  caution: 'danger',
}

export const docusaurusAdapter: TargetAdapter = {
  name: 'docusaurus',

  transformAlert(type: AlertType, node: Blockquote): RootContent[] {
    const admonitionType = ALERT_TYPE_MAP[type]

    // Docusaurus uses ::: directive syntax. Keep the alert's children as
    // real nodes between the markers so the admonition body keeps its
    // markdown formatting.
    const open: Html = { type: 'html', value: `:::${admonitionType}` }
    const close: Html = { type: 'html', value: ':::' }

    return [open, ...node.children, close]
  },

  generateNavConfig(_pages: ResolvedPage[]): NavConfigOutput {
    const category = {
      label: 'Documentation',
      position: 1,
      link: {
        type: 'generated-index',
      },
    }

    return {
      filename: '_category_.json',
      content: JSON.stringify(category, null, 2) + '\n',
    }
  },

  mergeNavConfig(existing: Record<string, unknown>, _pages: ResolvedPage[]): NavConfigOutput {
    // Docusaurus _category_.json has no page list — preserve user customizations entirely,
    // only fill in missing defaults
    const defaults = {
      label: 'Documentation',
      position: 1,
      link: { type: 'generated-index' },
    }

    const merged = { ...defaults, ...existing }

    return {
      filename: '_category_.json',
      content: JSON.stringify(merged, null, 2) + '\n',
    }
  },

  generateFrontmatter(page: ResolvedPage): Record<string, unknown> {
    const fm: Record<string, unknown> = {
      title: page.title ?? 'Untitled',
      sidebar_position: page.order,
    }

    if (page.description) {
      fm.description = page.description
    }

    if (page.slug === 'index') {
      fm.slug = '/'
    }

    return fm
  },
}
