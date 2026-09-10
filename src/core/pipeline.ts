import fs from 'node:fs/promises'
import path from 'node:path'
import type { DocSyncConfig } from '../config/schema.js'
import { resolveSourceFiles, type ResolvedPage } from './source-resolver.js'
import { transformMarkdown } from '../transform/index.js'
import { getAdapter } from '../adapters/index.js'

export interface BuildResult {
  pages: { slug: string; outputPath: string }[]
  errors: { file: string; error: string }[]
  /** Non-fatal problems, e.g. nav entries that match nothing */
  warnings: string[]
}

export async function buildPipeline(
  config: DocSyncConfig,
  cwd: string,
): Promise<BuildResult> {
  const adapter = getAdapter(config.target)
  const pages = await resolveSourceFiles(config.sources, cwd)
  const outDir = path.resolve(cwd, config.outDir)

  // Clean output directory if configured
  if (config.clean) {
    await fs.rm(outDir, { recursive: true, force: true })
  }
  await fs.mkdir(outDir, { recursive: true })

  const result: BuildResult = { pages: [], errors: [], warnings: [] }

  // Build a slug map for link rewriting
  const slugMap = buildSlugMap(pages)

  // Pages as the nav generators see them: with the title resolved during
  // transform (first H1), not just the config override.
  const navPages: ResolvedPage[] = []

  // Transform each page
  for (const page of pages) {
    navPages.push(page)
    try {
      const source = await fs.readFile(page.filePath, 'utf-8')

      const { content, title } = await transformMarkdown(source, {
        page,
        slugMap,
        adapter,
        config,
      })
      navPages[navPages.length - 1] = { ...page, title }

      const outputPath = path.join(outDir, `${page.slug}.mdx`)
      await fs.mkdir(path.dirname(outputPath), { recursive: true })
      await fs.writeFile(outputPath, content, 'utf-8')

      result.pages.push({ slug: page.slug, outputPath })
    } catch (err) {
      result.errors.push({
        file: page.relativePath,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  if (config.nav && !adapter.supportsNav) {
    result.warnings.push(`"nav" is not supported by the ${adapter.name} target — ignored`)
  }

  // Generate navigation config
  if (adapter.generatePerDirectoryNavConfig) {
    const navConfigs = adapter.generatePerDirectoryNavConfig(navPages, config.nav)
    for (const [, navConfig] of navConfigs) {
      const navPath = path.join(outDir, navConfig.filename)
      await fs.mkdir(path.dirname(navPath), { recursive: true })

      // Merge with an existing file (only possible when clean is false —
      // otherwise the outDir was just wiped) to preserve user edits.
      // Explicit `nav` entries are the source of truth and never merged.
      let content = navConfig.content
      if (!navConfig.explicit && adapter.mergePerDirectoryNavConfig) {
        const existingContent = await fs.readFile(navPath, 'utf-8').catch(() => undefined)
        if (existingContent !== undefined) {
          let existing: Record<string, unknown>
          try {
            existing = adapter.parseNavConfig
              ? adapter.parseNavConfig(existingContent)
              : (JSON.parse(existingContent) as Record<string, unknown>)
          } catch {
            // Never clobber a file we can't read back (e.g. hand-written JS).
            result.warnings.push(
              `${navConfig.filename}: existing file could not be parsed — left untouched`,
            )
            continue
          }
          content = adapter.mergePerDirectoryNavConfig(existing, navConfig).content
        }
      }
      await fs.writeFile(navPath, content, 'utf-8')

      if (adapter.validateNavConfig) {
        const available = await listNavEntries(path.dirname(navPath))
        result.warnings.push(
          ...adapter.validateNavConfig({ ...navConfig, content }, available),
        )
      }
    }
  } else {
    const navConfig = adapter.generateNavConfig(navPages)
    if (navConfig) {
      const navPath = path.join(outDir, navConfig.filename)

      // Merge with existing file if adapter supports it
      if (adapter.mergeNavConfig) {
        try {
          const existingContent = await fs.readFile(navPath, 'utf-8')
          const existing = JSON.parse(existingContent) as Record<string, unknown>
          const merged = adapter.mergeNavConfig(existing, navPages)
          await fs.writeFile(navPath, merged.content, 'utf-8')
        } catch {
          // File doesn't exist or invalid JSON — write fresh
          await fs.writeFile(navPath, navConfig.content, 'utf-8')
        }
      } else {
        await fs.writeFile(navPath, navConfig.content, 'utf-8')
      }
    }
  }

  return result
}

/**
 * Names a nav config in `dir` can refer to: pages (file name without
 * `.md`/`.mdx`) and subfolders that contain pages. Includes pages written by
 * other tools, not just DocSync's own output.
 */
async function listNavEntries(dir: string): Promise<Set<string>> {
  const names = new Set<string>()
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue
    if (entry.isDirectory()) {
      if (await containsPages(path.join(dir, entry.name))) names.add(entry.name)
    } else if (PAGE_FILE.test(entry.name)) {
      names.add(entry.name.replace(PAGE_FILE, ''))
    }
  }
  return names
}

const PAGE_FILE = /\.mdx?$/

async function containsPages(dir: string): Promise<boolean> {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    if (entry.isFile() && PAGE_FILE.test(entry.name)) return true
    if (entry.isDirectory() && (await containsPages(path.join(dir, entry.name)))) return true
  }
  return false
}

/**
 * Build a map from relative file paths to slugs for link rewriting.
 * Key: repo-relative path (e.g., "docs/guide.md")
 * Value: slug (e.g., "guide")
 */
function buildSlugMap(pages: ResolvedPage[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const page of pages) {
    map.set(page.relativePath, page.slug)
    // Also map with ./ prefix
    map.set(`./${page.relativePath}`, page.slug)
  }
  return map
}
