import { readFileSync } from 'node:fs'
import { createRolldownConfig } from '@advanced-elements/rolldown-config'

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'))

const config = createRolldownConfig(pkg, {
  input: 'src/index.ts',
})

export default config
