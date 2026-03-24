import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { servicePermissionService } from "@/lib/services/service-permission.service";
import { isAdmin } from "@/lib/auth/permissions";

/**
 * ユーザーのサービス固有権限を取得
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const { id: userId } = await params;

  // 管理者のみ他人の権限を閲覧可能、自分の権限は閲覧可能
  if (session.user.id !== userId && !isAdmin(session.user.roles || [])) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  try {
    const permissions = await servicePermissionService.getUserPermissions(userId);
    return NextResponse.json({ permissions });
  } catch (error) {
    console.error("Failed to get user service permissions:", error);
    return NextResponse.json(
      { error: "サービス権限の取得に失敗しました" },
      { status: 500 }
    );
  }
}

/**
 * ユーザーにサービス権限を付与
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  // 管理者のみ権限付与可能
  if (!isAdmin(session.user.roles || [])) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const { id: userId } = await params;

  try {
    const body = await request.json();
    const { permissionName, permissionNames } = body;

    // 複数権限の一括付与
    if (permissionNames && Array.isArray(permissionNames)) {
      const results = await servicePermissionService.grantMultiplePermissions(
        userId,
        permissionNames,
        session.user.id
      );
      return NextResponse.json({
        success: true,
        results,
      });
    }

    // 単一権限の付与
    if (!permissionName) {
      return NextResponse.json(
        { error: "permissionName または permissionNames が必要です" },
        { status: 400 }
      );
    }

    const result = await servicePermissionService.grantPermission(
      userId,
      permissionName,
      session.user.id
    );

    return NextResponse.json({
      success: true,
      permission: {
        id: result.permission.id,
        name: result.permission.name,
        displayName: result.permission.displayName,
        grantedAt: result.grantedAt,
      },
    });
  } catch (error) {
    console.error("Failed to grant service permission:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "権限の付与に失敗しました" },
      { status: 500 }
    );
  }
}

/**
 * ユーザーからサービス権限を削除
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  // 管理者のみ権限削除可能
  if (!isAdmin(session.user.roles || [])) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const { id: userId } = await params;
  const { searchParams } = new URL(request.url);
  const permissionName = searchParams.get("permissionName");

  if (!permissionName) {
    return NextResponse.json(
      { error: "permissionName クエリパラメータが必要です" },
      { status: 400 }
    );
  }

  try {
    await servicePermissionService.revokePermission(userId, permissionName);
    return NextResponse.json({
      success: true,
      message: `権限 ${permissionName} を削除しました`,
    });
  } catch (error) {
    console.error("Failed to revoke service permission:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "権限の削除に失敗しました" },
      { status: 500 }
    );
  }
}
