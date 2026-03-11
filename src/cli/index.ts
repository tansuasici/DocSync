import { defineCommand, runMain } from 'citty'
import { buildCommand } from './commands/build.js'
import { initCommand } from './commands/init.js'

const main = defineCommand({
  meta: {
    name: 'docsync',
    version: '0.1.0',
    description: 'Transform GitHub markdown into docs-framework-compatible output.',
  },
  subCommands: {
    build: buildCommand,
    init: initCommand,
  },
})

runMain(main)
