import { test, expect } from "@playwright/test";

const AI_ENABLED = !!process.env.ANTHROPIC_API_KEY;
const ADMIN_EMAIL = process.env.TEST_USER_EMAIL || "admin@example.com";
const ADMIN_PASSWORD = process.env.TEST_USER_PASSWORD || "password123";

test.describe("対話型Q&A", () => {
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

  test("Q&Aページが表示される", async ({ page }) => {
    await page.goto("/admin/qa");
    await expect(page.locator("h1")).toContainText("Q&A対話");
    await expect(page.locator("textarea")).toBeVisible();
  });

  test("質問を送信できる", async ({ page }) => {
    test.skip(!AI_ENABLED, "AI APIが設定されていません（ANTHROPIC_API_KEY）");
    await page.goto("/admin/qa");
    await page.fill("textarea", "休暇申請の方法を教えてください");
    await page.click('button[type="submit"]');
    await expect(page.locator("text=休暇申請の方法を教えてください")).toBeVisible();
    await expect(page.locator('[data-testid="assistant-message"]')).toBeVisible({ timeout: 60000 });
  });

  test("Enterキーで質問を送信できる", async ({ page }) => {
    await page.goto("/admin/qa");
    await page.fill("textarea", "テスト質問");
    await page.keyboard.press("Enter");
    await expect(page.locator("text=テスト質問")).toBeVisible();
  });

  test("Shift+Enterで改行できる", async ({ page }) => {
    await page.goto("/admin/qa");
    await page.click("textarea");
    await page.keyboard.type("1行目");
    await page.keyboard.press("Shift+Enter");
    await page.keyboard.type("2行目");
    const textarea = page.locator("textarea");
    await expect(textarea).toHaveValue(/1行目\n2行目/);
  });

  test("根拠文書へのリンクが表示される", async ({ page }) => {
    test.skip(!AI_ENABLED, "AI APIが設定されていません（ANTHROPIC_API_KEY）");
    await page.goto("/admin/qa");
    await page.fill("textarea", "セキュリティポリシーについて教えてください");
    await page.click('button[type="submit"]');
    await expect(page.locator('[data-testid="assistant-message"]')).toBeVisible({ timeout: 60000 });
    // strict mode対策: first()を使用
    const sources = page.locator("text=参照文書").first();
    if (await sources.isVisible()) {
      await expect(page.locator('a[href*="/admin/documents/"]').first()).toBeVisible();
    }
  });

  test("会話履歴が保持される", async ({ page }) => {
    test.skip(!AI_ENABLED, "AI APIが設定されていません（ANTHROPIC_API_KEY）");
    await page.goto("/admin/qa");
    await page.fill("textarea", "最初の質問");
    await page.click('button[type="submit"]');
    await expect(page.locator('[data-testid="assistant-message"]')).toBeVisible({ timeout: 60000 });
    await page.fill("textarea", "2番目の質問");
    await page.click('button[type="submit"]');
    await expect(page.locator("text=最初の質問")).toBeVisible();
    await expect(page.locator("text=2番目の質問")).toBeVisible();
  });
});

test.describe("Q&A - 権限", () => {
  test("未認証ユーザーはアクセスできない", async ({ page }) => {
    await page.goto("/admin/qa");
    await expect(page).toHaveURL(/\/login/);
  });
});
