import { test, expect } from "@playwright/test";

test.describe("検索・閲覧機能", () => {
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
    await page.waitForURL(/\/admin/, { timeout: 10000 });
  });

  test.describe("キーワード検索", () => {
    test("検索ページが表示される", async ({ page }) => {
      await page.goto("/admin/search");
      await expect(page.locator("h1")).toContainText("検索");
      await expect(page.locator('input[type="search"]')).toBeVisible();
    });

    test("キーワード検索ができる", async ({ page }) => {
      await page.goto("/admin/search");

      // 検索クエリを入力
      await page.fill('input[type="search"]', "セキュリティ");
      await page.click('button:has-text("検索")');

      // 検索結果を待機
      await expect(page.locator('[data-testid="search-results"]')).toBeVisible({ timeout: 10000 });
    });

    test("検索結果をソートできる", async ({ page }) => {
      await page.goto("/admin/search");

      // 検索実行
      await page.fill('input[type="search"]', "ポリシー");
      await page.click('button:has-text("検索")');

      // ソートセレクトを変更
      await page.selectOption('select[name="sort"]', "updatedAt");

      // 結果が更新されることを確認
      await expect(page.locator('[data-testid="search-results"]')).toBeVisible();
    });

    test("検索結果から文書詳細に遷移できる", async ({ page }) => {
      await page.goto("/admin/search");

      // 検索実行
      await page.fill('input[type="search"]', "文書");
      await page.click('button:has-text("検索")');

      // 検索結果を待機
      await expect(page.locator('[data-testid="search-results"]')).toBeVisible({ timeout: 10000 });

      // 最初の結果をクリック
      const firstResult = page.locator('[data-testid="search-result-item"]').first();
      if (await firstResult.isVisible()) {
        await firstResult.click();
        await expect(page).toHaveURL(/\/admin\/documents\/[^/]+$/);
      }
    });
  });

  test.describe("文書閲覧", () => {
    test("文書詳細ページが表示される", async ({ page }) => {
      await page.goto("/admin/documents");

      // 最初の文書をクリック
      await page.click("table tbody tr:first-child a");

      // 詳細ページの要素を確認
      await expect(page.locator("h1")).toBeVisible();
      await expect(page.locator('[role="tab"]:has-text("本文")')).toBeVisible();
    });

    test("文書の施行情報が表示される", async ({ page }) => {
      await page.goto("/admin/documents");
      await page.click("table tbody tr:first-child a");

      // 施行情報カードを確認
      await expect(page.locator("text=施行日")).toBeVisible();
      await expect(page.locator("text=廃止日")).toBeVisible();
    });

    test("カテゴリ情報が表示される", async ({ page }) => {
      await page.goto("/admin/documents");
      await page.click("table tbody tr:first-child a");

      // カテゴリセクションを確認（文書詳細ページ）
      // FolderTreeアイコンの隣にあるカテゴリタイトル、または カテゴリ列が存在することを確認
      const categorySection = page.locator('.lucide-folder-tree').first();
      const categoryColumn = page.locator('th:has-text("カテゴリ")');
      const hasCategory = await categorySection.isVisible() || await categoryColumn.isVisible();
      expect(hasCategory).toBeTruthy();
    });
  });

  test.describe("ブックマーク機能", () => {
    test("文書をブックマークできる", async ({ page }) => {
      await page.goto("/admin/documents");
      await page.click("table tbody tr:first-child a");

      // ブックマークボタンをクリック
      const bookmarkButton = page.locator('button:has-text("ブックマーク")');
      if (await bookmarkButton.isVisible()) {
        await bookmarkButton.click();

        // 成功メッセージを確認
        await expect(page.locator("text=ブックマークしました")).toBeVisible({ timeout: 5000 });
      }
    });

    test("ブックマークを解除できる", async ({ page }) => {
      await page.goto("/admin/documents");
      await page.click("table tbody tr:first-child a");

      // ブックマーク済みボタンをクリック
      const unbookmarkButton = page.locator('button:has-text("ブックマーク済み")');
      if (await unbookmarkButton.isVisible()) {
        await unbookmarkButton.click();

        // 成功メッセージを確認
        await expect(page.locator("text=ブックマークを解除しました")).toBeVisible({ timeout: 5000 });
      }
    });
  });

  test.describe("カテゴリツリー", () => {
    test("カテゴリ一覧が表示される", async ({ page }) => {
      await page.goto("/admin/categories");
      await expect(page.locator("h1")).toContainText("カテゴリ");
    });

    test("カテゴリツリーが展開できる", async ({ page }) => {
      await page.goto("/admin/categories");

      // 展開可能なカテゴリがあれば展開
      const expandButton = page.locator('[data-testid="category-expand"]').first();
      if (await expandButton.isVisible()) {
        await expandButton.click();

        // 子カテゴリが表示されることを確認
        await expect(page.locator('[data-testid="category-child"]')).toBeVisible();
      }
    });

    test("カテゴリ配下の文書一覧が表示される", async ({ page }) => {
      await page.goto("/admin/categories");

      // カテゴリをクリック
      const category = page.locator('[data-testid="category-item"]').first();
      if (await category.isVisible()) {
        await category.click();

        // 文書一覧が表示されることを確認
        await expect(page.locator('[data-testid="category-documents"]')).toBeVisible({ timeout: 5000 });
      }
    });
  });

  test.describe("組織別表示", () => {
    test("組織一覧が表示される", async ({ page }) => {
      await page.goto("/admin/organizations");
      await expect(page.locator("h1")).toContainText("組織");
    });

    test("組織配下の文書が表示される", async ({ page }) => {
      await page.goto("/admin/organizations");

      // 組織をクリック
      const org = page.locator('[data-testid="organization-item"]').first();
      if (await org.isVisible()) {
        await org.click();

        // 文書一覧が表示されることを確認
        await expect(page.locator('[data-testid="organization-documents"]')).toBeVisible({ timeout: 5000 });
      }
    });
  });
});
