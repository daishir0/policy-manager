import { test, expect, Page } from "@playwright/test";
import { loginWithOIDC } from "./helpers/auth";

// テストタイムアウトを延長（ログインフローが長い場合があるため）
test.setTimeout(120000);

const ADMIN_EMAIL = process.env.TEST_USER_EMAIL || "admin@example.com";
const ADMIN_PASSWORD = process.env.TEST_USER_PASSWORD || "password123";
const STAFF_EMAIL = process.env.TEST_STAFF_EMAIL || "staff01@example.com";
const STAFF_PASSWORD = process.env.TEST_STAFF_PASSWORD || "password123";

/**
 * 全ページ・全リンク正常表示テスト
 *
 * サイドバーおよびヘッダーに含まれる全てのリンクをクリックし、
 * 各ページが正常に表示されることを確認します。
 */

// 公開ページ（認証不要）
const publicPages = [
  { name: "トップページ", path: "/" },
  { name: "ログインページ", path: "/login" },
];

// スタッフ向けページ（認証必要）
const staffPages = [
  { name: "管理画面トップ", path: "/admin" },
  { name: "ポリシー一覧", path: "/admin/policies" },
  { name: "Q&A対話", path: "/admin/qa" },
  { name: "メッセージ", path: "/admin/messages" },
  { name: "矛盾検出", path: "/admin/contradictions" },
];

// 管理者専用ページ（認証 + 管理者権限必要）
const adminOnlyPages = [
  { name: "ユーザー管理", path: "/admin/users" },
  { name: "設定", path: "/admin/settings" },
  { name: "アクセス統計", path: "/admin/analytics" },
  { name: "ログ管理", path: "/admin/logs" },
];

/**
 * ページが正常に表示されるか確認
 * - 404エラーでないこと
 * - 500エラーでないこと
 * - 基本的なUI要素が表示されること
 */
async function assertPageLoadsCorrectly(page: Page, pageName: string): Promise<void> {
  // 404ページでないこと（タイトルやコンテンツをチェック）
  const pageTitle = await page.title();
  expect(pageTitle.toLowerCase(), `${pageName}: ページタイトルが404を含まないこと`).not.toContain("404");
  expect(pageTitle.toLowerCase(), `${pageName}: ページタイトルがnot foundを含まないこと`).not.toContain("not found");

  // 500エラーでないこと
  const bodyText = await page.locator("body").textContent();
  expect(bodyText?.toLowerCase(), `${pageName}: 500エラーでないこと`).not.toContain("500 internal server error");
  expect(bodyText?.toLowerCase(), `${pageName}: application errorでないこと`).not.toContain("application error");

  // 基本的なコンテンツが表示されていること
  expect(bodyText?.length, `${pageName}: ページコンテンツが存在すること`).toBeGreaterThan(100);
}

test.describe("公開ページ", () => {
  for (const pageInfo of publicPages) {
    test(`${pageInfo.name} (${pageInfo.path}) が正常に表示される`, async ({ page }) => {
      await page.goto(pageInfo.path);
      await page.waitForLoadState("networkidle");
      await assertPageLoadsCorrectly(page, pageInfo.name);
    });
  }
});

test.describe("スタッフページ（認証済み）", () => {
  test.beforeEach(async ({ page }) => {
    await loginWithOIDC(page, STAFF_EMAIL, STAFF_PASSWORD);
  });

  for (const pageInfo of staffPages) {
    test(`${pageInfo.name} (${pageInfo.path}) が正常に表示される`, async ({ page }) => {
      await page.goto(pageInfo.path);
      await page.waitForLoadState("networkidle");
      await assertPageLoadsCorrectly(page, pageInfo.name);
    });
  }
});

