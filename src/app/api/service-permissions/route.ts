import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { servicePermissionService } from "@/lib/services/service-permission.service";
import { isAdmin } from "@/lib/auth/permissions";

/**
 * サービス固有権限の一覧を取得
 */
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  // 管理者のみ閲覧可能
  if (!isAdmin(session.user.roles || [])) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  try {
    const permissions = await servicePermissionService.listPermissions();

    // カテゴリ別にグループ化
    const grouped = permissions.reduce((acc, perm) => {
      if (!acc[perm.category]) {
        acc[perm.category] = [];
      }
      acc[perm.category].push(perm);
      return acc;
    }, {} as Record<string, typeof permissions>);

    return NextResponse.json({
      permissions,
      grouped,
    });
  } catch (error) {
    console.error("Failed to list service permissions:", error);
    return NextResponse.json(
      { error: "サービス権限の取得に失敗しました" },
      { status: 500 }
    );
  }
}

/**
 * サービス権限のシード（管理者のみ）
 */
export async function POST() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  // 管理者のみ実行可能
  if (!isAdmin(session.user.roles || [])) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  try {
    const results = await servicePermissionService.seedPermissions();
    return NextResponse.json({
      success: true,
      message: `${results.length}件のサービス権限をシードしました`,
      permissions: results,
    });
  } catch (error) {
    console.error("Failed to seed service permissions:", error);
    return NextResponse.json(
      { error: "サービス権限のシードに失敗しました" },
      { status: 500 }
    );
  }
}
