import path from 'node:path'
import { visit } from 'unist-util-visit'
import type { Plugin } from 'unified'
import type { Root, Link } from 'mdast'
import type { ResolvedPage } from '../core/source-resolver.js'

interface RewriteLinksOptions {
  slugMap: Map<string, string>
  baseUrl: string
  page: ResolvedPage
}

/**
 * Remark plugin that rewrites relative markdown links to docs-site URLs.
 *
 * Examples:
 *   ./docs/guide.md       → /docs/guide (if in source map)
 *   ../README.md           → /docs/index (if in source map)
 *   ./src/index.ts         → https://github.com/user/repo/blob/main/src/index.ts (if not in source map)
 *   #section               → #section (pass-through)
 *   https://example.com    → https://example.com (pass-through)
 */
export const remarkRewriteLinks: Plugin<[RewriteLinksOptions], Root> = (options) => {
  return (tree) => {
    visit(tree, 'link', (node: Link) => {
      const url = node.url

      // Skip external links and anchors
      if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('#')) {
        return
      }

      // Split URL and anchor
      const [urlPath, anchor] = url.split('#')

      // Resolve the relative path against the current file's directory
      const currentDir = path.dirname(options.page.relativePath)
      const resolvedPath = path.normalize(path.join(currentDir, urlPath))

      // Check if this file is in our source map
      const slug = options.slugMap.get(resolvedPath) ?? options.slugMap.get(`./${resolvedPath}`)

      if (slug !== undefined) {
        // Rewrite to docs-site URL
        const base = options.baseUrl.replace(/\/$/, '')
        node.url = slug === 'index' ? base : `${base}/${slug}`
        if (anchor) {
          node.url += `#${anchor}`
        }
      }
      // If not in source map, leave as-is (or could rewrite to GitHub URL)
    })
  }
}
