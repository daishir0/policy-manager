import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { userService } from "@/lib/services/user.service";
import { auditService } from "@/lib/services/audit.service";
import { hasPermission, PERMISSIONS, type Role } from "@/lib/auth/permissions";

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
    role: searchParams.get("role") || undefined,
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
    const user = await userService.createUser(body);

    await auditService.log({
      userId: session.user.id,
      action: "user_create",
      entityType: "user",
      entityId: user.id,
      details: { email: user.email, name: user.name, role: user.role },
      ipAddress: request.headers.get("x-forwarded-for") || undefined,
    });

    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    console.error("Failed to create user:", error);
    const message = error instanceof Error ? error.message : "ユーザーの作成に失敗しました";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
