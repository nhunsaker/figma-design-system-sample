import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  // One copy of each of these, or styled-components ends up with two registries and the vendor
  // library's components render against a styled it does not share.
  resolve: { dedupe: ['react', 'react-dom', 'styled-components'] },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.mjs'],
    // The vendor library ships both builds. Left external, the test run picks the CommonJS one
    // and styled arrives wrapped in a default export it never unwraps.
    server: { deps: { inline: ['@metatoy/bootstrap-styled', 'styled-components'] } },
  },
})
