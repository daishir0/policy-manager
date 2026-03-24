import { test, expect } from "@playwright/test";
import { loginWithOIDC } from "./helpers/auth";

const ADMIN_EMAIL = process.env.TEST_USER_EMAIL || "admin@example.com";
const ADMIN_PASSWORD = process.env.TEST_USER_PASSWORD || "password123";
const STAFF_EMAIL = process.env.TEST_STAFF_EMAIL || "staff01@example.com";
const STAFF_PASSWORD = process.env.TEST_STAFF_PASSWORD || "password123";

test.describe("メッセージ受信箱", () => {
  test.describe("管理者", () => {
    test.beforeEach(async ({ page }) => {
      await loginWithOIDC(page, ADMIN_EMAIL, ADMIN_PASSWORD);
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
    test.beforeEach(async ({ page }) => {
      await loginWithOIDC(page, STAFF_EMAIL, STAFF_PASSWORD);
    });

    test("スタッフもメッセージページにアクセスできる", async ({ page }) => {
      await page.goto("/admin/messages");
      await expect(page.locator("h1")).toContainText("受信箱");
    });
  });
});
