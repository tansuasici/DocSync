import { visit } from 'unist-util-visit'
import type { Plugin } from 'unified'
import type { Heading, PhrasingContent, Root } from 'mdast'

/**
 * Remark plugin that replaces links inside headings with their text.
 *
 * Some frameworks (Fumadocs) wrap every heading — and its table-of-contents
 * entry — in their own self-anchor `<a href="#id">`. A markdown link inside
 * the heading then renders as an `<a>` nested in an `<a>`: invalid HTML that
 * throws a React hydration error. The classic trigger is a release-please
 * changelog, whose version headings are links:
 *
 *   ## [1.2.0](https://github.com/o/r/compare/v1.1.0...v1.2.0) (2026-01-01)
 *   → ## 1.2.0 (2026-01-01)
 *
 * Only headings are touched; links in body text are left alone.
 */
export const remarkUnwrapHeadingLinks: Plugin<[], Root> = () => {
  return (tree) => {
    visit(tree, 'heading', (node: Heading) => {
      node.children = unwrapLinks(node.children)
    })
  }
}

function unwrapLinks(nodes: PhrasingContent[]): PhrasingContent[] {
  return nodes.flatMap((node): PhrasingContent[] => {
    if (node.type === 'link' || node.type === 'linkReference') {
      return unwrapLinks(node.children)
    }
    if ('children' in node) {
      // Links can sit inside emphasis/strong/delete — recurse into those.
      return [{ ...node, children: unwrapLinks(node.children as PhrasingContent[]) } as PhrasingContent]
    }
    return [node]
  })
}
