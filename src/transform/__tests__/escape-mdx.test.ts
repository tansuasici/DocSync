import { describe, it, expect } from 'vitest'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkStringify from 'remark-stringify'
import { remarkEscapeMdx, restoreMdxEscapes } from '../escape-mdx.js'

async function run(input: string) {
  const processor = (unified() as any)
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkEscapeMdx)
    .use(remarkStringify)
  return restoreMdxEscapes(String(await processor.process(input)))
}

describe('remarkEscapeMdx + restoreMdxEscapes', () => {
  it('escapes curly braces with a SINGLE backslash (valid MDX)', async () => {
    const out = await run('Use {placeholder} here.')
    expect(out).toContain('\\{placeholder\\}')
    // A double backslash would be an MDX compile error.
    expect(out).not.toContain('\\\\{')
  })

  it('escapes bare angle brackets in prose', async () => {
    const out = await run('Compare a < b and c > d.')
    expect(out).toContain('a \\< b')
    expect(out).toContain('c \\> d')
  })

  it('does NOT escape braces inside inline code', async () => {
    const out = await run('Inline `{x}` stays raw.')
    expect(out).toContain('`{x}`')
    expect(out).not.toContain('\\{x\\}')
  })

  it('does NOT escape braces inside fenced code', async () => {
    const out = await run('```\nconst o = {x: 1}\n```')
    expect(out).toContain('{x: 1}')
    expect(out).not.toContain('\\{x')
  })

  it('converts HTML comments to JSX comments', async () => {
    const out = await run('<!-- a note -->')
    expect(out).toContain('{/* a note */}')
    expect(out).not.toContain('<!--')
  })

  it('neutralizes */ inside a comment so it cannot close early', async () => {
    const out = await run('<!-- see a*/b -->')
    expect(out).not.toContain('*/b')
    expect(out).toContain('{/*')
  })

  // A tag MDX would read as an unclosed JSX element ("Expected a closing tag").
  it('escapes a tag that is never closed (prose placeholder)', async () => {
    const out = await run('Replace <placeholder> with your value.')
    expect(out).toContain('\\<placeholder>')
    expect(out).not.toMatch(/(^|[^\\])<placeholder>/)
  })

  it('escapes generic-style tags like List<T>', async () => {
    const out = await run('Returns a List<T> of results.')
    expect(out).toContain('List\\<T>')
  })

  it('escapes a stray closing tag', async () => {
    const out = await run('End </tip> here.')
    expect(out).toContain('\\</tip>')
  })

  it('keeps matched HTML blocks', async () => {
    const out = await run('<details>\n<summary>More</summary>\n\nBody\n\n</details>')
    expect(out).toContain('<details>')
    expect(out).toContain('<summary>More</summary>')
    expect(out).not.toContain('\\<')
  })

  it('keeps matched inline tags', async () => {
    const out = await run('Press <kbd>Ctrl</kbd> now.')
    expect(out).toContain('<kbd>Ctrl</kbd>')
  })

  it('keeps void elements and self-closes them', async () => {
    const out = await run('Line<br>break and <img src="a.png">')
    expect(out).toContain('<br />')
    expect(out).toContain('<img src="a.png" />')
    expect(out).not.toContain('\\<')
  })
})
