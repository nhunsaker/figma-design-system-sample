import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config'

/**
 * Tests run in workerd, the same runtime the deployed Worker runs in, rather than in node with a
 * pile of shims. A port whose tests pass somewhere the code will never run has proved very little.
 */
export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        wrangler: { configPath: './wrangler.toml' },
        miniflare: {
          bindings: {
            FIGMA_FILE_KEY: 'AbC123XyZ',
            GITHUB_REPO: 'nhunsaker/figma-design-system-sample',
            FIGMA_TOKEN: 'figma-token',
            GITHUB_TOKEN: 'gh-token',
            WEBHOOK_PASSCODE: 'a-passcode-the-bridge-chose',
          },
        },
      },
    },
  },
})
