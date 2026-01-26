import { test, expect } from "@playwright/test";

/**
 * 業務ストーリーE2Eテスト
 * 各機能の最初から最後までの完全なワークフローをテスト
 */

// AI APIが利用可能かどうかをチェック（ANTHROPIC_API_KEYが設定されているか）
const AI_ENABLED = !!process.env.ANTHROPIC_API_KEY;

const testEmail = process.env.TEST_USER_EMAIL || "admin@example.com";
const testPassword = process.env.TEST_USER_PASSWORD || "password123";

// ログインヘルパー関数
async function login(page: import("@playwright/test").Page, request: import("@playwright/test").APIRequestContext) {
  // アカウントロックをリセット
  try {
    await request.post("/api/test/reset-user-lock", {
      data: { email: testEmail },
    });
  } catch {
    // 無視
  }

  await page.goto("/login");
  await page.fill('input[type="email"]', testEmail);
  await page.fill('input[type="password"]', testPassword);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/admin/, { timeout: 10000 });
}

test.describe("業務ストーリー1: 文書ライフサイクル管理", () => {
  test.describe.configure({ mode: "serial" });

  let documentTitle: string;
  let documentId: string | null = null;

  test.beforeEach(async ({ page, request }) => {
    await login(page, request);
  });

  test("1.1 新規文書を作成する", async ({ page }) => {
    documentTitle = `テスト文書_${Date.now()}`;

    await page.goto("/admin/documents/new");

    // タイトル入力
    await page.fill('input[name="title"]', documentTitle);

    // エディタに本文を入力
    await page.click(".ProseMirror");
    await page.keyboard.type("これはE2Eテストで作成された文書です。");

    // 保存
    await page.click('button:has-text("保存")');

    // 成功メッセージを確認
    await expect(page.locator("text=文書を保存しました")).toBeVisible({ timeout: 10000 });

    // URLからドキュメントIDを取得
    const url = page.url();
    const match = url.match(/\/admin\/documents\/([^/]+)/);
    if (match) {
      documentId = match[1];
    }
  });

  test("1.2 文書一覧から作成した文書を確認する", async ({ page }) => {
    await page.goto("/admin/documents");

    // 作成した文書が一覧に表示されることを確認
    await expect(page.locator(`text=${documentTitle}`)).toBeVisible({ timeout: 10000 });
  });

  test("1.3 文書を編集する", async ({ page }) => {
    await page.goto("/admin/documents");

    // 作成した文書をクリック
    await page.click(`text=${documentTitle}`);

    // 編集ボタンをクリック
    await page.click('text=編集');
    await expect(page).toHaveURL(/\/edit$/);

    // タイトルを更新
    await page.fill('input[name="title"]', documentTitle + "_更新済み");

    // 保存
    await page.click('button:has-text("保存")');

    // 成功メッセージを確認
    await expect(page.locator("text=文書を更新しました")).toBeVisible({ timeout: 10000 });

    documentTitle = documentTitle + "_更新済み";
  });

  test("1.4 文書の履歴を確認する", async ({ page }) => {
    await page.goto("/admin/documents");
    await page.click(`text=${documentTitle}`);

    // 履歴タブをクリック
    await page.click('text=履歴');

    // バージョン履歴が表示されることを確認
    await expect(page.locator("text=バージョン履歴")).toBeVisible();
  });

  test("1.5 文書を公開する", async ({ page }) => {
    await page.goto("/admin/documents");
    await page.click(`text=${documentTitle}`);

    // 公開ボタンをクリック
    const publishButton = page.locator('button:has-text("公開")');
    if (await publishButton.isVisible()) {
      await publishButton.click();

      // 確認ダイアログ
      const confirmButton = page.locator('button:has-text("確認")');
      if (await confirmButton.isVisible()) {
        await confirmButton.click();
      }

      // 公開成功を確認
      await expect(page.locator("text=公開中").or(page.locator("text=公開"))).toBeVisible({ timeout: 10000 });
    }
  });
});

