import path from 'node:path'
import fs from 'node:fs/promises'
import fg from 'fast-glob'
import type { SourceEntry } from '../config/schema.js'

export interface ResolvedPage {
  /** Absolute file path */
  filePath: string
  /** Repo-relative file path */
  relativePath: string
  /** URL slug (no leading slash, no extension) */
  slug: string
  /** Page title (from config or extracted later from content) */
  title?: string
  /** Page description (from config or extracted later from content) */
  description?: string
  /** Sidebar order */
  order: number
}

export async function resolveSourceFiles(
  sources: SourceEntry[],
  cwd: string,
): Promise<ResolvedPage[]> {
  const pages: ResolvedPage[] = []
  let autoOrder = 0

  for (const source of sources) {
    const matches = await fg(source.path, {
      cwd,
      onlyFiles: true,
      absolute: false,
    })

    if (matches.length === 0) {
      console.warn(`[docsync] No files matched: ${source.path}`)
      continue
    }

    // Sort for deterministic ordering
    matches.sort()

    for (const match of matches) {
      const filePath = path.resolve(cwd, match)

      // Verify file exists and is readable
      await fs.access(filePath, fs.constants.R_OK)

      const slug = source.slug ?? deriveSlug(match)
      const order = source.order ?? autoOrder++

      pages.push({
        filePath,
        relativePath: match,
        slug,
        title: source.title,
        description: source.description,
        order,
      })
    }
  }

  // Deduplicate by slug (first entry wins)
  const seen = new Set<string>()
  const deduped: ResolvedPage[] = []
  for (const page of pages) {
    if (!seen.has(page.slug)) {
      seen.add(page.slug)
      deduped.push(page)
    } else {
      console.warn(
        `[docsync] Duplicate slug "${page.slug}" from ${page.relativePath} — skipped`,
      )
    }
  }

  // Sort by order
  deduped.sort((a, b) => a.order - b.order)

  return deduped
}

/**
 * Derive a URL slug from a file path.
 *
 * Examples:
 *   README.md → index
 *   docs/getting-started.md → getting-started
 *   docs/guides/setup.md → guides/setup
 */
function deriveSlug(filePath: string): string {
  const parsed = path.parse(filePath)
  const name = parsed.name.toLowerCase()

  // README → index
  if (name === 'readme') {
    // If it's in a subdirectory, use the directory path
    if (parsed.dir && parsed.dir !== '.') {
      return stripDocsPrefix(parsed.dir) + '/index'
    }
    return 'index'
  }

  const dir = parsed.dir && parsed.dir !== '.' ? stripDocsPrefix(parsed.dir) : ''
  const slug = dir ? `${dir}/${name}` : name

  return slug
}

/**
 * Strip common docs directory prefixes.
 * docs/guides/foo → guides/foo
 */
function stripDocsPrefix(dir: string): string {
  return dir.replace(/^docs\/?/, '')
}
