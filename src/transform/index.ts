import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkFrontmatter from 'remark-frontmatter'
import remarkStringify from 'remark-stringify'
import { remarkGfmAlerts } from './gfm-alerts.js'
import { remarkEscapeMdx } from './escape-mdx.js'
import { remarkRewriteLinks } from './rewrite-links.js'
import { remarkRewriteImages } from './rewrite-images.js'
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

export async function transformMarkdown(
  source: string,
  ctx: TransformContext,
): Promise<string> {
  // Extract title and description from content if not set in config
  const { title, description, contentWithoutH1 } = extractFrontmatter(source, ctx.page)

  // Generate frontmatter via adapter
  const frontmatter = ctx.adapter.generateFrontmatter({
    ...ctx.page,
    title,
    description,
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const processor = (unified() as any)
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkFrontmatter)
    .use(remarkGfmAlerts, { adapter: ctx.adapter })
    .use(remarkEscapeMdx)
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
  const body = String(file)

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

  return lines.join('\n')
}

function formatYamlValue(value: unknown): string {
  if (typeof value === 'string') {
    // Quote strings that contain special YAML characters
    if (/[:#{}[\],&*?|>!%@`]/.test(value) || value.includes('\n')) {
      return `"${value.replace(/"/g, '\\"')}"`
    }
    return `"${value}"`
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  return JSON.stringify(value)
}
