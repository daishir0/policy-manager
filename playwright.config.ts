import { defineConfig, devices } from "@playwright/test";

// E2EテストのベースURL（環境変数で必須設定）
// memo.md方針: テストは必ずインターネット側から実施、localhost禁止
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL;
if (!BASE_URL) {
  throw new Error("PLAYWRIGHT_BASE_URL environment variable is required. Set it in .env file.");
}

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false, // 共有状態（アカウントロックなど）の競合を防ぐため
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1, // ローカルでも1回リトライ
  workers: 1, // 順次実行で安定性を確保
  reporter: "html",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    permissions: ["clipboard-read", "clipboard-write"],
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
    },
    {
      name: "Mobile Chrome",
      use: { ...devices["Pixel 5"] },
    },
  ],
  // 本番URLテストのため、webServerは無効化
  // webServer: {
  //   command: "npm run dev",
  //   url: "http://localhost:3018",
  //   reuseExistingServer: !process.env.CI,
  // },
});
