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

      const slug = source.slug ?? deriveSlug(match, source.rootDir)
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

  // Deduplicate by slug AND file path (first entry wins)
  const seenSlugs = new Set<string>()
  const seenFiles = new Set<string>()
  const deduped: ResolvedPage[] = []
  for (const page of pages) {
    if (seenFiles.has(page.filePath)) {
      continue // same file already mapped via an earlier explicit entry
    }
    if (seenSlugs.has(page.slug)) {
      console.warn(
        `[docsync] Duplicate slug "${page.slug}" from ${page.relativePath} — skipped`,
      )
      continue
    }
    seenSlugs.add(page.slug)
    seenFiles.add(page.filePath)
    deduped.push(page)
  }

  // Sort by order
  deduped.sort((a, b) => a.order - b.order)

  return deduped
}

/**
 * Derive a URL slug from a file path.
 *
 * When `rootDir` is provided, it is stripped from the path before deriving
 * the slug. This is essential for glob-based sources where the matched
 * path includes a long prefix (e.g. `../TnsAI.Docs/features/core/agents.md`
 * with rootDir `../TnsAI.Docs/features` → slug `core/agents`).
 *
 * Examples (no rootDir):
 *   README.md → index
 *   docs/getting-started.md → getting-started
 *   docs/guides/setup.md → guides/setup
 *
 * Examples (with rootDir):
 *   ../Repo/features/core/agents.md  (rootDir: ../Repo/features) → core/agents
 *   ../Repo/architecture/lam.md      (rootDir: ../Repo)          → architecture/lam
 */
function deriveSlug(filePath: string, rootDir?: string): string {
  let effective = filePath

  if (rootDir) {
    const prefix = rootDir.replace(/\/$/, '') + '/'
    if (effective.startsWith(prefix)) {
      effective = effective.slice(prefix.length)
    }
  }

  const parsed = path.parse(effective)
  const name = parsed.name.toLowerCase()

  // README → index
  if (name === 'readme') {
    if (parsed.dir && parsed.dir !== '.') {
      const dir = rootDir ? parsed.dir : stripDocsPrefix(parsed.dir)
      return `${dir}/index`
    }
    return 'index'
  }

  const rawDir = parsed.dir && parsed.dir !== '.' ? parsed.dir : ''
  const dir = rootDir ? rawDir : (rawDir ? stripDocsPrefix(rawDir) : '')
  return dir ? `${dir}/${name}` : name
}

/**
 * Strip relative path prefixes (../) and common docs directory prefixes.
 * ../kit/agent_docs → kit/agent_docs
 * docs/guides/foo → guides/foo
 */
function stripDocsPrefix(dir: string): string {
  return dir
    .replace(/^(\.\.\/)+/, '')
    .replace(/^\.\//, '')
    .replace(/^docs\/?/, '')
}
