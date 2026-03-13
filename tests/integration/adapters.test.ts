import { describe, it, expect, afterEach } from 'vitest'
import fs from 'node:fs/promises'
import path from 'node:path'
import { buildPipeline } from '../../src/core/pipeline.js'
import type { DocSyncConfig } from '../../src/config/schema.js'
import { nextraAdapter } from '../../src/adapters/nextra.js'
import { fumadocsAdapter } from '../../src/adapters/fumadocs.js'
import { docusaurusAdapter } from '../../src/adapters/docusaurus.js'
import type { ResolvedPage } from '../../src/core/source-resolver.js'

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

// --- mergeNavConfig ---

const testPages: ResolvedPage[] = [
  { filePath: '/a/index.md', relativePath: 'index.md', slug: 'index', title: 'Introduction', order: 0 },
  { filePath: '/a/guide.md', relativePath: 'guide.md', slug: 'guide', title: 'Guide', order: 1 },
  { filePath: '/a/api.md', relativePath: 'api.md', slug: 'api', title: 'API', order: 2 },
]

describe('nextra mergeNavConfig', () => {
  it('preserves user-customized entries', () => {
    const existing = {
      index: { title: 'Home', icon: 'home' },
      guide: 'My Guide',
    }
    const result = nextraAdapter.mergeNavConfig!(existing, testPages)
    const merged = JSON.parse(result.content)

    // User customizations preserved
    expect(merged.index).toEqual({ title: 'Home', icon: 'home' })
    expect(merged.guide).toBe('My Guide')
    // New page appended
    expect(merged.api).toBe('API')
  })

  it('keeps user-added entries not from DocSync', () => {
    const existing = {
      index: 'Introduction',
      '---': { type: 'separator' },
      'external-link': { title: 'Blog', href: 'https://blog.example.com' },
    }
    const result = nextraAdapter.mergeNavConfig!(existing, testPages)
    const merged = JSON.parse(result.content)

    expect(merged['---']).toEqual({ type: 'separator' })
    expect(merged['external-link']).toEqual({ title: 'Blog', href: 'https://blog.example.com' })
    expect(merged.guide).toBe('Guide')
  })

  it('generates fresh config when existing is empty', () => {
    const result = nextraAdapter.mergeNavConfig!({}, testPages)
    const merged = JSON.parse(result.content)

    expect(merged.index).toBe('Introduction')
    expect(merged.guide).toBe('Guide')
    expect(merged.api).toBe('API')
  })
})

describe('fumadocs mergeNavConfig', () => {
  it('preserves existing title and extra fields', () => {
    const existing = {
      title: 'My Docs',
      icon: 'book',
      pages: ['index', 'guide'],
    }
    const result = fumadocsAdapter.mergeNavConfig!(existing, testPages)
    const merged = JSON.parse(result.content)

    expect(merged.title).toBe('My Docs')
    expect(merged.icon).toBe('book')
  })

  it('appends new pages without duplicating existing ones', () => {
    const existing = {
      title: 'Documentation',
      pages: ['guide', 'index'],
    }
    const result = fumadocsAdapter.mergeNavConfig!(existing, testPages)
    const merged = JSON.parse(result.content)

    // Existing order preserved, new page appended
    expect(merged.pages).toEqual(['guide', 'index', 'api'])
  })

  it('keeps user-added pages not from DocSync', () => {
    const existing = {
      title: 'Documentation',
      pages: ['index', 'changelog', 'guide'],
    }
    const result = fumadocsAdapter.mergeNavConfig!(existing, testPages)
    const merged = JSON.parse(result.content)

    expect(merged.pages).toEqual(['index', 'changelog', 'guide', 'api'])
  })
})

describe('docusaurus mergeNavConfig', () => {
  it('preserves user-customized category fields', () => {
    const existing = {
      label: 'API Reference',
      position: 5,
      className: 'custom-sidebar',
    }
    const result = docusaurusAdapter.mergeNavConfig!(existing, testPages)
    const merged = JSON.parse(result.content)

    expect(merged.label).toBe('API Reference')
    expect(merged.position).toBe(5)
    expect(merged.className).toBe('custom-sidebar')
  })

  it('fills missing defaults', () => {
    const existing = { label: 'My Section' }
    const result = docusaurusAdapter.mergeNavConfig!(existing, testPages)
    const merged = JSON.parse(result.content)

    expect(merged.label).toBe('My Section')
    expect(merged.position).toBe(1)
    expect(merged.link).toEqual({ type: 'generated-index' })
  })
})

// --- Pipeline merge integration ---

describe('pipeline nav config merge', () => {
  const target = 'nextra' as const

  afterEach(() => cleanup(target))

  it('merges with existing _meta.json when clean is false', async () => {
    const config = { ...makeConfig(target), clean: false }
    const outDir = path.join(FIXTURES_DIR, `.docsync-test-${target}`)

    // Create output dir with pre-existing _meta.json
    await fs.mkdir(outDir, { recursive: true })
    await fs.writeFile(
      path.join(outDir, '_meta.json'),
      JSON.stringify({ index: { title: 'Home', icon: 'star' }, custom: 'Custom Page' }, null, 2),
      'utf-8',
    )

    await buildPipeline(config, FIXTURES_DIR)

    const raw = await readOutput(target, '_meta.json')
    const meta = JSON.parse(raw)

    // User customizations preserved
    expect(meta.index).toEqual({ title: 'Home', icon: 'star' })
    expect(meta.custom).toBe('Custom Page')
  })

  it('overwrites when clean is true', async () => {
    const config = makeConfig(target) // clean: true
    const outDir = path.join(FIXTURES_DIR, `.docsync-test-${target}`)

    // Create output dir with pre-existing _meta.json
    await fs.mkdir(outDir, { recursive: true })
    await fs.writeFile(
      path.join(outDir, '_meta.json'),
      JSON.stringify({ custom: 'Should Be Gone' }, null, 2),
      'utf-8',
    )

    await buildPipeline(config, FIXTURES_DIR)

    const raw = await readOutput(target, '_meta.json')
    const meta = JSON.parse(raw)

    // clean: true wipes outDir first, so no merge — fresh generation
    expect(meta.custom).toBeUndefined()
    expect(meta.index).toBe('Introduction')
  })
})
