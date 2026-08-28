/** Post-build: prepend the CLI shebang (tsdown has no banner option here). */
import { readFileSync, writeFileSync, chmodSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const cli = join(dirname(fileURLToPath(import.meta.url)), '..', 'lib', 'cli.js')
const src = readFileSync(cli, 'utf8')
if (!src.startsWith('#!')) {
  writeFileSync(cli, `#!/usr/bin/env node\n${src}`)
}
try {
  chmodSync(cli, 0o755)
} catch {
  /* Windows: exec bit is not meaningful; npm sets the bin shim itself */
}
console.log('postbuild: shebang ok')
