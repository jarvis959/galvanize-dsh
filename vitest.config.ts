import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    // Stubs bind loopback ports + shared GALVANIZE_HOME env: run files
    // sequentially for determinism on Windows.
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    testTimeout: 20_000,
  },
})
