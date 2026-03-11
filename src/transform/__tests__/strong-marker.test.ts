import { describe, it, expect } from 'vitest'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkStringify from 'remark-stringify'

describe('strong marker config', () => {
  it('should produce ** for bold text, not ****', async () => {
    const processor = (unified() as any)
      .use(remarkParse)
      .use(remarkGfm)
      .use(remarkStringify, {
        bullet: '-',
        emphasis: '*',
        strong: '*',
        rule: '-',
      })

    const result = await processor.process('This is **bold** text')
    const output = String(result)

    expect(output).toContain('**bold**')
    expect(output).not.toContain('****bold****')
  })

  it('should throw with strong: "**" (invalid marker)', async () => {
    const processor = (unified() as any)
      .use(remarkParse)
      .use(remarkGfm)
      .use(remarkStringify, {
        bullet: '-',
        emphasis: '*',
        strong: '**',
        rule: '-',
      })

    await expect(
      processor.process('This is **bold** text'),
    ).rejects.toThrow('Cannot serialize strong')
  })
})
