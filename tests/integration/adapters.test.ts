import { describe, it, expect, afterEach } from 'vitest'
import fs from 'node:fs/promises'
import path from 'node:path'
import { buildPipeline } from '../../src/core/pipeline.js'
import type { DocSyncConfig } from '../../src/config/schema.js'

const FIXTURES_DIR = path.resolve(import.meta.dirname, '../fixtures/basic')

function makeConfig(target: DocSyncConfig['target']): DocSyncConfig {
  return {
    sources: [
      { path: 'README.md', slug: 'index', title: 'Introduction' },
      { path: 'docs/**/*.md' },
    ],
    target,
    outDir: `.docsync-test-${target}`,
    baseUrl: '/docs',
    clean: true,
    github: { repo: 'test/my-project', branch: 'main' },
  }
}

async function readOutput(target: string, file: string): Promise<string> {
  return fs.readFile(
    path.join(FIXTURES_DIR, `.docsync-test-${target}`, file),
    'utf-8',
  )
}

async function cleanup(target: string): Promise<void> {
  await fs.rm(path.join(FIXTURES_DIR, `.docsync-test-${target}`), {
    recursive: true,
    force: true,
  })
}

// --- Docusaurus ---

describe('docusaurus adapter', () => {
  afterEach(() => cleanup('docusaurus'))

  it('builds without errors', async () => {
    const result = await buildPipeline(makeConfig('docusaurus'), FIXTURES_DIR)
    expect(result.errors).toHaveLength(0)
    expect(result.pages).toHaveLength(3)
  })

  it('uses ::: admonition syntax for alerts', async () => {
    await buildPipeline(makeConfig('docusaurus'), FIXTURES_DIR)
    const content = await readOutput('docusaurus', 'index.mdx')

    expect(content).toContain(':::note')
    expect(content).toContain(':::warning')
    expect(content).not.toContain('<Callout')
    expect(content).not.toContain('[!NOTE]')
  })

  it('generates sidebar_position in frontmatter', async () => {
    await buildPipeline(makeConfig('docusaurus'), FIXTURES_DIR)
    const content = await readOutput('docusaurus', 'index.mdx')

    expect(content).toContain('sidebar_position:')
  })

  it('generates _category_.json', async () => {
    await buildPipeline(makeConfig('docusaurus'), FIXTURES_DIR)
    const raw = await readOutput('docusaurus', '_category_.json')
    const meta = JSON.parse(raw)

    expect(meta.label).toBe('Documentation')
  })

  it('does not add imports', async () => {
    await buildPipeline(makeConfig('docusaurus'), FIXTURES_DIR)
    const content = await readOutput('docusaurus', 'index.mdx')

    expect(content).not.toContain('import ')
  })
})

// --- Nextra ---

describe('nextra adapter', () => {
  afterEach(() => cleanup('nextra'))

  it('builds without errors', async () => {
    const result = await buildPipeline(makeConfig('nextra'), FIXTURES_DIR)
    expect(result.errors).toHaveLength(0)
    expect(result.pages).toHaveLength(3)
  })

  it('uses <Callout> for alerts', async () => {
    await buildPipeline(makeConfig('nextra'), FIXTURES_DIR)
    const content = await readOutput('nextra', 'index.mdx')

    expect(content).toContain('<Callout type="info">')
    expect(content).toContain('<Callout type="warning">')
  })

  it('imports from nextra/components', async () => {
    await buildPipeline(makeConfig('nextra'), FIXTURES_DIR)
    const content = await readOutput('nextra', 'index.mdx')

    expect(content).toContain("import { Callout } from 'nextra/components'")
  })

  it('generates _meta.json', async () => {
    await buildPipeline(makeConfig('nextra'), FIXTURES_DIR)
    const raw = await readOutput('nextra', '_meta.json')
    const meta = JSON.parse(raw)

    expect(meta.index).toBe('Introduction')
  })
})

// --- Starlight ---

describe('starlight adapter', () => {
  afterEach(() => cleanup('starlight'))

  it('builds without errors', async () => {
    const result = await buildPipeline(makeConfig('starlight'), FIXTURES_DIR)
    expect(result.errors).toHaveLength(0)
    expect(result.pages).toHaveLength(3)
  })

  it('uses ::: aside syntax for alerts', async () => {
    await buildPipeline(makeConfig('starlight'), FIXTURES_DIR)
    const content = await readOutput('starlight', 'index.mdx')

    expect(content).toContain(':::note')
    expect(content).toContain(':::caution')
    expect(content).not.toContain('<Callout')
  })

  it('includes sidebar order in frontmatter', async () => {
    await buildPipeline(makeConfig('starlight'), FIXTURES_DIR)
    const content = await readOutput('starlight', 'index.mdx')

    expect(content).toContain('sidebar:')
  })

  it('does not generate a nav config file', async () => {
    await buildPipeline(makeConfig('starlight'), FIXTURES_DIR)
    const outDir = path.join(FIXTURES_DIR, '.docsync-test-starlight')
    const files = await fs.readdir(outDir)

    const navFiles = files.filter(
      (f) => f === 'meta.json' || f === '_meta.json' || f === '_category_.json',
    )
    expect(navFiles).toHaveLength(0)
  })

  it('does not add imports', async () => {
    await buildPipeline(makeConfig('starlight'), FIXTURES_DIR)
    const content = await readOutput('starlight', 'index.mdx')

    expect(content).not.toContain('import ')
  })
})
