import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { analyticsService } from "@/lib/services/analytics.service";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  if (!hasPermission(session.user.roles, session.user.permissions, PERMISSIONS.ANALYTICS_VIEW)) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const searchParams = request.nextUrl.searchParams;
  const startDate = searchParams.get("startDate")
    ? new Date(searchParams.get("startDate")!)
    : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // デフォルト30日前
  const endDate = searchParams.get("endDate")
    ? new Date(searchParams.get("endDate")!)
    : new Date();

  try {
    const stats = await analyticsService.getStats(startDate, endDate);
    return NextResponse.json(stats);
  } catch (error) {
    console.error("Failed to get analytics:", error);
    return NextResponse.json({ error: "統計情報の取得に失敗しました" }, { status: 500 });
  }
}
