import { defineCommand, runMain } from 'citty'
import { buildCommand } from './commands/build.js'
import { initCommand } from './commands/init.js'

// Replaced at build time by tsup's `define` (see tsup.config.ts). The
// `typeof` guard keeps it safe if the source is ever run unbundled.
declare const __DOCSYNC_VERSION__: string | undefined
const version =
  typeof __DOCSYNC_VERSION__ !== 'undefined' ? __DOCSYNC_VERSION__ : '0.0.0'

const main = defineCommand({
  meta: {
    name: 'docsync',
    version,
    description: 'Transform GitHub markdown into docs-framework-compatible output.',
  },
  subCommands: {
    build: buildCommand,
    init: initCommand,
  },
})

runMain(main)
