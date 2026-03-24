import { NextResponse } from "next/server";

/**
 * アカウントのロック状態確認はauthサービスで行われます
 * @deprecated このエンドポイントは非推奨です
 */
export async function POST() {
  const authServiceUrl = process.env.AUTH_PROVIDER_ISSUER;
  return NextResponse.json(
    {
      locked: false,
      message: "アカウントロック機能は認証サービスで管理されています",
      ...(authServiceUrl && { authServiceUrl }),
    }
  );
}
