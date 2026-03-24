import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { userService } from "@/lib/services/user.service";
import { auditService } from "@/lib/services/audit.service";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  if (!hasPermission(session.user.roles, session.user.permissions, PERMISSIONS.USER_READ)) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  try {
    const { id } = await params;
    const user = await userService.getUser(id);
    return NextResponse.json(user);
  } catch (error) {
    console.error("Failed to get user:", error);
    const message = error instanceof Error ? error.message : "ユーザーの取得に失敗しました";
    return NextResponse.json({ error: message }, { status: 404 });
  }
}

/**
 * ユーザーのローカル情報のみ更新可能（name, image）
 * ロール等の変更はauthサービスで行う
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  // 自分自身の情報は更新可能、他ユーザーはUSER_UPDATE権限が必要
  const { id } = await params;
  const isSelfUpdate = session.user.id === id;

  if (!isSelfUpdate && !hasPermission(session.user.roles, session.user.permissions, PERMISSIONS.USER_UPDATE)) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const user = await userService.updateUser(id, body);

    await auditService.log({
      userId: session.user.id,
      action: "user_update",
      entityType: "user",
      entityId: id,
      details: { updatedFields: Object.keys(body), isSelfUpdate },
      ipAddress: request.headers.get("x-forwarded-for") || undefined,
    });

    return NextResponse.json(user);
  } catch (error) {
    console.error("Failed to update user:", error);
    const message = error instanceof Error ? error.message : "ユーザーの更新に失敗しました";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

/**
 * ユーザー削除はauthサービスで行う
 * このエンドポイントは案内メッセージを返す
 */
export async function DELETE() {
  const authServiceUrl = process.env.AUTH_PROVIDER_ISSUER;
  return NextResponse.json(
    {
      error: "ユーザーの削除は認証サービスで行ってください",
      message: "User deletion is handled by the auth service",
      ...(authServiceUrl && { authServiceUrl }),
    },
    { status: 400 }
  );
}
