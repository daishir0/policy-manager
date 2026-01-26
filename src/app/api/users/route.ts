import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { userService } from "@/lib/services/user.service";
import { auditService } from "@/lib/services/audit.service";
import { hasPermission, PERMISSIONS, type Role } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";

// DBのロール名 → フロントエンド表示用
function mapRoleToString(roleName: string): string {
  const roleMap: Record<string, string> = {
    "system_admin": "ADMIN",
    "document_admin": "DOCUMENT_ADMIN",
    "employee": "EMPLOYEE",
  };
  return roleMap[roleName] || roleName.toUpperCase();
}

// フロントエンドのロール名 → DBロール名
function mapStringToRoleName(roleString: string): string {
  const roleMap: Record<string, string> = {
    "ADMIN": "system_admin",
    "DOCUMENT_ADMIN": "document_admin",
    "EMPLOYEE": "employee",
  };
  return roleMap[roleString] || roleString.toLowerCase();
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  if (!hasPermission(session.user.role as Role, PERMISSIONS.USER_READ)) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const searchParams = request.nextUrl.searchParams;
  const filter = {
    search: searchParams.get("search") || undefined,
    roleId: searchParams.get("roleId") || undefined,
    page: parseInt(searchParams.get("page") || "1"),
    limit: parseInt(searchParams.get("limit") || "20"),
  };

  try {
    const result = await userService.listUsers(filter);

    // フロントエンド期待形式に変換
    const response = {
      users: result.users.map(user => ({
        id: user.id,
        email: user.email,
        name: user.name,
        role: mapRoleToString(user.role.name),
        isLocked: user.lockedUntil ? new Date(user.lockedUntil) > new Date() : false,
        createdAt: user.createdAt,
      })),
      total: result.pagination.total,
      page: result.pagination.page,
      totalPages: result.pagination.totalPages,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Failed to list users:", error);
    return NextResponse.json({ error: "ユーザー一覧の取得に失敗しました" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  if (!hasPermission(session.user.role as Role, PERMISSIONS.USER_CREATE)) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { role, ...userData } = body;

    // ロール名からRoleレコードを検索
    const dbRoleName = mapStringToRoleName(role);
    const roleRecord = await prisma.role.findUnique({
      where: { name: dbRoleName }
    });

    if (!roleRecord) {
      return NextResponse.json({ error: "無効なロールです" }, { status: 400 });
    }

    // roleIdを設定してユーザー作成
    const user = await userService.createUser({
      ...userData,
      roleId: roleRecord.id,
    });

    await auditService.log({
      userId: session.user.id,
      action: "user_create",
      entityType: "user",
      entityId: user.id,
      details: { email: user.email, name: user.name },
      ipAddress: request.headers.get("x-forwarded-for") || undefined,
    });

    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    console.error("Failed to create user:", error);
    const message = error instanceof Error ? error.message : "ユーザーの作成に失敗しました";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
