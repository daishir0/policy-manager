import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { documentService } from "@/lib/services/document.service";
import { auditService } from "@/lib/services/audit.service";
import { hasPermission, PERMISSIONS, type Role } from "@/lib/auth/permissions";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  if (!hasPermission(session.user.role as Role, PERMISSIONS.DOCUMENT_PUBLISH)) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  try {
    const { id } = await params;
    const document = await documentService.publishDocument(id, session.user.id);

    await auditService.log({
      userId: session.user.id,
      action: "document_publish",
      entityType: "document",
      entityId: id,
      details: { title: document.title, version: document.currentVersion },
      ipAddress: request.headers.get("x-forwarded-for") || undefined,
    });

    return NextResponse.json(document);
  } catch (error) {
    console.error("Failed to publish document:", error);
    const message = error instanceof Error ? error.message : "文書の公開に失敗しました";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
