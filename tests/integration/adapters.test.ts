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

  it('generates _meta.js with page titles', async () => {
    await buildPipeline(makeConfig('nextra'), FIXTURES_DIR)
    const raw = await readOutput('nextra', '_meta.js')
    const meta = parseNextraMeta(raw)

    expect(raw.startsWith('export default {')).toBe(true)
    expect(meta.index).toBe('Introduction') // config override
    expect(meta['getting-started']).toBe('Getting Started') // from the H1
  })
})

function parseNextraMeta(raw: string): Record<string, unknown> {
  return JSON.parse(raw.replace(/^export default /, ''))
}

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

describe('nextra generatePerDirectoryNavConfig', () => {
  it('writes one _meta.js per directory with titles in order', () => {
    const pages: ResolvedPage[] = [
      { filePath: '/f', relativePath: 'index.md', slug: 'index', order: 0, title: 'Intro' },
      { filePath: '/f', relativePath: 'agents/index.md', slug: 'agents/index', order: 1, title: 'Agents' },
      { filePath: '/f', relativePath: 'agents/core/roles.md', slug: 'agents/core/roles', order: 2, title: 'Roles' },
      { filePath: '/f', relativePath: 'guide.md', slug: 'guide', order: 3, title: 'Guide' },
    ]
    const result = nextraAdapter.generatePerDirectoryNavConfig!(pages)

    expect([...result.keys()]).toEqual(['_meta.js', 'agents/_meta.js', 'agents/core/_meta.js'])
    expect(parseNextraMeta(result.get('_meta.js')!.content)).toEqual({
      index: 'Intro',
      agents: 'Agents',
      guide: 'Guide',
    })
    expect(parseNextraMeta(result.get('agents/_meta.js')!.content)).toEqual({
      index: 'Agents',
      core: 'Core',
    })
    expect(parseNextraMeta(result.get('agents/core/_meta.js')!.content)).toEqual({ roles: 'Roles' })
  })
})

describe('nextra mergePerDirectoryNavConfig', () => {
  const generated = nextraAdapter.generatePerDirectoryNavConfig!(testPages).get('_meta.js')!

  it('preserves user-customized entries', () => {
    const existing = {
      index: { title: 'Home', icon: 'home' },
      guide: 'My Guide',
    }
    const result = nextraAdapter.mergePerDirectoryNavConfig!(existing, generated)
    const merged = parseNextraMeta(result.content)

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
    const result = nextraAdapter.mergePerDirectoryNavConfig!(existing, generated)
    const merged = parseNextraMeta(result.content)

    expect(merged['---']).toEqual({ type: 'separator' })
    expect(merged['external-link']).toEqual({ title: 'Blog', href: 'https://blog.example.com' })
    expect(merged.guide).toBe('Guide')
  })

  it('generates fresh config when existing is empty', () => {
    const result = nextraAdapter.mergePerDirectoryNavConfig!({}, generated)
    const merged = parseNextraMeta(result.content)

    expect(merged.index).toBe('Introduction')
    expect(merged.guide).toBe('Guide')
    expect(merged.api).toBe('API')
  })
})

describe('fumadocs generatePerDirectoryNavConfig', () => {
  it('generates root meta.json with top-level pages and directory names', () => {
    const pages: ResolvedPage[] = [
      { filePath: '/f', relativePath: 'index.md', slug: 'index', order: 0, title: 'Intro' },
      { filePath: '/f', relativePath: 'core/agents.md', slug: 'core/agents', order: 1, title: 'Agents' },
      { filePath: '/f', relativePath: 'core/roles.md', slug: 'core/roles', order: 2, title: 'Roles' },
      { filePath: '/f', relativePath: 'eval.md', slug: 'evaluation', order: 3, title: 'Eval' },
    ]
    const result = fumadocsAdapter.generatePerDirectoryNavConfig!(pages)
    const root = JSON.parse(result.get('meta.json')!.content)

    expect(root.pages).toContain('index')
    expect(root.pages).toContain('core')
    expect(root.pages).toContain('evaluation')
    expect(root.pages).not.toContain('agents')
    expect(root.pages).not.toContain('roles')
  })

  it('generates per-directory meta.json with page names', () => {
    const pages: ResolvedPage[] = [
      { filePath: '/f', relativePath: 'core/agents.md', slug: 'core/agents', order: 1, title: 'Agents' },
      { filePath: '/f', relativePath: 'core/roles.md', slug: 'core/roles', order: 2, title: 'Roles' },
    ]
    const result = fumadocsAdapter.generatePerDirectoryNavConfig!(pages)
    const coreMeta = JSON.parse(result.get('core/meta.json')!.content)

    expect(coreMeta.title).toBe('Core')
    expect(coreMeta.pages).toEqual(['agents', 'roles'])
  })
})

