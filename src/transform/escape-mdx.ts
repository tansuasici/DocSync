import { visit } from 'unist-util-visit'
import type { Plugin } from 'unified'
import type { Root, Text, Html } from 'mdast'

/**
 * Remark plugin that escapes MDX-breaking syntax in text nodes:
 * - { } → \{ \}
 * - < > in text (not HTML tags) → \< \>
 * - <!-- --> HTML comments → {/* * /} JSX comments
 */
export const remarkEscapeMdx: Plugin<[], Root> = () => {
  return (tree) => {
    // Escape curly braces and angle brackets in text nodes
    visit(tree, 'text', (node: Text) => {
      // Escape curly braces
      node.value = node.value.replace(/([{}])/g, '\\$1')

      // Escape standalone angle brackets (not part of HTML tags)
      // Only escape < that isn't followed by a valid tag name or /
      node.value = node.value.replace(/<(?![a-zA-Z/!])/g, '\\<')
      node.value = node.value.replace(/(?<![a-zA-Z"'/])>/g, '\\>')
    })

    // Convert HTML comments to JSX comments
    visit(tree, 'html', (node: Html, index, parent) => {
      if (!parent || index === undefined) return

      const commentMatch = node.value.match(/^<!--\s*([\s\S]*?)\s*-->$/)
      if (commentMatch) {
        node.value = `{/* ${commentMatch[1]} */}`
      }

      // Self-close void elements
      node.value = node.value.replace(
        /<(br|hr|img|input|meta|link)(\s[^>]*)?\s*>/gi,
        '<$1$2 />',
      )
    })
  }
}
