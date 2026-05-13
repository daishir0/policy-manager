/**
 * auth.senku.work の RFC 7009 revoke エンドポイントを呼び出すヘルパー
 *
 * ログアウト時に accessToken を auth サービス側で無効化することで、
 * トークンが有効期限内でも他クライアントから使えないようにする。
 *
 * 失敗してもログアウト処理自体はブロックしない（fire-and-forget）。
 */

export interface RevokeOptions {
  token: string;
  tokenTypeHint?: "access_token" | "refresh_token";
}

export async function revokeAccessToken(opts: RevokeOptions): Promise<void> {
  const issuer = process.env.AUTH_PROVIDER_ISSUER;
  const clientId = process.env.AUTH_PROVIDER_ID;
  const clientSecret = process.env.AUTH_PROVIDER_SECRET;

  if (!issuer || !clientId || !clientSecret || !opts.token) {
    return;
  }

  const body = new URLSearchParams({
    token: opts.token,
    token_type_hint: opts.tokenTypeHint ?? "access_token",
    client_id: clientId,
    client_secret: clientSecret,
  });

  try {
    await fetch(`${issuer}/oauth/revoke`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      signal: AbortSignal.timeout(5_000),
    });
  } catch (error) {
    console.error("[auth] revokeAccessToken failed:", error);
  }
}
