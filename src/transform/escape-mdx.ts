import { visit } from 'unist-util-visit'
import type { Plugin } from 'unified'
import type { Root, Text, Html } from 'mdast'

/**
 * Private-use sentinels for MDX-unsafe characters.
 *
 * We can't write the final `\{` / `\<` escapes directly onto text nodes:
 * remark-stringify escapes the backslash itself, so `\{` becomes `\\{` in
 * the output — which MDX reads as an escaped backslash followed by an
 * expression `{...}`, a hard compile error. Instead we stash sentinels
 * (private-use code points U+E000–U+E003, which remark-stringify passes
 * through untouched) on the text nodes and swap them for the real escapes
 * in {@link restoreMdxEscapes}, after the markdown has been serialized.
 */
const S_LBRACE = String.fromCharCode(0xe000)
const S_RBRACE = String.fromCharCode(0xe001)
const S_LT = String.fromCharCode(0xe002)
const S_GT = String.fromCharCode(0xe003)
const STRAY_SENTINELS = new RegExp(`[${S_LBRACE}-${S_GT}]`, 'g')

/**
 * Remark plugin that escapes MDX-breaking syntax in text nodes:
 * - `{` `}` → `\{` `\}`
 * - bare `<` `>` (not part of an HTML tag) → `\<` `\>`
 * - `<!-- ... -->` HTML comments → JSX comments
 *
 * Text-node escapes are emitted as sentinels here and finalized by
 * {@link restoreMdxEscapes}. Code spans and code blocks are separate mdast
 * node types, so this never touches code.
 */
export const remarkEscapeMdx: Plugin<[], Root> = () => {
  return (tree) => {
    visit(tree, 'text', (node: Text) => {
      node.value = node.value
        // Drop any pre-existing sentinels (defensive — should never occur
        // in real markdown, but avoids corruption if they somehow appear).
        .replace(STRAY_SENTINELS, '')
        // Curly braces are always unsafe in MDX text.
        .replace(/\{/g, S_LBRACE)
        .replace(/\}/g, S_RBRACE)
        // A bare `<` not starting a tag name, `/`, or `!` (comment/doctype).
        .replace(/<(?![a-zA-Z/!])/g, S_LT)
        // A bare `>` not closing a tag or attribute value.
        .replace(/(?<![a-zA-Z"'/])>/g, S_GT)
    })

    // Convert HTML comments to JSX comments and self-close void elements.
    visit(tree, 'html', (node: Html, index, parent) => {
      if (!parent || index === undefined) return

      const commentMatch = node.value.match(/^<!--\s*([\s\S]*?)\s*-->$/)
      if (commentMatch) {
        // Break any `*/` inside the comment so it can't close the JSX
        // comment early (comments aren't rendered, so this is invisible).
        const inner = commentMatch[1].replace(/\*\//g, '* /')
        node.value = `{/* ${inner} */}`
        return
      }

      // Self-close void elements so they're valid JSX.
      node.value = node.value.replace(
        /<(br|hr|img|input|meta|link)(\s[^>]*)?\s*>/gi,
        '<$1$2 />',
      )
    })
  }
}

/**
 * Swap the private-use sentinels inserted by {@link remarkEscapeMdx} for
 * their real MDX escapes. Must run on the serialized markdown string
 * (after remark-stringify) so the backslashes are emitted verbatim.
 */
export function restoreMdxEscapes(serialized: string): string {
  return serialized
    .split(S_LBRACE)
    .join('\\{')
    .split(S_RBRACE)
    .join('\\}')
    .split(S_LT)
    .join('\\<')
    .split(S_GT)
    .join('\\>')
}
