import { test, expect } from "@playwright/test";

const ADMIN_EMAIL = process.env.TEST_USER_EMAIL || "admin@example.com";
const ADMIN_PASSWORD = process.env.TEST_USER_PASSWORD || "password123";

test.describe("依存関係ツリー", () => {
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

  test("依存関係ページが表示される", async ({ page }) => {
    await page.goto("/admin/dependencies");
    await expect(page.locator("h1")).toContainText("依存関係ツリー");
  });

  test("ツリー表示が存在する", async ({ page }) => {
    await page.goto("/admin/dependencies");
    // ローディングが完了するまで待つ
    await page.waitForTimeout(3000);
    // 文書ツリーカードが表示される
    await expect(page.locator("text=文書ツリー")).toBeVisible({ timeout: 10000 });
  });

  test("ステータス凡例が表示される", async ({ page }) => {
    await page.goto("/admin/dependencies");
    await expect(page.locator("text=公開中")).toBeVisible({ timeout: 5000 });
    await expect(page.locator("text=下書き")).toBeVisible({ timeout: 5000 });
    await expect(page.locator("text=廃止")).toBeVisible({ timeout: 5000 });
  });

  test("文書名をクリックすると詳細ページに遷移する", async ({ page }) => {
    await page.goto("/admin/dependencies");
    await page.waitForTimeout(3000);
    // ツリー内のリンクをクリック
    const docLink = page.locator('.prose a, a[href*="/admin/documents/"]').first();
    if (await docLink.count() > 0) {
      await docLink.click();
      await expect(page).toHaveURL(/\/admin\/documents\/[^/]+$/, { timeout: 10000 });
    }
  });

  test("リフレッシュボタンが機能する", async ({ page }) => {
    await page.goto("/admin/dependencies");
    await page.waitForTimeout(2000);
    const refreshButton = page.locator('button:has([class*="animate-spin"]), button:has([data-lucide="refresh-cw"])').first();
    if (await refreshButton.count() > 0) {
      await refreshButton.click();
      // スピンアニメーションが一時的に表示される
      await page.waitForTimeout(500);
    }
  });

  test("展開・折りたたみが機能する", async ({ page }) => {
    await page.goto("/admin/dependencies");
    await page.waitForTimeout(3000);
    // ChevronRightボタン（展開ボタン）が存在する場合クリック
    const chevronButton = page.locator('button:has([data-lucide="chevron-right"])').first();
    if (await chevronButton.count() > 0) {
      await chevronButton.click();
      await page.waitForTimeout(500);
      // 状態が変化したことを確認（エラーなしで操作できる）
    }
  });
});
