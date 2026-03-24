import { NextResponse } from "next/server";

/**
 * アカウントのロック状態確認はauthサービスで行われます
 * @deprecated このエンドポイントは非推奨です
 */
export async function POST() {
  return NextResponse.json(
    {
      locked: false,
      message: "アカウントロック機能は認証サービス (auth.senku.work) で管理されています",
      authServiceUrl: process.env.AUTH_SENKU_ISSUER || "https://auth.senku.work",
    }
  );
}
