import { test, expect } from "@playwright/test";

test.describe("認証フロー", () => {
  test("ログインページが表示される", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveTitle(/Policy Manager/);
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test("空のフォームでエラーが表示される", async ({ page }) => {
    await page.goto("/login");
    await page.click('button[type="submit"]');
    // フォームバリデーションエラーを確認
    await expect(page.locator("text=メールアドレス")).toBeVisible();
  });

  test("無効な認証情報でエラーが表示される", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="email"]', "invalid@example.com");
    await page.fill('input[type="password"]', "wrongpassword");
    await page.click('button[type="submit"]');
    // エラーメッセージを待機
    await expect(page.locator("text=メールアドレスまたはパスワードが正しくありません")).toBeVisible({ timeout: 10000 });
  });

  test("未認証ユーザーは管理画面にアクセスできない", async ({ page }) => {
    await page.goto("/admin");
    // ログインページにリダイレクトされることを確認
    await expect(page).toHaveURL(/\/login/);
  });

  test.describe("認証済みユーザー", () => {
    test.beforeEach(async ({ page }) => {
      // テストユーザーでログイン
      await page.goto("/login");
      await page.fill('input[type="email"]', process.env.TEST_USER_EMAIL || "admin@example.com");
      await page.fill('input[type="password"]', process.env.TEST_USER_PASSWORD || "password123");
      await page.click('button[type="submit"]');
      // ダッシュボードへのリダイレクトを待機
      await page.waitForURL(/\/admin/, { timeout: 10000 });
    });

    test("ダッシュボードが表示される", async ({ page }) => {
      await expect(page.locator("h1")).toContainText("ダッシュボード");
    });

    test("サイドバーのナビゲーションが機能する", async ({ page }) => {
      // 文書一覧へ移動
      await page.click('a[href="/admin/documents"]');
      await expect(page).toHaveURL(/\/admin\/documents/);
      await expect(page.locator("h1")).toContainText("文書一覧");
    });

    test("ログアウトが機能する", async ({ page }) => {
      // ユーザーメニューを開く
      await page.click('[data-testid="user-menu"]');
      // ログアウトボタンをクリック
      await page.click("text=ログアウト");
      // ログインページにリダイレクトされることを確認（タイムアウトを長めに設定）
      await expect(page).toHaveURL(/\/login/, { timeout: 15000 });
    });
  });
});

test.describe("アカウントロック", () => {
  test("連続ログイン失敗でアカウントがロックされる", async ({ page }) => {
    await page.goto("/login");

    // 5回連続で失敗を試みる
    for (let i = 0; i < 5; i++) {
      await page.fill('input[type="email"]', "locktest@example.com");
      await page.fill('input[type="password"]', "wrongpassword");
      await page.click('button[type="submit"]');
      await page.waitForTimeout(500);
    }

    // アカウントロックメッセージを確認
    await expect(
      page.locator("text=アカウントがロックされています")
    ).toBeVisible({ timeout: 10000 });
  });
});
