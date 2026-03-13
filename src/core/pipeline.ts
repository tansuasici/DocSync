import fs from 'node:fs/promises'
import path from 'node:path'
import type { DocSyncConfig } from '../config/schema.js'
import { resolveSourceFiles, type ResolvedPage } from './source-resolver.js'
import { transformMarkdown } from '../transform/index.js'
import { getAdapter } from '../adapters/index.js'

export interface BuildResult {
  pages: { slug: string; outputPath: string }[]
  errors: { file: string; error: string }[]
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

  const result: BuildResult = { pages: [], errors: [] }

  // Build a slug map for link rewriting
  const slugMap = buildSlugMap(pages)

  // Transform each page
  for (const page of pages) {
    try {
      const source = await fs.readFile(page.filePath, 'utf-8')

      const mdx = await transformMarkdown(source, {
        page,
        slugMap,
        adapter,
        config,
      })

      const outputPath = path.join(outDir, `${page.slug}.mdx`)
      await fs.mkdir(path.dirname(outputPath), { recursive: true })
      await fs.writeFile(outputPath, mdx, 'utf-8')

      result.pages.push({ slug: page.slug, outputPath })
    } catch (err) {
      result.errors.push({
        file: page.relativePath,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  // Generate navigation config
  const navConfig = adapter.generateNavConfig(pages)
  if (navConfig) {
    const navPath = path.join(outDir, navConfig.filename)

    // Merge with existing file if adapter supports it
    if (adapter.mergeNavConfig) {
      try {
        const existingContent = await fs.readFile(navPath, 'utf-8')
        const existing = JSON.parse(existingContent) as Record<string, unknown>
        const merged = adapter.mergeNavConfig(existing, pages)
        await fs.writeFile(navPath, merged.content, 'utf-8')
      } catch {
        // File doesn't exist or invalid JSON — write fresh
        await fs.writeFile(navPath, navConfig.content, 'utf-8')
      }
    } else {
      await fs.writeFile(navPath, navConfig.content, 'utf-8')
    }
  }

  return result
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
