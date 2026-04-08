import { resolve } from 'node:path'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@advanced-elements/config-provider': resolve(__dirname, '../config-provider/src/index.ts'),
      '@advanced-elements/table': resolve(__dirname, '../table/src/index.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'happy-dom',
    include: ['__tests__/**/*.{spec,test}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      thresholds: {
        statements: 85,
        branches: 85,
        functions: 85,
        lines: 85,
      },
      include: ['src/**/*.ts'],
      exclude: ['node_modules', '__tests__', 'vitest.config.ts', '*.d.ts'],
    },
  },
})
