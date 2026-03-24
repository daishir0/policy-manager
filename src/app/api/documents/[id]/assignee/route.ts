import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { auditService } from "@/lib/services/audit.service";
import { isAdmin } from "@/lib/auth/permissions";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  if (!isAdmin(session.user.roles)) {
    return NextResponse.json({ error: "管理者権限が必要です" }, { status: 403 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const { assigneeId } = body;

    if (!assigneeId) {
      return NextResponse.json({ error: "assigneeId は必須です" }, { status: 400 });
    }

    // ユーザーの存在確認
    const user = await prisma.user.findUnique({ where: { id: assigneeId } });
    if (!user) {
      return NextResponse.json({ error: "指定されたユーザーが存在しません" }, { status: 404 });
    }

    const document = await prisma.document.update({
      where: { id },
      data: { assigneeId },
      include: {
        assignee: { select: { id: true, name: true, email: true } },
      },
    });

    await auditService.log({
      userId: session.user.id,
      action: "assignee_change",
      entityType: "document",
      entityId: id,
      details: { assigneeId, assigneeName: user.name },
      ipAddress: request.headers.get("x-forwarded-for") || undefined,
    });

    return NextResponse.json(document);
  } catch (error) {
    console.error("Failed to update assignee:", error);
    const message = error instanceof Error ? error.message : "担当者変更に失敗しました";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
