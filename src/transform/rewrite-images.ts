import path from 'node:path'
import { visit } from 'unist-util-visit'
import type { Plugin } from 'unified'
import type { Root, Image } from 'mdast'
import type { ResolvedPage } from '../core/source-resolver.js'

interface RewriteImagesOptions {
  github?: { repo: string; branch: string }
  page: ResolvedPage
}

/**
 * Remark plugin that rewrites relative image paths to GitHub raw URLs.
 *
 * Examples:
 *   ./assets/logo.png → https://raw.githubusercontent.com/user/repo/main/assets/logo.png
 *   https://example.com/img.png → https://example.com/img.png (pass-through)
 */
export const remarkRewriteImages: Plugin<[RewriteImagesOptions], Root> = (options) => {
  return (tree) => {
    visit(tree, 'image', (node: Image) => {
      const url = node.url

      // Skip absolute URLs
      if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
        return
      }

      // If no GitHub config, leave relative paths as-is
      if (!options.github) return

      // Resolve relative path against current file's directory
      const currentDir = path.dirname(options.page.relativePath)
      const resolvedPath = path.normalize(path.join(currentDir, url))

      const { repo, branch } = options.github
      node.url = `https://raw.githubusercontent.com/${repo}/${branch}/${resolvedPath}`
    })
  }
}
