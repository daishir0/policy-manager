import { test, expect } from "@playwright/test";
import { loginWithOIDC } from "./helpers/auth";

/**
 * 認証フロー E2Eテスト
 *
 * 注: 認証は OIDC 経由で行われます。
 * このテストファイルでは policy-manager 側の認証関連動作をテストします。
 *
 * 環境変数:
 * - TEST_USER_EMAIL: テスト用管理者メールアドレス
 * - TEST_USER_PASSWORD: テスト用管理者パスワード
 * - TEST_STAFF_EMAIL: テスト用スタッフメールアドレス
 * - TEST_STAFF_PASSWORD: テスト用スタッフパスワード
 */

const ADMIN_EMAIL = process.env.TEST_USER_EMAIL || "admin@example.com";
const ADMIN_PASSWORD = process.env.TEST_USER_PASSWORD || "password123";
const STAFF_EMAIL = process.env.TEST_STAFF_EMAIL || "staff01@example.com";
const STAFF_PASSWORD = process.env.TEST_STAFF_PASSWORD || "password123";

// テストタイムアウトを延長（ログインフローが長い場合があるため）
test.setTimeout(120000);

test.describe("認証フロー（OIDC経由）", () => {
  test("未認証ユーザーはログインページへリダイレクトされる", async ({ page }) => {
    await page.goto("/admin");
    // OIDC経由のログインのため、認証サーバーへリダイレクトされるか、
    // または policy-manager のログインページが表示される
    await expect(page).toHaveURL(/\/(login|oauth\/authorize)/);
  });

  test("ログインページにOIDCログインボタンが表示される", async ({ page }) => {
    await page.goto("/login");
    // OIDCプロバイダーでのログインボタン
    await expect(page.locator('button:has-text("ログイン")').first()).toBeVisible();
  });

  test.describe("管理者セッション", () => {
    test.beforeEach(async ({ page }) => {
      await loginWithOIDC(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    });

    test("管理画面にアクセスできる", async ({ page }) => {
      await page.goto("/admin");
      // ダッシュボードまたはポリシー一覧が表示される
      await expect(
        page.locator("h1").or(page.locator('[class*="dashboard"], [class*="policies"]'))
      ).toBeVisible({ timeout: 10000 });
    });

    test("管理者はユーザー管理メニューが表示される", async ({ page }) => {
      await page.goto("/admin");
      await expect(page.locator('a[href="/admin/users"]')).toBeVisible();
    });

    test("管理者はアクセス統計メニューが表示される", async ({ page }) => {
      await page.goto("/admin");
      await expect(page.locator('a[href="/admin/analytics"]')).toBeVisible();
    });

    test("管理者はログ管理メニューが表示される", async ({ page }) => {
      await page.goto("/admin");
      await expect(page.locator('a[href="/admin/logs"]')).toBeVisible();
    });

    test("文書一覧へ移動できる", async ({ page }) => {
      await page.goto("/admin");
      await page.click('a[href="/admin/policies"]');
      await expect(page).toHaveURL(/\/admin\/policies/);
    });

    test("ログアウトが機能する", async ({ page }) => {
      await page.goto("/admin");
      await page.click('[data-testid="user-menu"]');
      const logoutButton = page.locator("text=ログアウト");
      await expect(logoutButton).toBeVisible({ timeout: 5000 });
      await logoutButton.click();
      // ログアウト後はログインページへリダイレクト
      await expect(page).toHaveURL(/\/login/, { timeout: 15000 });
    });
  });

  test.describe("スタッフセッション", () => {
    test.beforeEach(async ({ page }) => {
      await loginWithOIDC(page, STAFF_EMAIL, STAFF_PASSWORD);
    });

    test("管理画面にアクセスできる", async ({ page }) => {
      await page.goto("/admin");
      await expect(
        page.locator("h1").or(page.locator('[class*="dashboard"], [class*="policies"]'))
      ).toBeVisible({ timeout: 10000 });
    });

    test("スタッフはユーザー管理メニューが表示されない", async ({ page }) => {
      await page.goto("/admin");
      await expect(page.locator('a[href="/admin/users"]')).not.toBeVisible();
    });

    test("スタッフは文書一覧にアクセスできる", async ({ page }) => {
      await page.goto("/admin/policies");
      await expect(page.locator("h1")).toContainText(/ポリシー|文書/);
    });

    test("スタッフはメッセージ受信箱にアクセスできる", async ({ page }) => {
      await page.goto("/admin/messages");
      await expect(page.locator("h1")).toContainText(/受信箱|メッセージ/);
    });
  });
});

test.describe("アカウントロック（auth サービス管理）", () => {
  /**
   * アカウントロック機能は認証サービスで管理されます。
   * policy-manager 側ではロック状態の確認APIのみ提供します。
   */
  test("check-lock APIが正しく応答する（deprecated）", async ({ request }) => {
    const response = await request.post("/api/auth/check-lock", {
      data: { email: "test@example.com" },
    });
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data).toHaveProperty("locked");
    // deprecation notice（デプロイ後に有効）
    // expect(data).toHaveProperty("message");
  });
});

test.describe("セッション管理", () => {
  test("セッションが切れた場合、再ログインを促す", async ({ page }) => {
    // ログインしていない状態でAPIを呼ぶ
    const response = await page.request.get("/api/users");
    expect(response.status()).toBe(401);
    const data = await response.json();
    expect(data.error).toContain("認証");
  });

  test("クッキーがない場合、管理画面からログインページへリダイレクト", async ({
    page,
    context,
  }) => {
    // クッキーをクリア
    await context.clearCookies();
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login/);
  });
});
