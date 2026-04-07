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
  let frontmatterEndIndex = -1

  // Detect source YAML frontmatter (--- delimited block at start of file)
  if (lines[0]?.trim() === '---') {
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim() === '---') {
        frontmatterEndIndex = i
        break
      }
    }
  }

  // Find first H1 (start after frontmatter if present)
  const searchStart = frontmatterEndIndex !== -1 ? frontmatterEndIndex + 1 : 0
  for (let i = searchStart; i < lines.length; i++) {
    const line = lines[i].trim()
    if (line === '') continue

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
  let descriptionLineIndex = -1
  if (!description && h1LineIndex !== -1) {
    for (let i = h1LineIndex + 1; i < lines.length; i++) {
      const line = lines[i].trim()
      if (line === '') continue
      // Stop at headings, code blocks, lists, etc.
      if (line.startsWith('#') || line.startsWith('```') || line.startsWith('-') || line.startsWith('>')) {
        break
      }
      description = line
      descriptionLineIndex = i
      break
    }
  }

  // Remove source frontmatter and first H1 from content
  const linesToRemove = new Set<number>()

  // Mark frontmatter lines for removal
  if (frontmatterEndIndex !== -1) {
    for (let i = 0; i <= frontmatterEndIndex; i++) {
      linesToRemove.add(i)
    }
    // Also remove empty line after frontmatter
    if (lines[frontmatterEndIndex + 1]?.trim() === '') {
      linesToRemove.add(frontmatterEndIndex + 1)
    }
  }

  // Mark H1 line for removal
  if (h1LineIndex !== -1) {
    linesToRemove.add(h1LineIndex)
    // Also remove trailing empty line after H1 if present
    if (lines[h1LineIndex + 1]?.trim() === '') {
      linesToRemove.add(h1LineIndex + 1)
    }
  }

  // Mark description line for removal (it becomes frontmatter description)
  if (descriptionLineIndex !== -1) {
    linesToRemove.add(descriptionLineIndex)
    // Also remove trailing empty line after description
    if (lines[descriptionLineIndex + 1]?.trim() === '') {
      linesToRemove.add(descriptionLineIndex + 1)
    }
  }

  const contentWithoutH1 =
    linesToRemove.size > 0
      ? lines.filter((_, i) => !linesToRemove.has(i)).join('\n')
      : source

  return { title, description, contentWithoutH1 }
}

function slugToTitle(slug: string): string {
  const name = slug.split('/').pop() ?? slug
  return name
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}
