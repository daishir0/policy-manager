import { test, expect } from "@playwright/test";
import { loginWithOIDC } from "./helpers/auth";

const ADMIN_EMAIL = process.env.TEST_USER_EMAIL || "admin@example.com";
const ADMIN_PASSWORD = process.env.TEST_USER_PASSWORD || "password123";

// テストタイムアウトを延長（ログインフローが長い場合があるため）
test.setTimeout(120000);

test.describe("文書管理", () => {
  test.beforeEach(async ({ page }) => {
    await loginWithOIDC(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  });

  test("文書一覧ページが表示される", async ({ page }) => {
    await page.goto("/admin/documents");
    await expect(page.locator("h1")).toContainText("文書一覧");
    await expect(page.locator("table")).toBeVisible({ timeout: 10000 });
  });

  test("文書一覧に担当者列が表示される", async ({ page }) => {
    await page.goto("/admin/documents");
    await expect(page.locator("th:has-text('担当者')")).toBeVisible({ timeout: 10000 });
  });

  test("検索バーが表示される", async ({ page }) => {
    await page.goto("/admin/documents");
    await expect(page.locator('input[placeholder*="検索"]')).toBeVisible({ timeout: 5000 });
  });

  test("検索機能が動作する", async ({ page }) => {
    await page.goto("/admin/documents");
    await page.fill('input[placeholder*="検索"]', "経営");
    await page.click('button:has-text("検索")');
    await page.waitForTimeout(2000);
    // 検索結果が表示される（ヒットした場合）
    const rows = page.locator("table tbody tr");
    const count = await rows.count();
    // 少なくとも1行 または 「見つかりませんでした」が表示される
    if (count === 1) {
      await expect(rows.first()).toContainText(/経営|見つかりません/);
    } else {
      expect(count).toBeGreaterThan(0);
    }
  });

  test("ステータスフィルターが動作する", async ({ page }) => {
    await page.goto("/admin/documents");
    await page.waitForSelector("table tbody tr", { timeout: 10000 });
    // shadcn Selectコンポーネントを操作
    await page.locator('[role="combobox"]').first().click();
    await page.waitForTimeout(500);
    await page.locator('[role="option"]:has-text("下書き")').click();
    await page.waitForTimeout(1500);
    // フィルター後にURLが更新される
    await expect(page).toHaveURL(/status=DRAFT/, { timeout: 5000 });
  });

  test("新規作成ページに遷移できる", async ({ page }) => {
    await page.goto("/admin/documents");
    await page.click('button:has-text("新規作成")');
    // ドロップダウンメニューから「手動で作成」を選択
    await page.click('text=手動で作成');
    await expect(page).toHaveURL(/\/admin\/documents\/new/, { timeout: 10000 });
    await expect(page.locator("h1")).toContainText("新規文書作成");
  });

  test.describe("新規文書作成", () => {
    test("タイトルと本文を入力して作成できる", async ({ page }) => {
      await page.goto("/admin/documents/new");
      await page.fill('input[id="title"]', `テスト文書_${Date.now()}`);
      await page.fill('textarea[id="content"]', "これはテスト文書の本文です。");
      await page.click('button:has-text("作成")');
      // 文書詳細に遷移することを確認
      await expect(page).toHaveURL(/\/admin\/documents\/[^/]+$/, { timeout: 10000 });
    });

    test("タイトル未入力でエラーが表示される", async ({ page }) => {
      await page.goto("/admin/documents/new");
      await page.fill('textarea[id="content"]', "本文だけ入力");
      await page.click('button:has-text("作成")');
      await expect(page.locator("text=タイトルと本文は必須です")).toBeVisible({ timeout: 5000 });
    });

    test("依存先文書を選択できる", async ({ page }) => {
      await page.goto("/admin/documents/new");
      // 依存先文書一覧が表示されるか確認
      const depSection = page.locator("text=依存先文書");
      await expect(depSection).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe("文書詳細・編集", () => {
    test("文書詳細ページが表示される", async ({ page }) => {
      await page.goto("/admin/documents");
      await page.waitForSelector("table tbody tr", { timeout: 10000 });
      await page.click("table tbody tr:first-child a");
      await page.waitForURL(/\/admin\/documents\/[^/]+$/, { timeout: 10000 });
      // データロード完了を待つ
      await page.waitForTimeout(3000);
      // タブが表示される（タブロールで特定）
      await expect(page.getByRole("tab", { name: "本文" })).toBeVisible({ timeout: 10000 });
      await expect(page.getByRole("tab", { name: "履歴" })).toBeVisible({ timeout: 5000 });
      await expect(page.getByRole("tab", { name: "依存関係" })).toBeVisible({ timeout: 5000 });
    });

    test("Markdownが本文タブに表示される", async ({ page }) => {
      await page.goto("/admin/documents");
      await page.waitForSelector("table tbody tr", { timeout: 10000 });
      await page.click("table tbody tr:first-child a");
      await page.waitForURL(/\/admin\/documents\/[^/]+$/, { timeout: 10000 });
      await page.waitForTimeout(3000);
      await page.getByRole("tab", { name: "本文" }).click();
      // コンテンツエリア（tabpanel内）が表示される
      await expect(page.getByRole("tabpanel", { name: "本文" })).toBeVisible({ timeout: 10000 });
    });

    test("文書を編集できる", async ({ page }) => {
      await page.goto("/admin/documents");
      await page.waitForSelector("table tbody tr", { timeout: 10000 });
      // 編集リンクをクリック（最後の列のリンク）
      const editLinks = page.locator("table tbody tr:first-child a");
      const count = await editLinks.count();
      // 最後のリンクが編集リンク
      await editLinks.nth(count - 1).click();
      await page.waitForURL(/\/admin\/documents\/[^/]+\/edit/, { timeout: 10000 });
      // タイトルが入力済みであることを確認
      await expect(page.locator('input[id="title"]')).not.toHaveValue("", { timeout: 10000 });
    });

    test("依存関係タブが機能する", async ({ page }) => {
      await page.goto("/admin/documents");
      await page.waitForSelector("table tbody tr", { timeout: 10000 });
      await page.click("table tbody tr:first-child a");
      await page.waitForURL(/\/admin\/documents\/[^/]+$/, { timeout: 10000 });
      await page.waitForTimeout(3000);
      await page.getByRole("tab", { name: "依存関係" }).click();
      await expect(page.locator("text=この文書が参照している文書")).toBeVisible({ timeout: 10000 });
      await expect(page.locator("text=この文書を参照している文書")).toBeVisible({ timeout: 5000 });
    });

    test("バージョン履歴タブが機能する", async ({ page }) => {
      await page.goto("/admin/documents");
      await page.waitForSelector("table tbody tr", { timeout: 10000 });
      await page.click("table tbody tr:first-child a");
      await page.waitForURL(/\/admin\/documents\/[^/]+$/, { timeout: 10000 });
      await page.waitForTimeout(3000);
      await page.getByRole("tab", { name: "履歴" }).click();
      await expect(page.locator("text=バージョン履歴")).toBeVisible({ timeout: 10000 });
    });

    test("矛盾チェックボタンが表示される", async ({ page }) => {
      await page.goto("/admin/documents");
      await page.waitForSelector("table tbody tr", { timeout: 10000 });
      await page.click("table tbody tr:first-child a");
      await page.waitForURL(/\/admin\/documents\/[^/]+$/, { timeout: 10000 });
      // ローディング完了を待つ
      await page.waitForTimeout(3000);
      await expect(page.locator('button:has-text("矛盾チェック")')).toBeVisible({ timeout: 10000 });
    });
  });
});
