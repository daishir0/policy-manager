import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { documentService } from "@/lib/services/document.service";
import { auditService } from "@/lib/services/audit.service";
import { aiService } from "@/lib/services/ai.service";
import { analyticsService } from "@/lib/services/analytics.service";
import { hasPermission, PERMISSIONS, type Role } from "@/lib/auth/permissions";
import { DocumentStatus } from "@prisma/client";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  if (!hasPermission(session.user.role as Role, PERMISSIONS.DOCUMENT_READ)) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const searchParams = request.nextUrl.searchParams;
  const filter = {
    search: searchParams.get("search") || undefined,
    status: (searchParams.get("status") as DocumentStatus) || undefined,
    assigneeId: searchParams.get("assigneeId") || undefined,
    createdById: searchParams.get("createdById") || undefined,
    page: parseInt(searchParams.get("page") || "1"),
    limit: parseInt(searchParams.get("limit") || "20"),
  };

  try {
    const result = await documentService.listDocuments(filter);

    // 検索クエリがある場合はアクセスログに記録
    if (filter.search) {
      analyticsService.logAccess(
        session.user.id,
        "search",
        undefined,
        { query: filter.search, resultCount: result.pagination?.total ?? 0 },
        request.headers.get("x-forwarded-for") || undefined,
        request.headers.get("user-agent") || undefined,
      ).catch((err) => console.error("Failed to log search:", err));
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to list documents:", error);
    return NextResponse.json({ error: "文書一覧の取得に失敗しました" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  if (!hasPermission(session.user.role as Role, PERMISSIONS.DOCUMENT_CREATE)) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const document = await documentService.createDocument(body, session.user.id);

    await auditService.log({
      userId: session.user.id,
      action: "document_create",
      entityType: "document",
      entityId: document.id,
      details: { title: document.title },
      ipAddress: request.headers.get("x-forwarded-for") || undefined,
    });

    // 非同期で矛盾チェックを実行（保存は即時完了）
    Promise.resolve().then(() => {
      aiService.checkContradictionsWithTree(
        document.id,
        document.title,
        document.content
      ).catch((error) => {
        console.error("Async contradiction check failed:", error);
      });
    });

    return NextResponse.json(document, { status: 201 });
  } catch (error) {
    console.error("Failed to create document:", error);
    const message = error instanceof Error ? error.message : "文書の作成に失敗しました";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
