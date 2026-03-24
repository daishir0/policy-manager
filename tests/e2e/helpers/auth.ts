import { Page } from "@playwright/test";

// E2Eテスト用ドメイン設定（環境変数から取得）
const AUTH_DOMAIN = process.env.PLAYWRIGHT_AUTH_DOMAIN || 'localhost:3019';
const APP_DOMAIN = process.env.PLAYWRIGHT_APP_DOMAIN || 'localhost:3018';

// 正規表現用にドメインをエスケープ
const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * OIDC認証フローでログインする
 * 1. policy-manager の /login ページで「Senku Auth でログイン」ボタンをクリック
 * 2. 認証サーバーの /oauth/authorize にリダイレクト
 * 3. 未認証の場合は認証サーバーの /login にリダイレクト
 * 4. メールアドレス・パスワードを入力してログイン
 * 5. policy-manager に戻る
 */
export async function loginWithOIDC(
  page: Page,
  email: string,
  password: string
): Promise<void> {
  // 既存のセッションをクリア（異なるユーザーでのログインを確実にするため）
  await page.context().clearCookies();

  // policy-manager のログインページに移動
  await page.goto("/login");
  await page.waitForLoadState("networkidle");

  // 「Senku Auth でログイン」ボタンをクリック
  const loginButton = page.locator('button:has-text("Senku Auth でログイン")');
  await loginButton.waitFor({ state: "visible", timeout: 10000 });
  await loginButton.click();

  // 認証サーバーへリダイレクトを待つ（OAuth authorizeまたはlogin）
  await page.waitForURL(new RegExp(escapeRegex(AUTH_DOMAIN)), { timeout: 20000 });
  await page.waitForLoadState("networkidle");

  // 認証サーバーのログインフォームを待つ
  // （既にログイン済みの場合はコールバックに直接リダイレクトされる）
  const currentUrl = page.url();

  if (currentUrl.includes("/login") || currentUrl.includes("/oauth/authorize")) {
    // ログインフォームが必要な場合
    const emailInput = page.locator('#email, input[name="email"], input[type="email"]');

    try {
      await emailInput.waitFor({ state: "visible", timeout: 10000 });

      // メールアドレスを入力
      await emailInput.fill(email);

      // パスワードを入力
      const passwordInput = page.locator('#password, input[name="password"], input[type="password"]');
      await passwordInput.waitFor({ state: "visible", timeout: 5000 });
      await passwordInput.fill(password);

      // 小さな遅延を入れてReactの状態更新を待つ
      await page.waitForTimeout(500);

      // Enterキーでフォームを送信（ボタンクリックより確実）
      await passwordInput.press('Enter');

      // ログイン処理を待つ - ページ遷移またはエラー表示を待機
      await Promise.race([
        page.waitForURL(/oauth\/authorize|\/admin|policy-manager/, { timeout: 20000 }),
        page.waitForSelector('.bg-red-50, .error, [role="alert"]', { state: "visible", timeout: 20000 }).catch(() => {}),
      ]);
      await page.waitForLoadState("networkidle");
    } catch {
      // ログインフォームが見つからない場合は既にログイン済みかもしれない
      // 次のステップに進む
    }
  }

  // policy-manager に戻るのを待つ（最大30秒）
  try {
    await page.waitForURL(new RegExp(`${escapeRegex(APP_DOMAIN)}/admin`), { timeout: 30000 });
  } catch {
    // コールバック処理中の場合
    if (page.url().includes("/api/auth") || page.url().includes("/callback")) {
      await page.waitForURL(/\/admin/, { timeout: 15000 });
    }
  }

  // 管理画面が表示されるまで待つ
  await page.waitForLoadState("networkidle");
}

/**
 * 簡易ログインチェック - すでにログイン済みかどうか
 */
export async function isLoggedIn(page: Page): Promise<boolean> {
  try {
    await page.goto("/admin", { waitUntil: "networkidle" });
    return !page.url().includes("/login");
  } catch {
    return false;
  }
}
