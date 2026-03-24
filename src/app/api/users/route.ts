import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { userService } from "@/lib/services/user.service";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  if (!hasPermission(session.user.roles, session.user.permissions, PERMISSIONS.USER_READ)) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const searchParams = request.nextUrl.searchParams;
  const rolesParam = searchParams.get("roles");
  const filter = {
    search: searchParams.get("search") || undefined,
    roles: rolesParam ? rolesParam.split(",") : undefined,
    page: parseInt(searchParams.get("page") || "1"),
    limit: parseInt(searchParams.get("limit") || "20"),
  };

  try {
    const result = await userService.listUsers(filter);
    return NextResponse.json({
      users: result.users,
      total: result.pagination.total,
      page: result.pagination.page,
      totalPages: result.pagination.totalPages,
    });
  } catch (error) {
    console.error("Failed to list users:", error);
    return NextResponse.json({ error: "ユーザー一覧の取得に失敗しました" }, { status: 500 });
  }
}

/**
 * ユーザー作成はauthサービスで行う
 * このエンドポイントは案内メッセージを返す
 */
export async function POST() {
  return NextResponse.json(
    {
      error: "ユーザーの作成は認証サービス (auth.senku.work) で行ってください",
      message: "User creation is handled by the auth service",
      authServiceUrl: process.env.AUTH_SENKU_ISSUER || "https://auth.senku.work",
    },
    { status: 400 }
  );
}
