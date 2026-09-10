import { describe, it, expect } from 'vitest'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkStringify from 'remark-stringify'
import { remarkUnwrapHeadingLinks } from '../unwrap-heading-links.js'

async function run(input: string) {
  const processor = (unified() as any)
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkUnwrapHeadingLinks)
    .use(remarkStringify)
  return String(await processor.process(input))
}

describe('remarkUnwrapHeadingLinks', () => {
  it('replaces a release-please version link with its text', async () => {
    const out = await run(
      '## [1.2.0](https://github.com/o/r/compare/v1.1.0...v1.2.0) (2026-01-01)',
    )
    expect(out.trim()).toBe('## 1.2.0 (2026-01-01)')
  })

  it('unwraps links nested in emphasis', async () => {
    const out = await run('### **[Start](./start.md)** here')
    expect(out.trim()).toBe('### **Start** here')
  })

  it('unwraps reference-style links', async () => {
    const out = await run('## [Title][ref]\n\n[ref]: https://example.com')
    expect(out).toContain('## Title\n')
  })

  it('leaves links outside headings alone', async () => {
    const out = await run('# Heading\n\nSee [docs](https://example.com).')
    expect(out).toContain('[docs](https://example.com)')
  })
})
