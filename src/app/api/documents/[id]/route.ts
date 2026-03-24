import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { documentService } from "@/lib/services/document.service";
import { auditService } from "@/lib/services/audit.service";
import { analyticsService } from "@/lib/services/analytics.service";
import { aiService } from "@/lib/services/ai.service";
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
    const document = await documentService.getDocument(id);

    // 文書閲覧ログを記録（監査ログ + アクセスログ）
    auditService.log({
      userId: session.user.id,
      action: "document_view",
      entityType: "document",
      entityId: id,
      details: { title: document.title },
      ipAddress: request.headers.get("x-forwarded-for") || undefined,
    }).catch((err) => console.error("Failed to log document view:", err));

    analyticsService.logAccess(
      session.user.id,
      "view",
      id,
      { title: document.title },
      request.headers.get("x-forwarded-for") || undefined,
      request.headers.get("user-agent") || undefined,
    ).catch((err) => console.error("Failed to log access:", err));

    return NextResponse.json(document);
  } catch (error) {
    console.error("Failed to get document:", error);
    const message = error instanceof Error ? error.message : "文書の取得に失敗しました";
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

  if (!hasPermission(session.user.roles, session.user.permissions, PERMISSIONS.DOCUMENT_UPDATE)) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const document = await documentService.updateDocument(id, body, session.user.id);

    await auditService.log({
      userId: session.user.id,
      action: "document_update",
      entityType: "document",
      entityId: id,
      details: { title: document.title, updatedFields: Object.keys(body) },
      ipAddress: request.headers.get("x-forwarded-for") || undefined,
    });

    // 非同期で矛盾チェックを実行（保存は即時完了）
    Promise.resolve().then(() => {
      aiService.checkContradictionsWithTree(
        id,
        document.title,
        document.content
      ).catch((error) => {
        console.error("Async contradiction check failed:", error);
      });
    });

    return NextResponse.json(document);
  } catch (error) {
    console.error("Failed to update document:", error);
    const message = error instanceof Error ? error.message : "文書の更新に失敗しました";
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

  if (!hasPermission(session.user.roles, session.user.permissions, PERMISSIONS.DOCUMENT_DELETE)) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  try {
    const { id } = await params;
    const searchParams = request.nextUrl.searchParams;
    const hardDelete = searchParams.get("hard") === "true";

    await documentService.deleteDocument(id, hardDelete);

    await auditService.log({
      userId: session.user.id,
      action: "document_delete",
      entityType: "document",
      entityId: id,
      details: { hardDelete },
      ipAddress: request.headers.get("x-forwarded-for") || undefined,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete document:", error);
    const message = error instanceof Error ? error.message : "文書の削除に失敗しました";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
