import { test, expect } from "@playwright/test";

// AI APIが利用可能かどうかをチェック（ANTHROPIC_API_KEYが設定されているか）
const AI_ENABLED = !!process.env.ANTHROPIC_API_KEY;

test.describe("文案生成", () => {
  const testEmail = process.env.TEST_USER_EMAIL || "admin@example.com";

  test.beforeEach(async ({ page, request }) => {
    // アカウントロックをリセット
    try {
      await request.post("/api/test/reset-user-lock", {
        data: { email: testEmail },
      });
    } catch {
      // 無視
    }

    // テストユーザーでログイン
    await page.goto("/login");
    await page.fill('input[type="email"]', testEmail);
    await page.fill('input[type="password"]', process.env.TEST_USER_PASSWORD || "password123");
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/admin/, { timeout: 10000 });
  });

  test("文案生成ページが表示される", async ({ page }) => {
    await page.goto("/admin/draft");
    await expect(page.locator("h1")).toContainText("文案生成");
    await expect(page.locator('textarea[id="idea"]')).toBeVisible();
  });

  test("アイディア入力欄と追加コンテキスト欄が表示される", async ({ page }) => {
    await page.goto("/admin/draft");

    // アイディア入力欄
    await expect(page.locator('textarea[id="idea"]')).toBeVisible();
    await expect(page.locator('label[for="idea"]')).toContainText("アイディア・要点");

    // 追加コンテキスト欄
    await expect(page.locator('textarea[id="context"]')).toBeVisible();
    await expect(page.locator('label[for="context"]')).toContainText("追加コンテキスト");
  });

  test("生成ボタンが無効化される（アイディア未入力時）", async ({ page }) => {
    await page.goto("/admin/draft");

    // アイディア未入力時は生成ボタンが無効
    const generateButton = page.locator('button:has-text("文案を生成")');
    await expect(generateButton).toBeDisabled();

    // アイディアを入力すると有効になる
    await page.fill('textarea[id="idea"]', "テストアイディア");
    await expect(generateButton).toBeEnabled();
  });

  test("文案を生成できる", async ({ page }) => {
    test.skip(!AI_ENABLED, "AI APIが設定されていません（ANTHROPIC_API_KEY）");
    await page.goto("/admin/draft");

    // アイディアを入力
    await page.fill('textarea[id="idea"]', "在宅勤務に関するガイドラインを作りたい");

    // 追加コンテキストを入力（任意）
    await page.fill('textarea[id="context"]', "週2日まで在宅勤務可能");

    // 生成ボタンをクリック
    await page.click('button:has-text("文案を生成")');

    // ローディング状態を確認
    await expect(page.locator("text=生成中")).toBeVisible({ timeout: 5000 });

    // 生成結果が表示されることを確認（タイムアウト長め）
    await expect(page.locator("pre")).toBeVisible({ timeout: 60000 });
  });

  test("生成結果をコピーできる", async ({ page }) => {
    test.skip(!AI_ENABLED, "AI APIが設定されていません（ANTHROPIC_API_KEY）");
    await page.goto("/admin/draft");

    // 文案を生成
    await page.fill('textarea[id="idea"]', "テスト文案");
    await page.click('button:has-text("文案を生成")');

    // 生成結果を待機
    await expect(page.locator("pre")).toBeVisible({ timeout: 60000 });

    // コピーボタンをクリック
    await page.click('button:has-text("コピー")');

    // コピー成功を確認
    await expect(page.locator("text=コピー済み")).toBeVisible({ timeout: 5000 });
  });

  test("生成結果から文書を作成できる", async ({ page }) => {
    test.skip(!AI_ENABLED, "AI APIが設定されていません（ANTHROPIC_API_KEY）");
    await page.goto("/admin/draft");

    // 文案を生成
    await page.fill('textarea[id="idea"]', "テスト文案");
    await page.click('button:has-text("文案を生成")');

    // 生成結果を待機
    await expect(page.locator("pre")).toBeVisible({ timeout: 60000 });

    // 文書として作成ボタンをクリック
    await page.click('button:has-text("文書として作成")');

    // 文書作成ページに遷移することを確認
    await expect(page).toHaveURL(/\/admin\/documents\/new\?content=/);
  });

  test("再生成機能が表示される（生成後）", async ({ page }) => {
    test.skip(!AI_ENABLED, "AI APIが設定されていません（ANTHROPIC_API_KEY）");
    await page.goto("/admin/draft");

    // 文案を生成
    await page.fill('textarea[id="idea"]', "テスト文案");
    await page.click('button:has-text("文案を生成")');

    // 生成結果を待機
    await expect(page.locator("pre")).toBeVisible({ timeout: 60000 });

    // 再生成セクションが表示されることを確認
    await expect(page.locator("text=修正・再生成")).toBeVisible();
    await expect(page.locator('button:has-text("指示に基づいて再生成")')).toBeVisible();
  });

  test("フィードバックを入力して再生成できる", async ({ page }) => {
    test.skip(!AI_ENABLED, "AI APIが設定されていません（ANTHROPIC_API_KEY）");
    await page.goto("/admin/draft");

    // 文案を生成
    await page.fill('textarea[id="idea"]', "テスト文案");
    await page.click('button:has-text("文案を生成")');

    // 生成結果を待機
    await expect(page.locator("pre")).toBeVisible({ timeout: 60000 });

    // 修正指示を入力
    const feedbackTextarea = page.locator('textarea[placeholder*="修正指示"]');
    await feedbackTextarea.fill("もう少し具体的にしてください");

    // 再生成ボタンをクリック
    await page.click('button:has-text("指示に基づいて再生成")');

    // 再生成完了を待機
    await expect(page.locator("pre")).toBeVisible({ timeout: 60000 });
  });

  test("参照文書が表示される（関連文書がある場合）", async ({ page }) => {
    test.skip(!AI_ENABLED, "AI APIが設定されていません（ANTHROPIC_API_KEY）");
    await page.goto("/admin/draft");

    // 既存の文書に関連するアイディアを入力
    await page.fill('textarea[id="idea"]', "セキュリティポリシーを更新したい");
    await page.click('button:has-text("文案を生成")');

    // 生成結果を待機
    await expect(page.locator("pre")).toBeVisible({ timeout: 60000 });

    // 参照文書セクションを確認（文書がある場合のみ表示）
    const referencedDocs = page.locator("text=参照した既存文書");
    if (await referencedDocs.isVisible()) {
      // リンクがあることを確認
      await expect(page.locator('a[href*="/admin/documents/"]')).toBeVisible();
    }
  });
});

test.describe("文案生成 - 権限", () => {
  test("未認証ユーザーはアクセスできない", async ({ page }) => {
    await page.goto("/admin/draft");
    // ログインページにリダイレクト
    await expect(page).toHaveURL(/\/login/);
  });
});
