import { test, expect } from "@playwright/test";
import { loginWithOIDC } from "./helpers/auth";

/**
 * ユーザー管理 E2Eテスト
 *
 * 注: ユーザーの作成・削除・ロール管理は auth.senku.work で行われます。
 * policy-manager ではユーザー一覧の表示、名前の編集、文書の割り当てのみ行えます。
 */

const ADMIN_EMAIL = process.env.TEST_USER_EMAIL || "admin@example.com";
const ADMIN_PASSWORD = process.env.TEST_USER_PASSWORD || "password123";

test.describe("ユーザー管理", () => {
  test.beforeEach(async ({ page }) => {
    await loginWithOIDC(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  });

  test("ユーザー管理ページが表示される", async ({ page }) => {
    await page.goto("/admin/users");
    await expect(page.locator("h1")).toContainText("ユーザー管理");
  });

  test("ユーザー一覧が表示される", async ({ page }) => {
    await page.goto("/admin/users");
    await expect(page.locator("text=ユーザー一覧")).toBeVisible({ timeout: 10000 });
    await expect(page.locator("text=件のユーザー")).toBeVisible({ timeout: 10000 });
  });

  test("ロールバッジが管理者/スタッフで表示される", async ({ page }) => {
    await page.goto("/admin/users");
    await page.waitForTimeout(2000);
    // Either admin or staff badge should be visible
    const adminBadge = page.locator('[data-slot="badge"]:has-text("管理者")').first();
    const staffBadge = page.locator('[data-slot="badge"]:has-text("スタッフ")').first();
    const adminVisible = await adminBadge.isVisible().catch(() => false);
    const staffVisible = await staffBadge.isVisible().catch(() => false);
    expect(adminVisible || staffVisible).toBe(true);
  });

  test("ユーザー検索が機能する", async ({ page }) => {
    await page.goto("/admin/users");
    await page.fill('input[placeholder*="検索"]', "admin");
    await page.click('button:has-text("検索")');
    // 検索結果が表示される（メールアドレスまたは名前に「admin」を含むユーザー）
    await expect(page.locator(`text=admin`).first()).toBeVisible({ timeout: 10000 });
  });

  test("認証サービスへのリンクが表示される", async ({ page }) => {
    await page.goto("/admin/users");
    // ユーザー作成はauthサービスで行うためのリンク
    const authLink = page.locator('a[href*="auth.senku.work"]');
    await expect(authLink).toBeVisible({ timeout: 10000 });
    await expect(authLink).toContainText(/認証サービス|ユーザー管理/);
  });

  test("ユーザー編集ダイアログが開く", async ({ page }) => {
    await page.goto("/admin/users");
    const editButton = page.locator('[data-testid="edit-user-button"]').first();
    await expect(editButton).toBeVisible({ timeout: 10000 });
    await editButton.click();
    await expect(page.locator("text=ユーザー編集")).toBeVisible();
    await expect(page.locator('input[id="edit-name"]')).toBeVisible();
    // ロール選択はauthサービスで行うため存在しない
    await expect(page.locator('select[id="edit-role"]')).not.toBeVisible();
  });

  test("ユーザー名を編集できる", async ({ page }) => {
    await page.goto("/admin/users");
    const editButton = page.locator('[data-testid="edit-user-button"]').first();
    await expect(editButton).toBeVisible({ timeout: 10000 });
    await editButton.click();

    await expect(page.getByRole("heading", { name: "ユーザー編集" })).toBeVisible();

    // 名前を変更
    const nameInput = page.locator('input[id="edit-name"]');
    const originalName = await nameInput.inputValue();
    const newName = `テスト名_${Date.now()}`;
    await nameInput.clear();
    await nameInput.fill(newName);
    await page.click('button:has-text("更新")');

    // ダイアログが閉じる
    await expect(page.getByRole("heading", { name: "ユーザー編集" })).toBeHidden({ timeout: 10000 });

    // 変更が反映される
    await page.waitForTimeout(1000);
    await expect(page.locator(`text=${newName}`)).toBeVisible({ timeout: 15000 });

    // 元に戻す
    await editButton.click();
    await nameInput.clear();
    await nameInput.fill(originalName || "管理者");
    await page.click('button:has-text("更新")');
  });

  test("担当文書ボタンが表示される", async ({ page }) => {
    await page.goto("/admin/users");
    await page.waitForTimeout(2000);
    await expect(page.locator('button:has-text("担当文書")').first()).toBeVisible({ timeout: 10000 });
  });

  test("担当文書ダイアログが開く", async ({ page }) => {
    await page.goto("/admin/users");
    await page.waitForTimeout(2000);
    await page.locator('button:has-text("担当文書")').first().click();
    await expect(page.locator("text=担当文書管理")).toBeVisible({ timeout: 5000 });
  });

  test("担当文書ダイアログで文書一覧が表示される", async ({ page }) => {
    await page.goto("/admin/users");
    await page.waitForTimeout(2000);
    await page.locator('button:has-text("担当文書")').first().click();
    await expect(page.locator("text=担当文書管理")).toBeVisible({ timeout: 5000 });
    // 文書が読み込まれるまで待つ
    await page.waitForTimeout(2000);
    // 「担当者に設定」ボタンまたは「担当中」バッジが表示される
    const assignButton = page.locator('button:has-text("担当者に設定")').first();
    const assignedBadge = page.locator('[data-slot="badge"]:has-text("担当中")').first();
    const assignVisible = await assignButton.isVisible().catch(() => false);
    const badgeVisible = await assignedBadge.isVisible().catch(() => false);
    expect(assignVisible || badgeVisible).toBe(true);
  });
});

test.describe("ユーザー管理 - 権限", () => {
  test("未認証ユーザーはアクセスできない", async ({ page }) => {
    await page.goto("/admin/users");
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("ユーザー管理API", () => {
  test("POST /api/users はauthサービスへのリダイレクト案内を返す", async ({ request }) => {
    const response = await request.post("/api/users", {
      data: {
        email: "test@example.com",
        name: "Test User",
        password: "password123",
      },
    });
    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data.error).toContain("認証サービス");
    expect(data.authServiceUrl).toBeDefined();
  });

  test("GET /api/users は認証なしで401を返す", async ({ request }) => {
    const response = await request.get("/api/users");
    expect(response.status()).toBe(401);
  });
});
