import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { documentService } from "@/lib/services/document.service";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  if (!hasPermission(session.user.roles, session.user.permissions, PERMISSIONS.DOCUMENT_READ)) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  try {
    const { id } = await params;
    const versions = await documentService.getVersionHistory(id);
    return NextResponse.json({ versions });
  } catch (error) {
    console.error("Failed to get version history:", error);
    const message = error instanceof Error ? error.message : "バージョン履歴の取得に失敗しました";
    return NextResponse.json({ error: message }, { status: 404 });
  }
}
