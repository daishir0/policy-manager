import { test, expect } from "@playwright/test";

// AI APIが利用可能かどうかをチェック（OPENAI_API_KEYが設定されているか）
const AI_ENABLED = !!process.env.OPENAI_API_KEY;

test.describe("対話型Q&A", () => {
  test.beforeEach(async ({ page }) => {
    // テストユーザーでログイン
    await page.goto("/login");
    await page.fill('input[type="email"]', process.env.TEST_USER_EMAIL || "admin@example.com");
    await page.fill('input[type="password"]', process.env.TEST_USER_PASSWORD || "password123");
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/admin/, { timeout: 10000 });
  });

  test("Q&Aページが表示される", async ({ page }) => {
    await page.goto("/admin/qa");
    await expect(page.locator("h1")).toContainText("Q&A対話");
    await expect(page.locator("textarea")).toBeVisible();
  });

  test("質問を送信できる", async ({ page }) => {
    test.skip(!AI_ENABLED, "AI APIが設定されていません（OPENAI_API_KEY）");
    await page.goto("/admin/qa");

    // 質問を入力
    await page.fill("textarea", "休暇申請の方法を教えてください");

    // 送信ボタンをクリック
    await page.click('button[type="submit"]');

    // ユーザーメッセージが表示されることを確認
    await expect(page.locator("text=休暇申請の方法を教えてください")).toBeVisible();

    // ローディング状態を確認
    await expect(page.locator("text=回答を生成中")).toBeVisible();

    // 回答が表示されることを確認（タイムアウト長め）
    await expect(page.locator('[data-testid="assistant-message"]')).toBeVisible({ timeout: 60000 });
  });

  test("Enterキーで質問を送信できる", async ({ page }) => {
    await page.goto("/admin/qa");

    // 質問を入力してEnterキー
    await page.fill("textarea", "テスト質問");
    await page.keyboard.press("Enter");

    // ユーザーメッセージが表示されることを確認
    await expect(page.locator("text=テスト質問")).toBeVisible();
  });

  test("Shift+Enterで改行できる", async ({ page }) => {
    await page.goto("/admin/qa");

    // 質問を入力
    await page.click("textarea");
    await page.keyboard.type("1行目");
    await page.keyboard.press("Shift+Enter");
    await page.keyboard.type("2行目");

    // テキストエリアに複数行が含まれることを確認
    const textarea = page.locator("textarea");
    await expect(textarea).toHaveValue(/1行目\n2行目/);
  });

  test("根拠文書へのリンクが表示される", async ({ page }) => {
    test.skip(!AI_ENABLED, "AI APIが設定されていません（OPENAI_API_KEY）");
    await page.goto("/admin/qa");

    // 質問を送信
    await page.fill("textarea", "セキュリティポリシーについて教えてください");
    await page.click('button[type="submit"]');

    // 回答を待機
    await expect(page.locator('[data-testid="assistant-message"]')).toBeVisible({ timeout: 60000 });

    // 参照文書セクションを確認
    const sources = page.locator("text=参照文書");
    if (await sources.isVisible()) {
      // リンクが存在することを確認
      await expect(page.locator('a:has-text("document")')).toBeVisible();
    }
  });

  test.describe("フィードバック機能", () => {
    test("回答に良いフィードバックを送信できる", async ({ page }) => {
      test.skip(!AI_ENABLED, "AI APIが設定されていません（OPENAI_API_KEY）");
      await page.goto("/admin/qa");

      // 質問を送信
      await page.fill("textarea", "テスト質問です");
      await page.click('button[type="submit"]');

      // 回答を待機
      await expect(page.locator('[data-testid="assistant-message"]')).toBeVisible({ timeout: 60000 });

      // 👍ボタンをクリック
      await page.click('button:has([data-lucide="thumbs-up"])');

      // ボタンが選択状態になることを確認
      await expect(page.locator('button:has([data-lucide="thumbs-up"])')).toHaveClass(/secondary/);
    });

    test("回答に悪いフィードバックを送信できる", async ({ page }) => {
      test.skip(!AI_ENABLED, "AI APIが設定されていません（OPENAI_API_KEY）");
      await page.goto("/admin/qa");

      // 質問を送信
      await page.fill("textarea", "テスト質問です");
      await page.click('button[type="submit"]');

      // 回答を待機
      await expect(page.locator('[data-testid="assistant-message"]')).toBeVisible({ timeout: 60000 });

      // 👎ボタンをクリック
      await page.click('button:has([data-lucide="thumbs-down"])');

      // ボタンが選択状態になることを確認
      await expect(page.locator('button:has([data-lucide="thumbs-down"])')).toHaveClass(/secondary/);
    });
  });

  test("会話履歴が保持される", async ({ page }) => {
    test.skip(!AI_ENABLED, "AI APIが設定されていません（OPENAI_API_KEY）");
    await page.goto("/admin/qa");

    // 最初の質問
    await page.fill("textarea", "最初の質問");
    await page.click('button[type="submit"]');
    await expect(page.locator('[data-testid="assistant-message"]')).toBeVisible({ timeout: 60000 });

    // 2番目の質問
    await page.fill("textarea", "2番目の質問");
    await page.click('button[type="submit"]');

    // 両方の質問が表示されていることを確認
    await expect(page.locator("text=最初の質問")).toBeVisible();
    await expect(page.locator("text=2番目の質問")).toBeVisible();
  });
});
