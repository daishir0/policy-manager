import { test, expect } from "@playwright/test";
import { loginWithOIDC } from "./helpers/auth";

const AI_ENABLED = !!process.env.ANTHROPIC_API_KEY;
const ADMIN_EMAIL = process.env.TEST_USER_EMAIL || "admin@example.com";
const ADMIN_PASSWORD = process.env.TEST_USER_PASSWORD || "password123";

test.describe("文案生成", () => {
  test.beforeEach(async ({ page }) => {
    await loginWithOIDC(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  });

  test("文案生成ページが表示される", async ({ page }) => {
    await page.goto("/admin/draft");
    await expect(page.locator("h1")).toContainText("文案生成");
    await expect(page.locator('textarea[id="idea"]')).toBeVisible();
  });

  test("追加コンテキスト欄が表示されない", async ({ page }) => {
    await page.goto("/admin/draft");
    // additionalContextフィールドは削除済み
    await expect(page.locator('textarea[id="context"]')).not.toBeVisible();
  });

  test("生成ボタンが無効化される（アイディア未入力時）", async ({ page }) => {
    await page.goto("/admin/draft");
    const generateButton = page.locator('button:has-text("文案を生成")');
    await expect(generateButton).toBeDisabled();
    await page.fill('textarea[id="idea"]', "テストアイディア");
    await expect(generateButton).toBeEnabled();
  });

  test("文案を生成できる", async ({ page }) => {
    test.skip(!AI_ENABLED, "AI APIが設定されていません（ANTHROPIC_API_KEY）");
    await page.goto("/admin/draft");
    await page.fill('textarea[id="idea"]', "在宅勤務に関するガイドラインを作りたい");
    await page.click('button:has-text("文案を生成")');
    await expect(page.locator("text=生成中")).toBeVisible({ timeout: 5000 });
    await expect(page.locator("pre")).toBeVisible({ timeout: 60000 });
  });

  test("生成結果をコピーできる", async ({ page }) => {
    test.skip(!AI_ENABLED, "AI APIが設定されていません（ANTHROPIC_API_KEY）");
    await page.goto("/admin/draft");
    await page.fill('textarea[id="idea"]', "テスト文案");
    await page.click('button:has-text("文案を生成")');
    await expect(page.locator("pre")).toBeVisible({ timeout: 60000 });
    await page.click('button:has-text("コピー")');
    await expect(page.locator("text=コピー済み")).toBeVisible({ timeout: 5000 });
  });

  test("生成結果から新規文書作成ページに遷移する（sessionStorage経由）", async ({ page }) => {
    test.skip(!AI_ENABLED, "AI APIが設定されていません（ANTHROPIC_API_KEY）");
    await page.goto("/admin/draft");
    await page.fill('textarea[id="idea"]', "テスト文案");
    await page.click('button:has-text("文案を生成")');
    await expect(page.locator("pre")).toBeVisible({ timeout: 60000 });
    await page.click('button:has-text("文書として作成")');
    // sessionStorage経由で遷移（URLパラメータなし）
    await expect(page).toHaveURL(/\/admin\/documents\/new/, { timeout: 10000 });
  });

  test("再生成機能が表示される（生成後）", async ({ page }) => {
    test.skip(!AI_ENABLED, "AI APIが設定されていません（ANTHROPIC_API_KEY）");
    await page.goto("/admin/draft");
    await page.fill('textarea[id="idea"]', "テスト文案");
    await page.click('button:has-text("文案を生成")');
    await expect(page.locator("pre")).toBeVisible({ timeout: 60000 });
    await expect(page.locator("text=修正・再生成")).toBeVisible();
  });

  test("参照文書サジェストが表示される（関連文書がある場合）", async ({ page }) => {
    test.skip(!AI_ENABLED, "AI APIが設定されていません（ANTHROPIC_API_KEY）");
    await page.goto("/admin/draft");
    await page.fill('textarea[id="idea"]', "セキュリティポリシーを更新したい");
    await page.click('button:has-text("文案を生成")');
    await expect(page.locator("pre")).toBeVisible({ timeout: 60000 });
    const referencedDocs = page.locator("text=参照した既存文書");
    if (await referencedDocs.isVisible()) {
      // strict mode対策: first()を使用
      await expect(page.locator('a[href*="/admin/documents/"]').first()).toBeVisible();
    }
  });
});

test.describe("文案生成 - 権限", () => {
  test("未認証ユーザーはアクセスできない", async ({ page }) => {
    await page.goto("/admin/draft");
    await expect(page).toHaveURL(/\/login/);
  });
});
