import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright setup for responsive smoke tests.
 * Install browsers: npx playwright install
 * Run: npm run test:e2e -w web
 *
 * Defaults to local mock adapters — does not call production Notion/LLM.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"]],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "off",
  },
  projects: [
    { name: "mobile", use: { ...devices["iPhone 12"] } },
    { name: "ipad", use: { ...devices["iPad Mini"] } },
    { name: "desktop", use: { viewport: { width: 1280, height: 800 } } },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
