import path from 'node:path'
import { visit } from 'unist-util-visit'
import type { Plugin } from 'unified'
import type { Root, Image, Html } from 'mdast'
import type { ResolvedPage } from '../core/source-resolver.js'

interface RewriteImagesOptions {
  github?: { repo: string; branch: string; rootDir?: string }
  page: ResolvedPage
}

function resolveImageUrl(
  url: string,
  page: ResolvedPage,
  github: { repo: string; branch: string; rootDir?: string },
): string {
  // Skip absolute URLs
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    return url
  }

  // Use path.posix throughout: the result becomes part of a raw.github URL,
  // which must use forward slashes. On Windows the platform path module
  // would emit backslashes and produce a broken URL.
  const currentDir = path.posix.dirname(page.relativePath)
  const resolvedPath = path.posix.normalize(path.posix.join(currentDir, url))
  const rootDir = path.posix.normalize(github.rootDir ?? '.')
  const repoRelativePath = path.posix.relative(rootDir, resolvedPath)

  return `https://raw.githubusercontent.com/${github.repo}/${github.branch}/${repoRelativePath}`
}

/**
 * Remark plugin that rewrites relative image paths to GitHub raw URLs.
 *
 * Handles both markdown images (![](url)) and HTML <img> tags.
 */
export const remarkRewriteImages: Plugin<[RewriteImagesOptions], Root> = (options) => {
  return (tree) => {
    // If no GitHub config, leave relative paths as-is
    if (!options.github) return

    const github = options.github

    // Rewrite markdown images: ![alt](url)
    visit(tree, 'image', (node: Image) => {
      node.url = resolveImageUrl(node.url, options.page, github)
    })

    // Rewrite HTML <img> tags
    visit(tree, 'html', (node: Html) => {
      if (!/<img\s/i.test(node.value)) return

      node.value = node.value.replace(
        /(<img\s[^>]*?\bsrc=["'])([^"']+)(["'])/gi,
        (_match, prefix, src, suffix) => {
          const rewritten = resolveImageUrl(src, options.page, github)
          return `${prefix}${rewritten}${suffix}`
        },
      )
    })
  }
}
