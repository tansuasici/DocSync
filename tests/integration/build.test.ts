import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs/promises'
import path from 'node:path'
import { buildPipeline } from '../../src/core/pipeline.js'
import type { DocSyncConfig } from '../../src/config/schema.js'

const FIXTURES_DIR = path.resolve(import.meta.dirname, '../fixtures/basic')
const OUT_DIR = path.join(FIXTURES_DIR, '.docsync-test')

const config: DocSyncConfig = {
  sources: [
    { path: 'README.md', slug: 'index', title: 'Introduction' },
    { path: 'docs/**/*.md' },
  ],
  target: 'fumadocs',
  outDir: '.docsync-test',
  baseUrl: '/docs',
  clean: true,
  github: { repo: 'test/my-project', branch: 'main' },
}

describe('build pipeline (integration)', () => {
  beforeEach(async () => {
    await fs.rm(OUT_DIR, { recursive: true, force: true })
  })

  afterEach(async () => {
    await fs.rm(OUT_DIR, { recursive: true, force: true })
  })

  it('produces correct number of output files', async () => {
    const result = await buildPipeline(config, FIXTURES_DIR)
    expect(result.errors).toHaveLength(0)
    expect(result.pages).toHaveLength(3)
  })

  it('generates valid MDX with frontmatter', async () => {
    await buildPipeline(config, FIXTURES_DIR)
    const content = await fs.readFile(path.join(OUT_DIR, 'index.mdx'), 'utf-8')

    expect(content).toContain('---')
    expect(content).toContain('title: "Introduction"')
    expect(content).toContain('description:')
  })

  it('converts GitHub alerts to Callout components', async () => {
    await buildPipeline(config, FIXTURES_DIR)
    const content = await fs.readFile(path.join(OUT_DIR, 'index.mdx'), 'utf-8')

    expect(content).toContain('<Callout type="info">')
    expect(content).toContain('<Callout type="warn">')
    expect(content).not.toContain('[!NOTE]')
    expect(content).not.toContain('[!WARNING]')
  })

  it('adds Fumadocs Callout import', async () => {
    await buildPipeline(config, FIXTURES_DIR)
    const content = await fs.readFile(path.join(OUT_DIR, 'index.mdx'), 'utf-8')

    expect(content).toContain("import { Callout } from 'fumadocs-ui/components/callout'")
  })

  it('rewrites relative markdown links to docs URLs', async () => {
    await buildPipeline(config, FIXTURES_DIR)
    const content = await fs.readFile(path.join(OUT_DIR, 'index.mdx'), 'utf-8')

    expect(content).toContain('/docs/getting-started')
    expect(content).toContain('/docs/api#methods')
    expect(content).not.toContain('./docs/getting-started.md')
  })

  it('rewrites back-links correctly', async () => {
    await buildPipeline(config, FIXTURES_DIR)
    const content = await fs.readFile(
      path.join(OUT_DIR, 'getting-started.mdx'),
      'utf-8',
    )

    // ../README.md should become /docs (index page)
    expect(content).toContain('/docs')
    expect(content).not.toContain('../README.md')
  })

  it('escapes curly braces in text', async () => {
    await buildPipeline(config, FIXTURES_DIR)
    const content = await fs.readFile(path.join(OUT_DIR, 'index.mdx'), 'utf-8')

    expect(content).toContain('\\\\{placeholder\\\\}')
  })

  it('converts HTML comments to JSX comments', async () => {
    await buildPipeline(config, FIXTURES_DIR)
    const content = await fs.readFile(path.join(OUT_DIR, 'index.mdx'), 'utf-8')

    expect(content).toContain('{/*')
    expect(content).not.toContain('<!--')
  })

  it('rewrites image paths to GitHub raw URLs', async () => {
    await buildPipeline(config, FIXTURES_DIR)
    const content = await fs.readFile(path.join(OUT_DIR, 'index.mdx'), 'utf-8')

    expect(content).toContain(
      'https://raw.githubusercontent.com/test/my-project/main/assets/logo.png',
    )
    expect(content).not.toContain('./assets/logo.png')
  })

  it('generates meta.json for navigation', async () => {
    await buildPipeline(config, FIXTURES_DIR)
    const metaRaw = await fs.readFile(path.join(OUT_DIR, 'meta.json'), 'utf-8')
    const meta = JSON.parse(metaRaw)

    expect(meta.title).toBe('Documentation')
    expect(meta.pages).toContain('index')
    expect(meta.pages).toContain('api')
    expect(meta.pages).toContain('getting-started')
  })

  it('removes first H1 from body (title is in frontmatter)', async () => {
    await buildPipeline(config, FIXTURES_DIR)
    const content = await fs.readFile(
      path.join(OUT_DIR, 'getting-started.mdx'),
      'utf-8',
    )

    // Body should not have # Getting Started since it's in frontmatter
    const bodyAfterFrontmatter = content.split('---').slice(2).join('---')
    expect(bodyAfterFrontmatter).not.toContain('# Getting Started')
  })

  it('preserves code blocks without escaping', async () => {
    await buildPipeline(config, FIXTURES_DIR)
    const content = await fs.readFile(
      path.join(OUT_DIR, 'getting-started.mdx'),
      'utf-8',
    )

    // Code blocks should be preserved
    expect(content).toContain('```bash')
    expect(content).toContain('npm install my-project')
  })
})
