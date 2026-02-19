import { test, expect } from "@playwright/test";

const ADMIN_EMAIL = process.env.TEST_USER_EMAIL || "admin@example.com";
const ADMIN_PASSWORD = process.env.TEST_USER_PASSWORD || "password123";
const STAFF_EMAIL = process.env.TEST_STAFF_EMAIL || "staff01@example.com";
const STAFF_PASSWORD = process.env.TEST_STAFF_PASSWORD || "password123";

test.describe("メッセージ受信箱", () => {
  test.describe("管理者", () => {
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

    test("メッセージページが表示される", async ({ page }) => {
      await page.goto("/admin/messages");
      await expect(page.locator("h1")).toContainText("受信箱");
    });

    test("受信箱一覧が表示される", async ({ page }) => {
      await page.goto("/admin/messages");
      await page.waitForTimeout(2000);
      // メッセージがある場合は一覧が表示される
      const noMessage = page.locator("text=メッセージはありません");
      const messageList = page.locator('[class*="space-y"]');
      const hasContent = await noMessage.isVisible() || await messageList.count() > 0;
      expect(hasContent).toBeTruthy();
    });

    test("サイドバーのメッセージリンクが機能する", async ({ page }) => {
      await page.click('a[href="/admin/messages"]');
      await expect(page).toHaveURL(/\/admin\/messages/);
    });
  });

  test.describe("スタッフ", () => {
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

    test("スタッフもメッセージページにアクセスできる", async ({ page }) => {
      await page.goto("/admin/messages");
      await expect(page.locator("h1")).toContainText("受信箱");
    });
  });
});
