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

  // Find first H1 (start after frontmatter if present), skipping fenced
  // code blocks. Without this, a `# comment` line inside a leading code
  // sample (very common in READMEs) would be mistaken for the page
  // heading — corrupting the title AND stripping that line from the code
  // block in the body.
  const searchStart = frontmatterEndIndex !== -1 ? frontmatterEndIndex + 1 : 0
  let fenceChar: string | null = null
  // Last line of the heading block: same as h1LineIndex for an ATX `#`
  // heading, or the underline line for a setext (`Title` / `=====`) heading.
  let h1LastIndex = -1
  for (let i = searchStart; i < lines.length; i++) {
    const line = lines[i].trim()

    // Track fenced code blocks (``` or ~~~). A fence closes only with the
    // same marker character it opened with.
    const fenceMatch = line.match(/^(`{3,}|~{3,})/)
    if (fenceMatch) {
      const char = fenceMatch[1][0]
      if (fenceChar === null) fenceChar = char
      else if (char === fenceChar) fenceChar = null
      continue
    }
    if (fenceChar !== null) continue // inside a code block — ignore

    if (line === '') continue

    // ATX heading: `# Title`
    const h1Match = line.match(/^#\s+(.+)$/)
    if (h1Match) {
      if (!title) title = h1Match[1].trim()
      h1LineIndex = i
      h1LastIndex = i
      break
    }

    // Setext heading: a prose line directly underlined by `===`.
    const underline = lines[i + 1]?.trim()
    if (underline !== undefined && /^=+$/.test(underline)) {
      if (!title) title = line
      h1LineIndex = i
      h1LastIndex = i + 1
      break
    }
  }

  // Fallback title from filename
  if (!title) {
    title = page.slug === 'index' ? 'Introduction' : slugToTitle(page.slug)
  }

  // Extract description from first paragraph after H1.
  // Description is consumed by adapters as plain text (Fumadocs renders
  // it as the page subtitle below H1; Docusaurus, Starlight, Nextra
  // emit it as <meta name="description"> for SEO). None of those
  // re-parse it as markdown — so we must strip markdown formatting
  // here, otherwise constructs like `[text](url)`, `**bold**`,
  // `` `code` `` show up as raw syntax in the rendered subtitle / SEO
  // tags. We also collect the full multi-line paragraph (not just the
  // first line) so the description matches the visual paragraph the
  // author wrote.
  let descriptionStartIndex = -1
  let descriptionEndIndex = -1
  if (!description && h1LineIndex !== -1) {
    const paragraphLines: string[] = []
    for (let i = h1LastIndex + 1; i < lines.length; i++) {
      const trimmed = lines[i].trim()
      if (trimmed === '') {
        if (paragraphLines.length > 0) break // end of paragraph
        continue // still in leading blank lines after H1
      }
      // Stop at any non-paragraph block. The list / heading markers require
      // a trailing space, so an emphasis-led sentence (`**Note:** ...`, a
      // line starting with `*italic*` or a `- dash`-prefixed word) is NOT
      // mistaken for a list or heading.
      if (
        /^#{1,6}\s/.test(trimmed) || // ATX heading
        trimmed.startsWith('```') ||
        trimmed.startsWith('~~~') ||
        /^[-*+]\s/.test(trimmed) || // bullet list item
        /^\d+[.)]\s/.test(trimmed) || // ordered list item
        trimmed.startsWith('>') || // blockquote
        trimmed.startsWith('<') || // raw HTML block
        trimmed.startsWith('|') || // table row
        /^!\[/.test(trimmed) // image-only line
      ) {
        break
      }
      if (paragraphLines.length === 0) descriptionStartIndex = i
      descriptionEndIndex = i
      paragraphLines.push(trimmed)
    }
    if (paragraphLines.length > 0) {
      description = stripInlineMarkdown(paragraphLines.join(' '))
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

  // Mark the H1 heading for removal (text + setext underline, if any).
  if (h1LineIndex !== -1) {
    for (let i = h1LineIndex; i <= h1LastIndex; i++) {
      linesToRemove.add(i)
    }
    // Also remove the trailing empty line after the heading if present.
    if (lines[h1LastIndex + 1]?.trim() === '') {
      linesToRemove.add(h1LastIndex + 1)
    }
  }

  // Mark description paragraph (possibly multi-line) for removal —
  // it becomes the frontmatter description so we don't want it in
  // the body too.
  if (descriptionStartIndex !== -1 && descriptionEndIndex !== -1) {
    for (let i = descriptionStartIndex; i <= descriptionEndIndex; i++) {
      linesToRemove.add(i)
    }
    // Also remove the trailing empty line after the paragraph.
    if (lines[descriptionEndIndex + 1]?.trim() === '') {
      linesToRemove.add(descriptionEndIndex + 1)
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

/**
 * Strip inline markdown formatting from a string so it's safe to use
 * as the frontmatter `description` field.
 *
 * Handles the constructs that commonly leak into the first paragraph:
 *
 *   - `[text](url)` and `[text][ref]` reference links → `text`
 *   - `![alt](url)` images → `alt`
 *   - `**bold**`, `__bold__`, `*italic*`, `_italic_` → inner text
 *   - `` `code` `` → inner text
 *   - `~~strike~~` → inner text
 *   - Stray inline HTML tags (`<br>`, `<span>`, etc.) → removed
 *   - Collapses runs of whitespace to single spaces
 *
 * NOT a full markdown parser — pragmatic regex chain that handles the
 * common cases inline-paragraph descriptions actually contain. Block-
 * level constructs (headings, lists, code fences, tables, blockquotes,
 * raw HTML blocks) are filtered out at the paragraph-collection step
 * upstream, so we only need to handle inline syntax here.
 */
export function stripInlineMarkdown(text: string): string {
  return text
    // Images first (more specific) — ![alt](url) → alt
    .replace(/!\[([^\]]*)\]\(([^)]*)\)/g, '$1')
    // Inline links [text](url) → text
    .replace(/\[([^\]]+)\]\(([^)]*)\)/g, '$1')
    // Reference links [text][ref] or [text][] → text
    .replace(/\[([^\]]+)\]\[[^\]]*\]/g, '$1')
    // Bold (**x** or __x__) — non-greedy
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    // Italic (*x* or _x_) — be careful not to eat list markers
    .replace(/(?<![*\w])\*(?!\s)([^*\n]+?)(?<!\s)\*(?![*\w])/g, '$1')
    .replace(/(?<![_\w])_(?!\s)([^_\n]+?)(?<!\s)_(?![_\w])/g, '$1')
    // Inline code `x`
    .replace(/`([^`]+)`/g, '$1')
    // Strikethrough ~~x~~
    .replace(/~~(.+?)~~/g, '$1')
    // Stray HTML tags <br>, <span>, etc. — strip the tag, keep content
    .replace(/<\/?[a-zA-Z][^>]*>/g, '')
    // Collapse whitespace runs to single spaces
    .replace(/\s+/g, ' ')
    .trim()
}