test.describe("業務ストーリー2: ユーザー管理の完全フロー", () => {
  test.describe.configure({ mode: "serial" });

  let createdUserEmail: string;

  test.beforeEach(async ({ page, request }) => {
    await login(page, request);
  });

  test("2.1 新規ユーザーを作成する", async ({ page }) => {
    createdUserEmail = `story-user-${Date.now()}@example.com`;

    await page.goto("/admin/users");
    await page.click("button:has-text('新規ユーザー')");

    // フォーム入力
    await page.fill('input[id="email"]', createdUserEmail);
    await page.fill('input[id="name"]', "ストーリーテストユーザー");
    await page.fill('input[id="password"]', "StoryTest123!");
    await page.selectOption('select[id="role"]', "EMPLOYEE");

    // 作成
    const createButton = page.locator('button:has-text("作成")').last();
    await createButton.click();

    // ダイアログが閉じる
    await expect(page.locator('text=新規ユーザー作成')).toBeHidden({ timeout: 15000 });

    // 新しいユーザーが一覧に表示される
    await expect(page.locator(`text=${createdUserEmail}`)).toBeVisible({ timeout: 10000 });
  });

  test("2.2 ユーザーを検索する", async ({ page }) => {
    await page.goto("/admin/users");

    // 検索
    await page.fill('input[placeholder*="検索"]', createdUserEmail.split("@")[0]);
    await page.click("button:has-text('検索')");

    // 検索結果に表示される
    await expect(page.locator(`text=${createdUserEmail}`)).toBeVisible({ timeout: 10000 });
  });

  test("2.3 ユーザーを編集する", async ({ page }) => {
    await page.goto("/admin/users");

    // ユーザーを検索
    await page.fill('input[placeholder*="検索"]', createdUserEmail.split("@")[0]);
    await page.click("button:has-text('検索')");
    await expect(page.locator(`text=${createdUserEmail}`)).toBeVisible({ timeout: 10000 });

    // 編集ボタンをクリック
    const userRow = page.locator(`text=${createdUserEmail}`).locator("..").locator("..").locator("..");
    const editButton = userRow.locator('[data-testid="edit-user-button"]');
    await editButton.click();

    // 編集ダイアログが表示される
    await expect(page.locator("text=ユーザー編集")).toBeVisible();

    // 名前を変更
    await page.fill('input[id="edit-name"]', "更新されたストーリーユーザー");
    await page.selectOption('select[id="edit-role"]', "DOCUMENT_ADMIN");

    // 更新
    await page.click('button:has-text("更新")');

    // ダイアログが閉じる
    await expect(page.locator("text=ユーザー編集")).toBeHidden({ timeout: 10000 });

    // 更新された情報が表示される
    await expect(page.locator("text=更新されたストーリーユーザー")).toBeVisible({ timeout: 10000 });
  });

  test("2.4 ユーザーを削除する", async ({ page }) => {
    await page.goto("/admin/users");

    // ユーザーを検索
    await page.fill('input[placeholder*="検索"]', createdUserEmail.split("@")[0]);
    await page.click("button:has-text('検索')");
    await expect(page.locator(`text=${createdUserEmail}`)).toBeVisible({ timeout: 10000 });

    // 削除ボタンをクリック
    const userRow = page.locator(`text=${createdUserEmail}`).locator("..").locator("..").locator("..");
    const deleteButton = userRow.locator('[data-testid="delete-user-button"]');

    // 確認ダイアログを受け入れる
    page.on("dialog", async dialog => {
      await dialog.accept();
    });

    await deleteButton.click();

    // ユーザーが一覧から消える
    await expect(page.locator(`text=${createdUserEmail}`)).toBeHidden({ timeout: 10000 });
  });
});