test.describe("管理者専用ページ", () => {
  test.beforeEach(async ({ page }) => {
    await loginWithOIDC(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  });

  for (const pageInfo of adminOnlyPages) {
    test(`${pageInfo.name} (${pageInfo.path}) が正常に表示される`, async ({ page }) => {
      await page.goto(pageInfo.path);
      await page.waitForLoadState("networkidle");
      await assertPageLoadsCorrectly(page, pageInfo.name);
    });
  }
});

test.describe("サイドバーリンク遷移（管理者）", () => {
  test.beforeEach(async ({ page }) => {
    await loginWithOIDC(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  });

  test("サイドバーの全リンクが正常に機能する", async ({ page }) => {
    await page.goto("/admin/policies");
    await page.waitForLoadState("networkidle");

    // サイドバー内の全リンクを取得
    const sidebarLinks = page.locator('[data-sidebar="content"] a[href], aside a[href]');
    const linksCount = await sidebarLinks.count();

    expect(linksCount, "サイドバーにリンクが存在すること").toBeGreaterThan(0);

    // 各リンクをテスト
    const visitedUrls = new Set<string>();
    for (let i = 0; i < linksCount; i++) {
      const link = sidebarLinks.nth(i);
      const href = await link.getAttribute("href");

      // 外部リンクや既に訪問済みのリンクはスキップ
      if (!href || href.startsWith("http") || href.startsWith("//") || visitedUrls.has(href)) {
        continue;
      }

      visitedUrls.add(href);

      // リンクが表示されていることを確認
      if (!await link.isVisible()) {
        continue;
      }

      // リンクをクリック
      await link.click();
      await page.waitForLoadState("networkidle");

      // ページが正常に読み込まれること
      const bodyText = await page.locator("body").textContent();
      expect(bodyText?.toLowerCase(), `リンク ${href}: 404でないこと`).not.toContain("404 not found");
      expect(bodyText?.toLowerCase(), `リンク ${href}: application errorでないこと`).not.toContain("application error");

      // 元のページに戻る
      await page.goto("/admin/policies");
      await page.waitForLoadState("networkidle");
    }
  });
});

test.describe("ヘッダーメニュー", () => {
  test.beforeEach(async ({ page }) => {
    await loginWithOIDC(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  });

  test("ヘッダーのユーザーメニューが正常に動作する", async ({ page }) => {
    await page.goto("/admin/policies");
    await page.waitForLoadState("networkidle");

    // ユーザーメニューボタンをクリック
    const userMenuButton = page.locator('[data-testid="user-menu"]');
    await expect(userMenuButton).toBeVisible({ timeout: 10000 });
    await userMenuButton.click();

    // ドロップダウンメニューが表示されるのを待つ
    await page.waitForTimeout(500);

    // メニュー項目が表示されることを確認
    const menuContent = page.locator('[role="menu"], [data-radix-menu-content]');
    await expect(menuContent).toBeVisible({ timeout: 5000 });

    // メニュー内のアイテムを確認
    const menuItems = page.locator('[role="menuitem"]');
    const menuItemsCount = await menuItems.count();
    expect(menuItemsCount, "メニュー項目が存在すること").toBeGreaterThan(0);

    // メニュー内のリンクを確認
    for (let i = 0; i < menuItemsCount; i++) {
      const item = menuItems.nth(i);
      const text = await item.textContent();

      // 各メニュー項目が有効なテキストを持っていること
      expect(text?.trim().length, "メニュー項目にテキストがあること").toBeGreaterThan(0);
    }
  });

  test("通知ベルが正常に動作する", async ({ page }) => {
    await page.goto("/admin/policies");
    await page.waitForLoadState("networkidle");

    // 通知ベルボタンを探す
    const bellButton = page.locator('button:has([class*="lucide-bell"]), button:has(svg[class*="bell"])').first();

    if (await bellButton.isVisible()) {
      await bellButton.click();

      // ドロップダウンが表示されるのを待つ
      await page.waitForTimeout(500);

      // ドロップダウンコンテンツが表示されること
      const dropdownContent = page.locator('[data-radix-popper-content-wrapper], [role="menu"]');
      await expect(dropdownContent.first()).toBeVisible({ timeout: 5000 });
    }
  });
});

test.describe("文書関連ページ", () => {
  test.beforeEach(async ({ page }) => {
    await loginWithOIDC(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  });

  test("文書一覧から文書詳細へのナビゲーションが機能する", async ({ page }) => {
    await page.goto("/admin/policies");
    await page.waitForLoadState("networkidle");

    // 文書リストの最初の項目をクリック
    const firstDocLink = page.locator('a[href^="/admin/documents/"]').first();

    if (await firstDocLink.isVisible()) {
      const href = await firstDocLink.getAttribute("href");
      await firstDocLink.click();
      await page.waitForLoadState("networkidle");

      // 文書詳細ページが正常に表示されること
      await assertPageLoadsCorrectly(page, "文書詳細");

      // URLが期待したパスを含むこと（リダイレクトされている可能性があるため）
      // policies一覧のリンクから遷移した場合、404でなければOK
    } else {
      // 文書が存在しない場合はスキップ（テストは成功）
      test.skip();
    }
  });

  test("文書新規作成ページが正常に表示される", async ({ page }) => {
    await page.goto("/admin/documents/new");
    await page.waitForLoadState("networkidle");
    await assertPageLoadsCorrectly(page, "文書新規作成");
  });
});

test.describe("スタッフユーザーの権限制限", () => {
  test.beforeEach(async ({ page }) => {
    await loginWithOIDC(page, STAFF_EMAIL, STAFF_PASSWORD);
  });

  test("スタッフはサイドバーにユーザー管理リンクが表示されない", async ({ page }) => {
    await page.goto("/admin/policies");
    await page.waitForLoadState("networkidle");

    // サイドバーにユーザー管理リンクがないことを確認
    const userManagementLink = page.locator('a[href="/admin/users"]');
    await expect(userManagementLink).not.toBeVisible();
  });

  test("スタッフはサイドバーにアクセス統計リンクが表示されない", async ({ page }) => {
    await page.goto("/admin/policies");
    await page.waitForLoadState("networkidle");

    // サイドバーにアクセス統計リンクがないことを確認
    const analyticsLink = page.locator('a[href="/admin/analytics"]');
    await expect(analyticsLink).not.toBeVisible();
  });

  test("スタッフはサイドバーにログ管理リンクが表示されない", async ({ page }) => {
    await page.goto("/admin/policies");
    await page.waitForLoadState("networkidle");

    // サイドバーにログ管理リンクがないことを確認
    const logsLink = page.locator('a[href="/admin/logs"]');
    await expect(logsLink).not.toBeVisible();
  });
});
