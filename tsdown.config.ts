import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts', 'src/cli.ts'],
  outDir: 'lib',
  format: 'esm',
  // Declarations come from `tsc --emitDeclarationOnly` (DSH-repo convention:
  // tsc emits the types, tsdown bundles the runtime; this tsdown build emits
  // hash-named dts chunks that don't match the package exports map).
  dts: false,
  clean: true,
  target: 'node22',
  splitting: false,
  // cordis + dsh-tools are peers resolved from the host profile's tree —
  // never bundle them.
  external: [/^@deepseek-ai\//],
})