describe('fumadocs mergePerDirectoryNavConfig', () => {
  const generated = {
    filename: 'core/meta.json',
    content: JSON.stringify({ title: 'Core', pages: ['agents', 'roles', 'tools'] }, null, 2) + '\n',
  }

  it('preserves a user-customized title and page ordering', () => {
    const existing = {
      title: 'Core Concepts',
      icon: 'Box',
      pages: ['roles', '---Advanced---', 'agents'],
    }
    const result = fumadocsAdapter.mergePerDirectoryNavConfig!(existing, generated)
    const merged = JSON.parse(result.content)

    expect(merged.title).toBe('Core Concepts') // user title kept
    expect(merged.icon).toBe('Box') // extra key kept
    // User ordering + separators preserved, new page (tools) appended.
    expect(merged.pages).toEqual(['roles', '---Advanced---', 'agents', 'tools'])
  })

  it('falls back to the generated title when none is set', () => {
    const result = fumadocsAdapter.mergePerDirectoryNavConfig!({}, generated)
    const merged = JSON.parse(result.content)

    expect(merged.title).toBe('Core')
    expect(merged.pages).toEqual(['agents', 'roles', 'tools'])
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

  it('merges with existing _meta.js when clean is false', async () => {
    const config = { ...makeConfig(target), clean: false }
    const outDir = path.join(FIXTURES_DIR, `.docsync-test-${target}`)

    // Create output dir with pre-existing _meta.js
    await fs.mkdir(outDir, { recursive: true })
    await fs.writeFile(
      path.join(outDir, '_meta.js'),
      `export default ${JSON.stringify({ index: { title: 'Home', icon: 'star' }, custom: 'Custom Page' }, null, 2)}\n`,
      'utf-8',
    )

    await buildPipeline(config, FIXTURES_DIR)

    const raw = await readOutput(target, '_meta.js')
    const meta = parseNextraMeta(raw)

    // User customizations preserved
    expect(meta.index).toEqual({ title: 'Home', icon: 'star' })
    expect(meta.custom).toBe('Custom Page')
  })

  it('overwrites when clean is true', async () => {
    const config = makeConfig(target) // clean: true
    const outDir = path.join(FIXTURES_DIR, `.docsync-test-${target}`)

    // Create output dir with pre-existing _meta.js
    await fs.mkdir(outDir, { recursive: true })
    await fs.writeFile(
      path.join(outDir, '_meta.js'),
      `export default ${JSON.stringify({ custom: 'Should Be Gone' }, null, 2)}\n`,
      'utf-8',
    )

    await buildPipeline(config, FIXTURES_DIR)

    const raw = await readOutput(target, '_meta.js')
    const meta = parseNextraMeta(raw)

    // clean: true wipes outDir first, so no merge — fresh generation
    expect(meta.custom).toBeUndefined()
    expect(meta.index).toBe('Introduction')
  })

  it('leaves a hand-written _meta.js it cannot parse untouched', async () => {
    const config = { ...makeConfig(target), clean: false }
    const outDir = path.join(FIXTURES_DIR, `.docsync-test-${target}`)
    const handWritten = "export default {\n  index: 'Home', // custom\n}\n"

    await fs.mkdir(outDir, { recursive: true })
    await fs.writeFile(path.join(outDir, '_meta.js'), handWritten, 'utf-8')

    const result = await buildPipeline(config, FIXTURES_DIR)

    expect(await readOutput(target, '_meta.js')).toBe(handWritten)
    expect(result.warnings).toContain('_meta.js: existing file could not be parsed — left untouched')
  })
})
