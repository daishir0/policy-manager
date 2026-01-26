import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { documentService } from "@/lib/services/document.service";
import { auditService } from "@/lib/services/audit.service";
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
    categoryId: searchParams.get("categoryId") || undefined,
    organizationId: searchParams.get("organizationId") || undefined,
    createdById: searchParams.get("createdById") || undefined,
    page: parseInt(searchParams.get("page") || "1"),
    limit: parseInt(searchParams.get("limit") || "20"),
  };

  try {
    const result = await documentService.listDocuments(filter);
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

    return NextResponse.json(document, { status: 201 });
  } catch (error) {
    console.error("Failed to create document:", error);
    const message = error instanceof Error ? error.message : "文書の作成に失敗しました";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
