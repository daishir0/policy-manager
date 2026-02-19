import { test, expect } from "@playwright/test";

const ADMIN_EMAIL = process.env.TEST_USER_EMAIL || "admin@example.com";
const ADMIN_PASSWORD = process.env.TEST_USER_PASSWORD || "password123";

test.describe("ユーザー管理", () => {
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

  test("ユーザー管理ページが表示される", async ({ page }) => {
    await page.goto("/admin/users");
    await expect(page.locator("h1")).toContainText("ユーザー管理");
  });

  test("ユーザー一覧が表示される", async ({ page }) => {
    await page.goto("/admin/users");
    await expect(page.locator("text=ユーザー一覧")).toBeVisible({ timeout: 10000 });
    await expect(page.locator("text=件のユーザー")).toBeVisible({ timeout: 10000 });
  });

  test("ロールバッジがADMIN/STAFFで表示される", async ({ page }) => {
    await page.goto("/admin/users");
    await page.waitForTimeout(2000);
    const adminBadge = page.locator("text=管理者").first();
    const staffBadge = page.locator("text=スタッフ").first();
    const roleBadge = adminBadge.or(staffBadge);
    await expect(roleBadge).toBeVisible({ timeout: 10000 });
  });

  test("ユーザー検索が機能する", async ({ page }) => {
    await page.goto("/admin/users");
    await page.fill('input[placeholder*="検索"]', "admin");
    await page.click('button:has-text("検索")');
    await expect(page.locator(`text=${ADMIN_EMAIL}`)).toBeVisible({ timeout: 10000 });
  });

  test("新規ユーザー作成ダイアログが開く", async ({ page }) => {
    await page.goto("/admin/users");
    await page.click('button:has-text("新規ユーザー")');
    await expect(page.locator("text=新規ユーザー作成")).toBeVisible();
    await expect(page.locator('input[id="email"]')).toBeVisible();
    await expect(page.locator('input[id="name"]')).toBeVisible();
    await expect(page.locator('input[id="password"]')).toBeVisible();
    // ロール選択にはADMINとSTAFFのみ存在（selectのoption要素はattachedを確認）
    await expect(page.locator('option[value="STAFF"]')).toBeAttached();
    await expect(page.locator('option[value="ADMIN"]')).toBeAttached();
    // 廃止されたロールが存在しないことを確認
    await expect(page.locator('option[value="EMPLOYEE"]')).not.toBeAttached();
    await expect(page.locator('option[value="DOCUMENT_ADMIN"]')).not.toBeAttached();
  });

  test("新規ユーザーを作成できる", async ({ page }) => {
    const testEmail = `test-${Date.now()}@example.com`;
    await page.goto("/admin/users");
    await page.click('button:has-text("新規ユーザー")');
    await page.fill('input[id="email"]', testEmail);
    await page.fill('input[id="name"]', "テストユーザー");
    await page.fill('input[id="password"]', "TestPassword123!");
    await page.selectOption('select[id="role"]', "STAFF");
    await page.locator('button:has-text("作成")').last().click();
    await expect(page.locator("text=新規ユーザー作成")).toBeHidden({ timeout: 15000 });
    await expect(page.locator(`text=${testEmail}`)).toBeVisible({ timeout: 10000 });
  });

  test("ユーザー編集ダイアログが開く", async ({ page }) => {
    await page.goto("/admin/users");
    const editButton = page.locator('[data-testid="edit-user-button"]').first();
    await expect(editButton).toBeVisible({ timeout: 10000 });
    await editButton.click();
    await expect(page.locator("text=ユーザー編集")).toBeVisible();
    await expect(page.locator('input[id="edit-name"]')).toBeVisible();
    // ロール選択にはADMINとSTAFFのみ（option要素はattachedを確認）
    await expect(page.locator('select[id="edit-role"] option[value="STAFF"]')).toBeAttached();
    await expect(page.locator('select[id="edit-role"] option[value="ADMIN"]')).toBeAttached();
  });

  test("ユーザー情報を編集できる", async ({ page }) => {
    const testEmail = `edit-test-${Date.now()}@example.com`;
    const updatedName = `更新ユーザー_${Date.now()}`;

    await page.goto("/admin/users");
    await page.click('button:has-text("新規ユーザー")');
    await page.fill('input[id="email"]', testEmail);
    await page.fill('input[id="name"]', "編集前ユーザー");
    await page.fill('input[id="password"]', "TestPassword123!");
    await page.selectOption('select[id="role"]', "STAFF");
    await page.locator('button:has-text("作成")').last().click();
    await expect(page.locator("text=新規ユーザー作成")).toBeHidden({ timeout: 15000 });
    await expect(page.locator(`text=${testEmail}`)).toBeVisible({ timeout: 10000 });

    const userRow = page.locator(`text=${testEmail}`).locator("..").locator("..").locator("..");
    await userRow.locator('[data-testid="edit-user-button"]').click();
    await expect(page.getByRole("heading", { name: "ユーザー編集" })).toBeVisible();
    await page.fill('input[id="edit-name"]', updatedName);
    await page.click('button:has-text("更新")');
    await expect(page.getByRole("heading", { name: "ユーザー編集" })).toBeHidden({ timeout: 10000 });
    await page.waitForTimeout(1000);
    const updatedRow = page.locator(`text=${testEmail}`).locator("..").locator("..").locator("..");
    await expect(updatedRow.locator(`text=${updatedName}`)).toBeVisible({ timeout: 15000 });
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

  test("ユーザー削除の確認ダイアログが表示される", async ({ page }) => {
    await page.goto("/admin/users");
    page.on("dialog", async (dialog) => {
      expect(dialog.type()).toBe("confirm");
      await dialog.dismiss();
    });
    const deleteButtons = page.locator('[data-testid="delete-user-button"]');
    const count = await deleteButtons.count();
    if (count > 0) {
      await deleteButtons.first().click();
    }
  });
});

test.describe("ユーザー管理 - 権限", () => {
  test("未認証ユーザーはアクセスできない", async ({ page }) => {
    await page.goto("/admin/users");
    await expect(page).toHaveURL(/\/login/);
  });
});
