import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { userService } from "@/lib/services/user.service";
import { auditService } from "@/lib/services/audit.service";
import { hasPermission, PERMISSIONS, type Role } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";

// フロントエンドのロール名 → DBロール名
function mapStringToRoleName(roleString: string): string {
  const roleMap: Record<string, string> = {
    "ADMIN": "system_admin",
    "DOCUMENT_ADMIN": "document_admin",
    "EMPLOYEE": "employee",
  };
  return roleMap[roleString] || roleString.toLowerCase();
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  if (!hasPermission(session.user.role as Role, PERMISSIONS.USER_READ)) {
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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  if (!hasPermission(session.user.role as Role, PERMISSIONS.USER_UPDATE)) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const { role, ...userData } = body;

    // ロール名が渡された場合はroleIdに変換
    let updateData = { ...userData };
    if (role) {
      const dbRoleName = mapStringToRoleName(role);
      const roleRecord = await prisma.role.findUnique({
        where: { name: dbRoleName }
      });

      if (!roleRecord) {
        return NextResponse.json({ error: "無効なロールです" }, { status: 400 });
      }
      updateData.roleId = roleRecord.id;
    }

    const user = await userService.updateUser(id, updateData);

    await auditService.log({
      userId: session.user.id,
      action: "user_update",
      entityType: "user",
      entityId: id,
      details: { updatedFields: Object.keys(body) },
      ipAddress: request.headers.get("x-forwarded-for") || undefined,
    });

    return NextResponse.json(user);
  } catch (error) {
    console.error("Failed to update user:", error);
    const message = error instanceof Error ? error.message : "ユーザーの更新に失敗しました";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  if (!hasPermission(session.user.role as Role, PERMISSIONS.USER_DELETE)) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  try {
    const { id } = await params;

    // 自分自身は削除不可
    if (id === session.user.id) {
      return NextResponse.json({ error: "自分自身は削除できません" }, { status: 400 });
    }

    await userService.deleteUser(id);

    await auditService.log({
      userId: session.user.id,
      action: "user_delete",
      entityType: "user",
      entityId: id,
      ipAddress: request.headers.get("x-forwarded-for") || undefined,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete user:", error);
    const message = error instanceof Error ? error.message : "ユーザーの削除に失敗しました";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