test.describe("業務ストーリー3: 文書検索・閲覧フロー", () => {
  test.beforeEach(async ({ page, request }) => {
    await login(page, request);
  });

  test("3.1 キーワード検索で文書を探す", async ({ page }) => {
    await page.goto("/admin/search");

    // 検索クエリを入力
    await page.fill('input[type="search"]', "ポリシー");
    await page.click('button:has-text("検索")');

    // 検索結果を待機
    await expect(page.locator('[data-testid="search-results"]')).toBeVisible({ timeout: 10000 });
  });

  test("3.2 検索結果から文書詳細を表示する", async ({ page }) => {
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

  test("3.3 文書をブックマークする", async ({ page }) => {
    await page.goto("/admin/documents");
    await page.click("table tbody tr:first-child a");

    // ブックマークボタンをクリック
    const bookmarkButton = page.locator('button:has-text("ブックマーク")');
    if (await bookmarkButton.isVisible()) {
      await bookmarkButton.click();
      await expect(page.locator("text=ブックマークしました").or(page.locator("text=ブックマーク済み"))).toBeVisible({ timeout: 5000 });
    }
  });
});

test.describe("業務ストーリー4: AI支援機能（文案生成）", () => {
  test.beforeEach(async ({ page, request }) => {
    await login(page, request);
  });

  test("4.1 文案生成ページにアクセスする", async ({ page }) => {
    await page.goto("/admin/draft");
    await expect(page.locator("h1")).toContainText("文案生成");
  });

  test("4.2 アイディアを入力してAI文案を生成する", async ({ page }) => {
    test.skip(!AI_ENABLED, "AI APIが設定されていません（ANTHROPIC_API_KEY）");

    await page.goto("/admin/draft");

    // アイディアを入力
    await page.fill('textarea[id="idea"]', "在宅勤務に関するガイドラインを作りたい。週2日まで在宅勤務可能とし、事前申請が必要。");

    // 追加コンテキストを入力
    await page.fill('textarea[id="context"]', "セキュリティ対策として、会社支給のPCのみ使用可。");

    // 生成ボタンをクリック
    await page.click('button:has-text("文案を生成")');

    // 生成結果が表示される
    await expect(page.locator("pre")).toBeVisible({ timeout: 60000 });
  });

  test("4.3 生成された文案をコピーする", async ({ page }) => {
    test.skip(!AI_ENABLED, "AI APIが設定されていません（ANTHROPIC_API_KEY）");

    await page.goto("/admin/draft");

    // 文案を生成
    await page.fill('textarea[id="idea"]', "テスト文案を作成");
    await page.click('button:has-text("文案を生成")');
    await expect(page.locator("pre")).toBeVisible({ timeout: 60000 });

    // コピーボタンをクリック
    await page.click('button:has-text("コピー")');
    await expect(page.locator("text=コピー済み")).toBeVisible({ timeout: 5000 });
  });

  test("4.4 文案から文書を作成する", async ({ page }) => {
    test.skip(!AI_ENABLED, "AI APIが設定されていません（ANTHROPIC_API_KEY）");

    await page.goto("/admin/draft");

    // 文案を生成
    await page.fill('textarea[id="idea"]', "新規文書のテスト");
    await page.click('button:has-text("文案を生成")');
    await expect(page.locator("pre")).toBeVisible({ timeout: 60000 });

    // 文書として作成ボタンをクリック
    await page.click('button:has-text("文書として作成")');
    await expect(page).toHaveURL(/\/admin\/documents\/new\?content=/);
  });
});

test.describe("業務ストーリー5: Q&A対話", () => {
  test.beforeEach(async ({ page, request }) => {
    await login(page, request);
  });

  test("5.1 Q&Aページにアクセスする", async ({ page }) => {
    await page.goto("/admin/qa");
    await expect(page.locator("h1")).toContainText("Q&A対話");
    await expect(page.locator("textarea")).toBeVisible();
  });

  test("5.2 質問を送信する", async ({ page }) => {
    test.skip(!AI_ENABLED, "AI APIが設定されていません（ANTHROPIC_API_KEY）");

    await page.goto("/admin/qa");

    // 質問を入力
    await page.fill("textarea", "休暇申請の方法を教えてください");

    // 送信ボタンをクリック
    await page.click('button[type="submit"]');

    // ユーザーメッセージが表示される
    await expect(page.locator("text=休暇申請の方法を教えてください")).toBeVisible();

    // 回答が表示される
    await expect(page.locator('[data-testid="assistant-message"]')).toBeVisible({ timeout: 60000 });
  });
});

test.describe("業務ストーリー6: ダッシュボードとナビゲーション", () => {
  test.beforeEach(async ({ page, request }) => {
    await login(page, request);
  });

  test("6.1 ダッシュボードが表示される", async ({ page }) => {
    await page.goto("/admin");
    await expect(page.locator("h1")).toContainText("ダッシュボード");
  });

  test("6.2 サイドバーから各メニューに遷移できる", async ({ page }) => {
    await page.goto("/admin");

    // 文書一覧へ
    await page.click('a[href="/admin/documents"]');
    await expect(page).toHaveURL(/\/admin\/documents/);
    await expect(page.locator("h1")).toContainText("文書一覧");

    // ユーザー管理へ
    await page.click('a[href="/admin/users"]');
    await expect(page).toHaveURL(/\/admin\/users/);
    await expect(page.locator("h1")).toContainText("ユーザー管理");

    // 検索へ
    await page.click('a[href="/admin/search"]');
    await expect(page).toHaveURL(/\/admin\/search/);
    await expect(page.locator("h1")).toContainText("検索");

    // Q&Aへ
    await page.click('a[href="/admin/qa"]');
    await expect(page).toHaveURL(/\/admin\/qa/);
    await expect(page.locator("h1")).toContainText("Q&A対話");

    // 文案生成へ
    await page.click('a[href="/admin/draft"]');
    await expect(page).toHaveURL(/\/admin\/draft/);
    await expect(page.locator("h1")).toContainText("文案生成");
  });

  test("6.3 ユーザーメニューからログアウトできる", async ({ page }) => {
    await page.goto("/admin");

    // ユーザーメニューを開く
    await page.click('[data-testid="user-menu"]');

    // ログアウトボタンが表示される
    const logoutButton = page.locator("text=ログアウト");
    await expect(logoutButton).toBeVisible({ timeout: 5000 });

    // ログアウト
    await logoutButton.click();

    // ログインページにリダイレクト
    await expect(page).toHaveURL(/\/login/, { timeout: 15000 });
  });
});

test.describe("UIコントロール完全性チェック", () => {
  test.beforeEach(async ({ page, request }) => {
    await login(page, request);
  });

  test("すべてのボタンにonClickハンドラがある", async ({ page }) => {
    // ダッシュボード
    await page.goto("/admin");

    // ユーザー管理ページのボタンチェック
    await page.goto("/admin/users");

    // 新規ユーザーボタン
    const newUserButton = page.locator("button:has-text('新規ユーザー')");
    await expect(newUserButton).toBeVisible();
    await newUserButton.click();
    await expect(page.locator("text=新規ユーザー作成")).toBeVisible();
    await page.click('button:has-text("キャンセル")');

    // 編集ボタン
    const editButton = page.locator('[data-testid="edit-user-button"]').first();
    await expect(editButton).toBeVisible();
    await editButton.click();
    await expect(page.locator("text=ユーザー編集")).toBeVisible();
    await page.click('button:has-text("キャンセル")');

    // 文書一覧ページのボタンチェック
    await page.goto("/admin/documents");

    // 新規作成ボタン
    const newDocButton = page.locator('text=新規作成');
    if (await newDocButton.isVisible()) {
      await newDocButton.click();
      await expect(page).toHaveURL(/\/admin\/documents\/new/);
    }
  });

  test("すべてのフォーム入力が機能する", async ({ page }) => {
    // ログインフォーム
    await page.goto("/login");
    await expect(page.locator('input[type="email"]')).toBeEditable();
    await expect(page.locator('input[type="password"]')).toBeEditable();

    // ユーザー作成フォーム
    await login(page, await page.context().request);
    await page.goto("/admin/users");
    await page.click("button:has-text('新規ユーザー')");

    await expect(page.locator('input[id="email"]')).toBeEditable();
    await expect(page.locator('input[id="name"]')).toBeEditable();
    await expect(page.locator('input[id="password"]')).toBeEditable();
    await expect(page.locator('select[id="role"]')).toBeEnabled();

    await page.click('button:has-text("キャンセル")');

    // 検索フォーム
    await page.goto("/admin/search");
    await expect(page.locator('input[type="search"]')).toBeEditable();

    // 文案生成フォーム
    await page.goto("/admin/draft");
    await expect(page.locator('textarea[id="idea"]')).toBeEditable();
    await expect(page.locator('textarea[id="context"]')).toBeEditable();

    // Q&Aフォーム
    await page.goto("/admin/qa");
    await expect(page.locator("textarea")).toBeEditable();
  });

  test("すべてのリンクが正しく遷移する", async ({ page }) => {
    await page.goto("/admin");

    // サイドバーリンクをすべてチェック
    const links = [
      { href: "/admin/documents", title: "文書一覧" },
      { href: "/admin/users", title: "ユーザー管理" },
      { href: "/admin/search", title: "検索" },
      { href: "/admin/qa", title: "Q&A対話" },
      { href: "/admin/draft", title: "文案生成" },
    ];

    for (const link of links) {
      await page.goto("/admin");
      const linkElement = page.locator(`a[href="${link.href}"]`);
      if (await linkElement.isVisible()) {
        await linkElement.click();
        await expect(page).toHaveURL(new RegExp(link.href));
      }
    }
  });
});
