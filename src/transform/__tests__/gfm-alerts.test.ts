import { describe, it, expect } from 'vitest'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkStringify from 'remark-stringify'
import { remarkGfmAlerts } from '../gfm-alerts.js'
import { fumadocsAdapter } from '../../adapters/fumadocs.js'
import { docusaurusAdapter } from '../../adapters/docusaurus.js'
import type { TargetAdapter } from '../../adapters/types.js'

async function run(input: string, adapter: TargetAdapter = fumadocsAdapter) {
  const processor = (unified() as any)
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkGfmAlerts, { adapter })
    .use(remarkStringify, { bullet: '-', emphasis: '*', strong: '*' })
  return String(await processor.process(input))
}

describe('remarkGfmAlerts', () => {
  it('strips the alert marker and wraps in a Callout', async () => {
    const out = await run('> [!NOTE]\n> Hello.')
    expect(out).not.toContain('[!NOTE]')
    expect(out).toContain('<Callout type="info">')
    expect(out).toContain('</Callout>')
    expect(out).toContain('Hello.')
  })

  it('preserves inline formatting and links inside the callout', async () => {
    const out = await run(
      '> [!TIP]\n> Use **bold**, a [link](https://x.com), and `code`.',
    )
    expect(out).toContain('**bold**')
    expect(out).toContain('[link](https://x.com)')
    expect(out).toContain('`code`')
  })

  it('preserves lists inside the callout', async () => {
    const out = await run('> [!NOTE]\n> Steps:\n>\n> - one\n> - two')
    expect(out).toContain('- one')
    expect(out).toContain('- two')
  })

  it('maps alert types per adapter (docusaurus admonition)', async () => {
    const out = await run('> [!WARNING]\n> Careful with a [link](https://x.com).', docusaurusAdapter)
    expect(out).toContain(':::warning')
    expect(out).toContain('[link](https://x.com)')
    expect(out).not.toContain('<Callout')
  })

  it('leaves non-alert blockquotes untouched', async () => {
    const out = await run('> Just a normal quote.')
    expect(out).toContain('> Just a normal quote.')
    expect(out).not.toContain('<Callout')
  })
})
