import { test, expect } from "@playwright/test";

const ADMIN_EMAIL = process.env.TEST_USER_EMAIL || "admin@example.com";
const ADMIN_PASSWORD = process.env.TEST_USER_PASSWORD || "password123";
const STAFF_EMAIL = process.env.TEST_STAFF_EMAIL || "staff01@example.com";
const STAFF_PASSWORD = process.env.TEST_STAFF_PASSWORD || "password123";

test.describe("認証フロー", () => {
  test("ログインページが表示される", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test("無効な認証情報でエラーが表示される", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="email"]', "invalid@example.com");
    await page.fill('input[type="password"]', "wrongpassword");
    await page.click('button[type="submit"]');
    await expect(page.locator("text=メールアドレスまたはパスワードが正しくありません")).toBeVisible({ timeout: 10000 });
  });

  test("未認証ユーザーは管理画面にアクセスできない", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login/);
  });

  test.describe("管理者ログイン", () => {
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

    test("ダッシュボードが表示される", async ({ page }) => {
      await expect(page.locator("h1")).toContainText("ダッシュボード");
    });

    test("管理者はユーザー管理メニューが表示される", async ({ page }) => {
      await expect(page.locator('a[href="/admin/users"]')).toBeVisible();
    });

    test("管理者はアクセス統計メニューが表示される", async ({ page }) => {
      await expect(page.locator('a[href="/admin/analytics"]')).toBeVisible();
    });

    test("管理者はログ管理メニューが表示される", async ({ page }) => {
      await expect(page.locator('a[href="/admin/logs"]')).toBeVisible();
    });

    test("文書一覧へ移動できる", async ({ page }) => {
      await page.click('a[href="/admin/documents"]');
      await expect(page).toHaveURL(/\/admin\/documents/);
      await expect(page.locator("h1")).toContainText("文書一覧");
    });

    test("ログアウトが機能する", async ({ page }) => {
      await page.click('[data-testid="user-menu"]');
      const logoutButton = page.locator("text=ログアウト");
      await expect(logoutButton).toBeVisible({ timeout: 5000 });
      await logoutButton.click();
      await expect(page).toHaveURL(/\/login/, { timeout: 15000 });
    });
  });

  test.describe("スタッフログイン", () => {
    test.beforeEach(async ({ page, request }) => {
      try {
        await request.post("/api/test/reset-user-lock", { data: { email: STAFF_EMAIL } });
      } catch { /* ignore */ }
      await page.goto("/login");
      await page.fill('input[type="email"]', STAFF_EMAIL);
      await page.fill('input[type="password"]', STAFF_PASSWORD);
      await page.click('button[type="submit"]');
      await page.waitForURL(/\/admin/, { timeout: 10000 });
    });

    test("ダッシュボードが表示される", async ({ page }) => {
      await expect(page.locator("h1")).toContainText("ダッシュボード");
    });

    test("スタッフはユーザー管理メニューが表示されない", async ({ page }) => {
      await expect(page.locator('a[href="/admin/users"]')).not.toBeVisible();
    });

    test("スタッフは文書一覧にアクセスできる", async ({ page }) => {
      await page.goto("/admin/documents");
      await expect(page.locator("h1")).toContainText("文書一覧");
    });

    test("スタッフはメッセージ受信箱にアクセスできる", async ({ page }) => {
      await page.goto("/admin/messages");
      await expect(page.locator("h1")).toContainText("受信箱");
    });
  });
});

test.describe("アカウントロック", () => {
  test.describe.configure({ mode: "serial" });

  const testEmail = ADMIN_EMAIL;

  test.afterAll(async ({ request }) => {
    // テスト失敗時もロックを必ずリセット
    await request.post("/api/test/reset-user-lock", { data: { email: testEmail } }).catch(() => {});
  });

  test("連続ログイン失敗でアカウントがロックされる", async ({ page, request }) => {
    await request.post("/api/test/reset-user-lock", { data: { email: testEmail } }).catch(() => {});
    await page.goto("/login");

    for (let i = 0; i < 5; i++) {
      await page.fill('input[type="email"]', testEmail);
      await page.fill('input[type="password"]', "wrongpassword123");
      await page.click('button[type="submit"]');
      try {
        await page.waitForSelector(".bg-red-50", { timeout: 5000 });
      } catch { /* ignore */ }
    }

    await expect(page.locator("text=アカウントがロックされています")).toBeVisible({ timeout: 10000 });
  });
});
