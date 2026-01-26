import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { auditService } from "@/lib/services/audit.service";
import { hasPermission, PERMISSIONS, type Role } from "@/lib/auth/permissions";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  if (!hasPermission(session.user.role as Role, PERMISSIONS.AUDIT_VIEW)) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const searchParams = request.nextUrl.searchParams;
  const filter = {
    userId: searchParams.get("userId") || undefined,
    action: searchParams.get("action") as never || undefined,
    entityType: searchParams.get("entityType") || undefined,
    startDate: searchParams.get("startDate") ? new Date(searchParams.get("startDate")!) : undefined,
    endDate: searchParams.get("endDate") ? new Date(searchParams.get("endDate")!) : undefined,
    page: parseInt(searchParams.get("page") || "1"),
    limit: parseInt(searchParams.get("limit") || "50"),
  };

  try {
    const result = await auditService.listLogs(filter);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to list audit logs:", error);
    return NextResponse.json({ error: "監査ログの取得に失敗しました" }, { status: 500 });
  }
}
