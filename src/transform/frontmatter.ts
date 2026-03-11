import type { ResolvedPage } from '../core/source-resolver.js'

interface ExtractedFrontmatter {
  title: string
  description?: string
  /** Content with the first H1 heading removed (since it becomes the title) */
  contentWithoutH1: string
}

/**
 * Extract title and description from markdown content.
 *
 * - Title: first # heading, or config override, or filename
 * - Description: first paragraph after the heading
 * - Strips the first H1 from content (it becomes frontmatter title)
 */
export function extractFrontmatter(
  source: string,
  page: ResolvedPage,
): ExtractedFrontmatter {
  const lines = source.split('\n')

  let title = page.title
  let description = page.description
  let h1LineIndex = -1

  // Find first H1
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()

    // Skip empty lines and frontmatter
    if (line === '' || line === '---') continue
    // Stop if we hit frontmatter block
    if (i === 0 && line === '---') {
      const endIndex = lines.indexOf('---', 1)
      if (endIndex !== -1) {
        // Skip existing frontmatter — we'll generate our own
        // TODO: merge existing frontmatter in future version
        continue
      }
    }

    const h1Match = line.match(/^#\s+(.+)$/)
    if (h1Match) {
      if (!title) {
        title = h1Match[1].trim()
      }
      h1LineIndex = i
      break
    }
  }

  // Fallback title from filename
  if (!title) {
    title = page.slug === 'index' ? 'Introduction' : slugToTitle(page.slug)
  }

  // Extract description from first paragraph after H1
  if (!description && h1LineIndex !== -1) {
    for (let i = h1LineIndex + 1; i < lines.length; i++) {
      const line = lines[i].trim()
      if (line === '') continue
      // Stop at headings, code blocks, lists, etc.
      if (line.startsWith('#') || line.startsWith('```') || line.startsWith('-') || line.startsWith('>')) {
        break
      }
      description = line
      break
    }
  }

  // Remove the first H1 line from content
  let contentWithoutH1 = source
  if (h1LineIndex !== -1) {
    const newLines = [...lines]
    newLines.splice(h1LineIndex, 1)
    // Also remove trailing empty line after H1 if present
    if (newLines[h1LineIndex]?.trim() === '') {
      newLines.splice(h1LineIndex, 1)
    }
    contentWithoutH1 = newLines.join('\n')
  }

  return { title, description, contentWithoutH1 }
}

function slugToTitle(slug: string): string {
  const name = slug.split('/').pop() ?? slug
  return name
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}
