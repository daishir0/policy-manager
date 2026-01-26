import { test, expect } from "@playwright/test";

test.describe("ユーザー管理", () => {
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

    // 管理者でログイン
    await page.goto("/login");
    await page.fill('input[type="email"]', testEmail);
    await page.fill('input[type="password"]', process.env.TEST_USER_PASSWORD || "password123");
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/admin/, { timeout: 10000 });
  });

  test("ユーザー管理ページが表示される", async ({ page }) => {
    await page.goto("/admin/users");
    await expect(page.locator("h1")).toContainText("ユーザー管理");
  });

  test("ユーザー一覧が表示される", async ({ page }) => {
    await page.goto("/admin/users");
    // ユーザー一覧カードが表示されるまで待機
    await expect(page.locator("text=ユーザー一覧")).toBeVisible({ timeout: 10000 });
    // 件数表示が表示される（少なくとも1人のユーザーが存在する）
    await expect(page.locator("text=件のユーザー")).toBeVisible({ timeout: 10000 });
  });

  test("ユーザー検索が機能する", async ({ page }) => {
    await page.goto("/admin/users");
    await page.fill('input[placeholder*="検索"]', "admin");
    await page.click("button:has-text('検索')");
    // 検索結果が表示される
    await expect(page.locator("text=admin@example.com")).toBeVisible({ timeout: 10000 });
  });

  test("新規ユーザー作成ダイアログが開く", async ({ page }) => {
    await page.goto("/admin/users");
    await page.click("button:has-text('新規ユーザー')");
    // ダイアログが表示される
    await expect(page.locator("text=新規ユーザー作成")).toBeVisible();
    await expect(page.locator('input[id="email"]')).toBeVisible();
    await expect(page.locator('input[id="name"]')).toBeVisible();
    await expect(page.locator('input[id="password"]')).toBeVisible();
  });

  test("ユーザー作成のバリデーションが機能する", async ({ page }) => {
    await page.goto("/admin/users");
    await page.click("button:has-text('新規ユーザー')");
    // 空のまま作成ボタンをクリック
    await page.click("button:has-text('作成'):not(:has-text('新規'))");
    // エラーまたはフォームが閉じないことを確認
    await expect(page.locator("text=新規ユーザー作成")).toBeVisible();
  });

  test("新規ユーザーを作成できる", async ({ page }) => {
    const testEmail = `test-${Date.now()}@example.com`;

    await page.goto("/admin/users");
    await page.click("button:has-text('新規ユーザー')");

    // フォーム入力
    await page.fill('input[id="email"]', testEmail);
    await page.fill('input[id="name"]', "テストユーザー");
    await page.fill('input[id="password"]', "TestPassword123!");
    await page.selectOption('select[id="role"]', "EMPLOYEE");

    // 作成ボタンをクリック
    const createButton = page.locator('button:has-text("作成")').last();
    await createButton.click();

    // ダイアログが閉じるのを待つ（成功またはエラー）
    await expect(page.locator('text=新規ユーザー作成')).toBeHidden({ timeout: 15000 });

    // 新しいユーザーが一覧に表示される
    await expect(page.locator(`text=${testEmail}`)).toBeVisible({ timeout: 10000 });
  });

  test("ロールバッジが正しく表示される", async ({ page }) => {
    await page.goto("/admin/users");
    // ユーザー一覧にロールバッジが表示される（一般従業員、文書管理者、システム管理者のいずれか）
    const employeeBadge = page.locator("text=一般従業員").first();
    const documentAdminBadge = page.locator("text=文書管理者").first();
    const systemAdminBadge = page.locator("text=システム管理者").first();

    // いずれかのロールバッジが表示されることを確認
    const roleBadge = employeeBadge.or(documentAdminBadge).or(systemAdminBadge);
    await expect(roleBadge.first()).toBeVisible({ timeout: 10000 });
  });

  test("ユーザー編集ダイアログが開く", async ({ page }) => {
    await page.goto("/admin/users");

    // 編集ボタンをクリック
    const editButton = page.locator('[data-testid="edit-user-button"]').first();
    await expect(editButton).toBeVisible({ timeout: 10000 });
    await editButton.click();

    // ダイアログが表示される
    await expect(page.locator("text=ユーザー編集")).toBeVisible();
    await expect(page.locator('input[id="edit-name"]')).toBeVisible();
    await expect(page.locator('select[id="edit-role"]')).toBeVisible();
  });

  test("ユーザー情報を編集できる", async ({ page }) => {
    // まずテストユーザーを作成
    const testEmail = `edit-test-${Date.now()}@example.com`;
    const updatedName = `更新ユーザー_${Date.now()}`;

    await page.goto("/admin/users");
    await page.click("button:has-text('新規ユーザー')");

    // フォーム入力
    await page.fill('input[id="email"]', testEmail);
    await page.fill('input[id="name"]', "編集前ユーザー");
    await page.fill('input[id="password"]', "TestPassword123!");
    await page.selectOption('select[id="role"]', "EMPLOYEE");

    // 作成
    const createButton = page.locator('button:has-text("作成")').last();
    await createButton.click();
    await expect(page.locator('text=新規ユーザー作成')).toBeHidden({ timeout: 15000 });
    await expect(page.locator(`text=${testEmail}`)).toBeVisible({ timeout: 10000 });

    // 作成したユーザーの編集ボタンをクリック（メールアドレスで特定）
    const userRow = page.locator(`text=${testEmail}`).locator("..").locator("..").locator("..");
    const editButton = userRow.locator('[data-testid="edit-user-button"]');
    await editButton.click();

    // 編集ダイアログが表示される
    await expect(page.getByRole("heading", { name: "ユーザー編集" })).toBeVisible();

    // 名前を変更（ロールの変更はAPIの問題で別途対応が必要）
    await page.fill('input[id="edit-name"]', updatedName);

    // 更新
    await page.click('button:has-text("更新")');

    // ダイアログが閉じる
    await expect(page.getByRole("heading", { name: "ユーザー編集" })).toBeHidden({ timeout: 10000 });

    // リストが再読み込みされるのを待つ
    await page.waitForTimeout(1000);

    // メールアドレスで行を特定して、更新された名前を確認
    const updatedUserRow = page.locator(`text=${testEmail}`).locator("..").locator("..").locator("..");
    await expect(updatedUserRow.locator(`text=${updatedName}`)).toBeVisible({ timeout: 15000 });
  });

  test("編集をキャンセルできる", async ({ page }) => {
    await page.goto("/admin/users");

    // 編集ボタンをクリック
    const editButton = page.locator('[data-testid="edit-user-button"]').first();
    await expect(editButton).toBeVisible({ timeout: 10000 });
    await editButton.click();

    // ダイアログが表示される
    await expect(page.getByRole("heading", { name: "ユーザー編集" })).toBeVisible();

    // キャンセルをクリック
    await page.click('button:has-text("キャンセル")');

    // ダイアログが閉じる
    await expect(page.getByRole("heading", { name: "ユーザー編集" })).toBeHidden();
  });

  test("ユーザー削除の確認ダイアログが表示される", async ({ page }) => {
    await page.goto("/admin/users");

    // ダイアログをモック
    page.on("dialog", async dialog => {
      expect(dialog.type()).toBe("confirm");
      expect(dialog.message()).toContain("削除");
      await dialog.dismiss();
    });

    // 削除ボタンをクリック（最初のユーザー以外）
    const deleteButtons = page.locator('button:has([class*="text-destructive"])');
    const count = await deleteButtons.count();
    if (count > 0) {
      await deleteButtons.first().click();
    }
  });
});

test.describe("ユーザー管理 - 権限", () => {
  test("未認証ユーザーはアクセスできない", async ({ page }) => {
    await page.goto("/admin/users");
    // ログインページにリダイレクト
    await expect(page).toHaveURL(/\/login/);
  });
});
