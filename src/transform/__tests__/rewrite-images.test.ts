import { describe, it, expect } from 'vitest'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkStringify from 'remark-stringify'
import remarkGfm from 'remark-gfm'
import { remarkRewriteImages } from '../rewrite-images.js'
import type { ResolvedPage } from '../../core/source-resolver.js'

const github = { repo: 'user/repo', branch: 'main' }
const page: ResolvedPage = {
  filePath: '/project/docs/guide.md',
  relativePath: 'docs/guide.md',
  slug: 'guide',
  order: 0,
}

async function processMarkdown(input: string) {
  const processor = (unified() as any)
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRewriteImages, { github, page })
    .use(remarkStringify)

  return String(await processor.process(input))
}

describe('remarkRewriteImages', () => {
  it('should rewrite markdown image syntax with relative paths', async () => {
    const result = await processMarkdown('![logo](./assets/logo.png)')
    expect(result).toContain(
      'https://raw.githubusercontent.com/user/repo/main/docs/assets/logo.png',
    )
  })

  it('should pass through absolute URLs in markdown images', async () => {
    const result = await processMarkdown('![logo](https://example.com/logo.png)')
    expect(result).toContain('https://example.com/logo.png')
  })

  it('should rewrite HTML <img> tags with relative src', async () => {
    const result = await processMarkdown(
      '<img src="./assets/screenshot.png" alt="screenshot" />',
    )
    expect(result).toContain(
      'https://raw.githubusercontent.com/user/repo/main/docs/assets/screenshot.png',
    )
  })

  it('should pass through absolute URLs in HTML <img> tags', async () => {
    const result = await processMarkdown(
      '<img src="https://example.com/img.png" alt="external" />',
    )
    expect(result).toContain('https://example.com/img.png')
  })

  it('should handle <img> with double quotes', async () => {
    const result = await processMarkdown(
      '<img src="../images/arch.png" width="600" />',
    )
    expect(result).toContain(
      'https://raw.githubusercontent.com/user/repo/main/images/arch.png',
    )
  })

  it('should handle <img> with single quotes', async () => {
    const result = await processMarkdown(
      "<img src='./diagram.svg' alt='diagram' />",
    )
    expect(result).toContain(
      'https://raw.githubusercontent.com/user/repo/main/docs/diagram.svg',
    )
  })
})
