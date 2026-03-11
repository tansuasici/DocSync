import { visit } from 'unist-util-visit'
import type { Plugin } from 'unified'
import type { Blockquote, Root } from 'mdast'
import type { TargetAdapter } from '../adapters/types.js'

export type AlertType = 'note' | 'tip' | 'important' | 'warning' | 'caution'

interface GfmAlertsOptions {
  adapter: TargetAdapter
}

const ALERT_PATTERN = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/i

/**
 * Remark plugin that transforms GitHub-style alerts in blockquotes:
 *   > [!NOTE]
 *   > Content here
 *
 * Into framework-specific callout components via the adapter.
 */
export const remarkGfmAlerts: Plugin<[GfmAlertsOptions], Root> = (options) => {
  return (tree) => {
    visit(tree, 'blockquote', (node: Blockquote, index, parent) => {
      if (!parent || index === undefined) return

      // Check first child for alert marker
      const firstChild = node.children[0]
      if (!firstChild || firstChild.type !== 'paragraph') return

      const firstInline = firstChild.children[0]
      if (!firstInline || firstInline.type !== 'text') return

      const match = firstInline.value.match(ALERT_PATTERN)
      if (!match) return

      const alertType = match[1].toLowerCase() as AlertType

      // Remove the alert marker from the text
      firstInline.value = firstInline.value.replace(ALERT_PATTERN, '')

      // If the first text node is now empty, remove it
      if (firstInline.value.trim() === '') {
        firstChild.children.shift()
      }

      // If the first paragraph is now empty, remove it
      if (firstChild.children.length === 0) {
        node.children.shift()
      }

      // Let the adapter transform the alert
      const replacement = options.adapter.transformAlert(alertType, node)
      if (replacement) {
        parent.children[index] = replacement
      }
    })
  }
}
