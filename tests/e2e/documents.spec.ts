import { test, expect } from "@playwright/test";

// AI APIが利用可能かどうかをチェック（OPENAI_API_KEYが設定されているか）
const AI_ENABLED = !!process.env.OPENAI_API_KEY;

test.describe("文書管理フロー", () => {
  test.beforeEach(async ({ page }) => {
    // テストユーザーでログイン
    await page.goto("/login");
    await page.fill('input[type="email"]', process.env.TEST_USER_EMAIL || "admin@example.com");
    await page.fill('input[type="password"]', process.env.TEST_USER_PASSWORD || "password123");
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/admin/, { timeout: 10000 });
  });

  test("文書一覧ページが表示される", async ({ page }) => {
    await page.goto("/admin/documents");
    await expect(page.locator("h1")).toContainText("文書一覧");
    await expect(page.locator("table")).toBeVisible();
  });

  test("新規文書作成ページに遷移できる", async ({ page }) => {
    await page.goto("/admin/documents");
    await page.click('text=新規作成');
    await expect(page).toHaveURL(/\/admin\/documents\/new/);
  });

  test.describe("文書作成・編集", () => {
    test("新規文書を作成できる", async ({ page }) => {
      await page.goto("/admin/documents/new");

      // タイトル入力
      await page.fill('input[name="title"]', "テスト文書");

      // エディタに本文を入力
      await page.click(".ProseMirror");
      await page.keyboard.type("これはテスト文書の本文です。");

      // 保存
      await page.click('button:has-text("保存")');

      // 成功メッセージを確認
      await expect(page.locator("text=文書を保存しました")).toBeVisible({ timeout: 10000 });
    });

    test("文書を編集できる", async ({ page }) => {
      // 文書一覧から最初の文書を選択
      await page.goto("/admin/documents");
      await page.click("table tbody tr:first-child a");
      await expect(page).toHaveURL(/\/admin\/documents\/[^/]+$/);

      // 編集ボタンをクリック
      await page.click('text=編集');
      await expect(page).toHaveURL(/\/admin\/documents\/[^/]+\/edit/);

      // タイトルを更新
      await page.fill('input[name="title"]', "更新されたテスト文書");

      // 保存
      await page.click('button:has-text("保存")');

      // 成功メッセージを確認
      await expect(page.locator("text=文書を更新しました")).toBeVisible({ timeout: 10000 });
    });

    test("矛盾チェックが実行される", async ({ page }) => {
      test.skip(!AI_ENABLED, "AI APIが設定されていません（OPENAI_API_KEY）");
      await page.goto("/admin/documents/new");

      // タイトル入力
      await page.fill('input[name="title"]', "矛盾チェックテスト");

      // エディタに本文を入力
      await page.click(".ProseMirror");
      await page.keyboard.type("この文書には矛盾する内容が含まれています。");

      // 矛盾チェックボタンをクリック
      await page.click('button:has-text("矛盾チェック")');

      // チェック結果を待機
      await expect(page.locator('[data-testid="contradiction-result"]')).toBeVisible({ timeout: 30000 });
    });
  });

  test.describe("バージョン管理", () => {
    test("バージョン履歴が表示される", async ({ page }) => {
      // 文書詳細ページへ移動
      await page.goto("/admin/documents");
      await page.click("table tbody tr:first-child a");

      // 履歴タブをクリック
      await page.click('text=履歴');

      // バージョン履歴が表示されることを確認
      await expect(page.locator("text=バージョン履歴")).toBeVisible();
    });
  });

  test.describe("添付ファイル", () => {
    test("添付ファイルをアップロードできる", async ({ page }) => {
      // 文書編集ページへ移動
      await page.goto("/admin/documents");
      await page.click("table tbody tr:first-child td:last-child button:has(svg)");
      await page.click('text=編集');

      // ファイル選択
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles({
        name: "test.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from("Test PDF content"),
      });

      // アップロード成功を確認
      await expect(page.locator("text=test.pdf")).toBeVisible({ timeout: 10000 });
    });

    test("添付ファイルをダウンロードできる", async ({ page }) => {
      // 文書詳細ページへ移動
      await page.goto("/admin/documents");
      await page.click("table tbody tr:first-child a");

      // 添付ファイルセクションを確認
      const attachments = page.locator('[data-testid="attachments"]');
      if (await attachments.isVisible()) {
        // ダウンロードリンクをクリック
        const [download] = await Promise.all([
          page.waitForEvent("download"),
          page.click('a[download]'),
        ]);
        expect(download).toBeTruthy();
      }
    });
  });

  test.describe("文書公開フロー", () => {
    test("文書を公開できる", async ({ page }) => {
      // 下書き文書を作成または選択
      await page.goto("/admin/documents");
      await page.click("table tbody tr:first-child a");

      // 公開ボタンをクリック
      const publishButton = page.locator('button:has-text("公開")');
      if (await publishButton.isVisible()) {
        await publishButton.click();

        // 確認ダイアログ
        await page.click('button:has-text("確認")');

        // 公開成功を確認
        await expect(page.locator("text=公開中")).toBeVisible({ timeout: 10000 });
      }
    });

    test("文書を廃止できる", async ({ page }) => {
      await page.goto("/admin/documents");
      await page.click("table tbody tr:first-child a");

      // 廃止ボタンをクリック
      const retireButton = page.locator('button:has-text("廃止")');
      if (await retireButton.isVisible()) {
        await retireButton.click();

        // 確認ダイアログ
        await page.click('button:has-text("確認")');

        // 廃止成功を確認
        await expect(page.locator("text=廃止")).toBeVisible({ timeout: 10000 });
      }
    });
  });
});
