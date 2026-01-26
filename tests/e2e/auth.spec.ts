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
      // ドロップダウンメニューが開くのを待つ
      const logoutButton = page.locator("text=ログアウト");
      await expect(logoutButton).toBeVisible({ timeout: 5000 });
      // ログアウトボタンをクリック
      await logoutButton.click();
      // ログインページにリダイレクトされることを確認（タイムアウトを長めに設定）
      await expect(page).toHaveURL(/\/login/, { timeout: 15000 });
    });
  });
});

test.describe("アカウントロック", () => {
  // このテストは順次実行（他のテストと競合しないように）
  test.describe.configure({ mode: "serial" });

  // アカウントロックテスト用にテストユーザーを使用
  const testEmail = process.env.TEST_USER_EMAIL || "admin@example.com";
  const wrongPassword = "wrongpassword123";

  test("連続ログイン失敗でアカウントがロックされる", async ({ page, request }) => {
    // テスト前にアカウントのロック状態をリセット
    await request.post("/api/test/reset-user-lock", {
      data: { email: testEmail },
    }).catch(() => {});

    // 新しいコンテキストでテストを実行（他のテストの影響を受けない）
    await page.goto("/login");

    // 5回連続で失敗を試みる
    for (let i = 0; i < 5; i++) {
      // 入力フィールドをクリアしてから入力
      await page.fill('input[type="email"]', testEmail);
      await page.fill('input[type="password"]', wrongPassword);
      await page.click('button[type="submit"]');

      // エラーメッセージが表示されるまで待機
      try {
        await page.waitForSelector(".bg-red-50", { timeout: 5000 });

        // 5回目の試行後はロックメッセージを確認
        if (i === 4) {
          const lockMessage = page.locator("text=アカウントがロックされています");
          if (await lockMessage.isVisible()) {
            // ロックメッセージが表示された場合はテスト成功
            await expect(lockMessage).toBeVisible();
            break;
          }
        }
      } catch {
        // タイムアウトは無視
      }
    }

    // 最終確認：ロックメッセージが表示されているか
    await expect(
      page.locator("text=アカウントがロックされています")
    ).toBeVisible({ timeout: 10000 });

    // テスト後のクリーンアップ
    await request.post("/api/test/reset-user-lock", {
      data: { email: testEmail },
    }).catch(() => {});
  });
});
