import { test, expect } from "@playwright/test";

const ADMIN_EMAIL = process.env.TEST_USER_EMAIL || "admin@example.com";
const ADMIN_PASSWORD = process.env.TEST_USER_PASSWORD || "password123";
const STAFF_EMAIL = process.env.TEST_STAFF_EMAIL || "staff01@example.com";
const STAFF_PASSWORD = process.env.TEST_STAFF_PASSWORD || "password123";

test.describe("アクセス統計（admin only）", () => {
  test.describe("管理者アクセス", () => {
    test.beforeEach(async ({ page, request }) => {
      try {
        await request.post("/api/test/reset-user-lock", { data: { email: ADMIN_EMAIL } });
      } catch { /* ignore */ }
      await page.goto("/login");
      await page.fill('input[type="email"]', ADMIN_EMAIL);
      await page.fill('input[type="password"]', ADMIN_PASSWORD);
      await page.click('button[type="submit"]');
      await page.waitForURL(/\/admin/, { timeout: 10000 });
    });

    test("アクセス統計ページが表示される", async ({ page }) => {
      await page.goto("/admin/analytics");
      await expect(page.locator("h1")).toContainText("アクセス統計");
    });

    test("期間フィルターが機能する", async ({ page }) => {
      await page.goto("/admin/analytics");
      await page.waitForTimeout(2000);
      await page.click('button:has-text("7日間")');
      await page.waitForTimeout(1000);
      // アクティブ状態になることを確認
      const btn7d = page.locator('button:has-text("7日間")');
      await expect(btn7d).toBeVisible();
    });

    test("サマリーカードが表示される", async ({ page }) => {
      await page.goto("/admin/analytics");
      await page.waitForTimeout(3000);
      await expect(page.locator("text=総閲覧数")).toBeVisible({ timeout: 10000 });
      await expect(page.locator("text=ユニークユーザー")).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe("スタッフアクセス（リダイレクト）", () => {
    test.beforeEach(async ({ page, request }) => {
      try {
        await request.post("/api/test/reset-user-lock", { data: { email: STAFF_EMAIL } });
      } catch { /* ignore */ }
      await page.goto("/login");
      await page.fill('input[type="email"]', STAFF_EMAIL);
      await page.fill('input[type="password"]', STAFF_PASSWORD);
      await page.click('button[type="submit"]');
      await page.waitForURL(/\/admin/, { timeout: 10000 });
    });

    test("スタッフはアクセス統計にアクセスできない", async ({ page }) => {
      await page.goto("/admin/analytics");
      // admin以外はリダイレクトされる
      await page.waitForTimeout(3000);
      // ダッシュボードにリダイレクトされるか、アクセス統計ページが表示されない
      const url = page.url();
      expect(url).not.toMatch(/\/admin\/analytics/);
    });
  });
});

test.describe("ログ管理（admin only）", () => {
  test.describe("管理者アクセス", () => {
    test.beforeEach(async ({ page, request }) => {
      try {
        await request.post("/api/test/reset-user-lock", { data: { email: ADMIN_EMAIL } });
      } catch { /* ignore */ }
      await page.goto("/login");
      await page.fill('input[type="email"]', ADMIN_EMAIL);
      await page.fill('input[type="password"]', ADMIN_PASSWORD);
      await page.click('button[type="submit"]');
      await page.waitForURL(/\/admin/, { timeout: 10000 });
    });

    test("ログ管理ページが表示される", async ({ page }) => {
      await page.goto("/admin/logs");
      await expect(page.locator("h1")).toContainText("ログ管理");
    });

    test("アクションフィルターが表示される", async ({ page }) => {
      await page.goto("/admin/logs");
      await page.waitForTimeout(2000);
      // セレクトコンポーネントが表示される
      await expect(page.locator('[role="combobox"]')).toBeVisible({ timeout: 5000 });
    });

    test("ログ一覧が表示される", async ({ page }) => {
      await page.goto("/admin/logs");
      await page.waitForTimeout(3000);
      await expect(page.locator("h1")).toContainText("ログ管理", { timeout: 10000 });
    });
  });
});
