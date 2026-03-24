import { NextResponse } from "next/server";

/**
 * アカウントロックのリセットはauthサービスで行われます
 * @deprecated このエンドポイントは非推奨です
 */
export async function POST() {
  return NextResponse.json(
    {
      error: "この機能は認証サービス (auth.senku.work) で管理されています",
      message: "Account lock management is handled by the auth service",
      authServiceUrl: process.env.AUTH_SENKU_ISSUER || "https://auth.senku.work",
    },
    { status: 400 }
  );
}
