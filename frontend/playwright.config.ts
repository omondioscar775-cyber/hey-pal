import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  workers: 1,
  timeout: 60_000,
  use: { baseURL: "http://127.0.0.1:3140", trace: "retain-on-failure" },
  projects: [
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        channel: process.env.CIRCLEUP_BROWSER_CHANNEL,
      },
    },
    {
      name: "tablet",
      use: {
        ...devices["Pixel 7"],
        viewport: { width: 820, height: 1180 },
        channel: process.env.CIRCLEUP_BROWSER_CHANNEL,
      },
    },
    {
      name: "mobile",
      use: {
        ...devices["Pixel 7"],
        channel: process.env.CIRCLEUP_BROWSER_CHANNEL,
      },
    },
  ],
  webServer: [
    {
      command: "node tests/fixtures/upstream.mjs",
      url: "http://127.0.0.1:3141/api/health",
    },
    {
      command:
        "node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3140",
      url: "http://127.0.0.1:3140",
      env: { CIRCLEUP_API_URL: "http://127.0.0.1:3141/api" },
      timeout: 120_000,
    },
  ],
});
