import { NextResponse } from "next/server";

/**
 * アカウントロックのリセットはauthサービスで行われます
 * @deprecated このエンドポイントは非推奨です
 */
export async function POST() {
  const authServiceUrl = process.env.AUTH_PROVIDER_ISSUER;
  return NextResponse.json(
    {
      error: "この機能は認証サービスで管理されています",
      message: "Account lock management is handled by the auth service",
      ...(authServiceUrl && { authServiceUrl }),
    },
    { status: 400 }
  );
}
