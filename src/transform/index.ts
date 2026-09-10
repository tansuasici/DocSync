import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkFrontmatter from 'remark-frontmatter'
import remarkStringify from 'remark-stringify'
import { remarkGfmAlerts } from './gfm-alerts.js'
import { remarkEscapeMdx, restoreMdxEscapes } from './escape-mdx.js'
import { remarkRewriteLinks } from './rewrite-links.js'
import { remarkRewriteImages } from './rewrite-images.js'
import { remarkUnwrapHeadingLinks } from './unwrap-heading-links.js'
import { extractFrontmatter } from './frontmatter.js'
import type { ResolvedPage } from '../core/source-resolver.js'
import type { DocSyncConfig } from '../config/schema.js'
import type { TargetAdapter } from '../adapters/types.js'

export interface TransformContext {
  page: ResolvedPage
  slugMap: Map<string, string>
  adapter: TargetAdapter
  config: DocSyncConfig
}

export interface TransformResult {
  content: string
  /** Resolved page title (config override, first H1, or fallback) */
  title: string
}

export async function transformMarkdown(
  source: string,
  ctx: TransformContext,
): Promise<TransformResult> {
  // Extract title and description from content if not set in config
  const { title, description, contentWithoutH1 } = extractFrontmatter(source, ctx.page)

  // Generate frontmatter via adapter
  const frontmatter = ctx.adapter.generateFrontmatter({
    ...ctx.page,
    title,
    description,
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let processor = (unified() as any)
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkFrontmatter)
    // Escape before alerts: the adapter's injected callout tags (e.g.
    // `<Callout>` … `</Callout>`) must not be seen as source HTML.
    .use(remarkEscapeMdx)
    .use(remarkGfmAlerts, { adapter: ctx.adapter })

  if (ctx.adapter.unwrapHeadingLinks) {
    processor = processor.use(remarkUnwrapHeadingLinks)
  }

  processor = processor
    .use(remarkRewriteLinks, {
      slugMap: ctx.slugMap,
      baseUrl: ctx.config.baseUrl,
      page: ctx.page,
    })
    .use(remarkRewriteImages, {
      github: ctx.config.github,
      page: ctx.page,
    })
    .use(remarkStringify, {
      bullet: '-',
      emphasis: '*',
      strong: '*',
      rule: '-',
    })

  const file = await processor.process(contentWithoutH1)
  // Finalize MDX escapes: the escape plugin stashed sentinels on text
  // nodes; now that the markdown is serialized we can swap them for the
  // real `\{` / `\<` escapes without remark-stringify doubling the
  // backslash.
  const body = restoreMdxEscapes(String(file))

  // Build final MDX output
  const lines: string[] = []

  // Frontmatter block
  lines.push('---')
  for (const [key, value] of Object.entries(frontmatter)) {
    if (value !== undefined && value !== null) {
      lines.push(`${key}: ${formatYamlValue(value)}`)
    }
  }
  lines.push('---')
  lines.push('')

  // Imports (from adapter)
  const imports = ctx.adapter.getImports?.()
  if (imports && imports.length > 0) {
    lines.push(...imports)
    lines.push('')
  }

  // Body
  lines.push(body.trim())
  lines.push('')

  return { content: lines.join('\n'), title }
}

function formatYamlValue(value: unknown): string {
  if (typeof value === 'string') {
    // Always double-quote, escaping the characters that are special inside
    // a YAML double-quoted scalar. Backslash MUST come first, otherwise a
    // value like `Use \n for newline` would be read by YAML as a real
    // newline. Newlines are escaped so the value stays on one line.
    const escaped = value
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
    return `"${escaped}"`
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  return JSON.stringify(value)
}
