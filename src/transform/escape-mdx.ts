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
 * - tags with no matching open/close in the document (`<placeholder>`) → `\<…>`
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

    // Tag names that are opened / closed anywhere in the document. MDX
    // requires every non-void element to be closed, so a tag with no
    // counterpart is prose that CommonMark happened to parse as raw HTML —
    // `<placeholder>`, `<skill-name>`, `List<T>` — and must be escaped.
    const opened = new Set<string>()
    const closed = new Set<string>()
    visit(tree, 'html', (node: Html) => {
      for (const m of node.value.matchAll(TAG)) {
        if (m[1]) closed.add(m[2])
        else opened.add(m[2])
      }
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

      // Escape unmatched tags. html node values are emitted verbatim by
      // remark-stringify, so the `\<` needs no sentinel here.
      node.value = node.value.replace(TAG, (tag, slash: string, name: string, selfClose: string) => {
        if (selfClose || VOID_ELEMENTS.has(name.toLowerCase())) return tag
        const matched = slash ? opened.has(name) : closed.has(name)
        return matched ? tag : `\\${tag}`
      })

      // Self-close void elements so they're valid JSX.
      node.value = node.value.replace(
        /<(br|hr|img|input|meta|link)(\s[^>]*)?\s*>/gi,
        '<$1$2 />',
      )
    })
  }
}

/** An opening, closing, or self-closing tag: [full, "/"?, name, "/"?] */
const TAG = /<(\/?)([A-Za-z][A-Za-z0-9-]*)(?:\s[^<>]*?)?\s*(\/?)>/g

const VOID_ELEMENTS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'source', 'track', 'wbr',
])

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
