import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { aiService } from "@/lib/services/ai.service";
import { auditService } from "@/lib/services/audit.service";
import { hasPermission, PERMISSIONS, type Role } from "@/lib/auth/permissions";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  if (!hasPermission(session.user.role as Role, PERMISSIONS.AI_DRAFT_GENERATE)) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { idea, documentTitle, regenerate, originalDraft, feedback, referencedDocumentIds } = body;

    if (regenerate) {
      if (!originalDraft || !feedback) {
        return NextResponse.json(
          { error: "再生成には originalDraft と feedback が必須です" },
          { status: 400 }
        );
      }

      const result = await aiService.regenerateDraft(
        originalDraft,
        feedback,
        referencedDocumentIds || []
      );
      return NextResponse.json(result);
    }

    if (!idea) {
      return NextResponse.json({ error: "idea は必須です" }, { status: 400 });
    }

    const result = await aiService.generateDraft(idea, documentTitle);

    await auditService.log({
      userId: session.user.id,
      action: "draft_generate",
      entityType: "ai",
      details: { idea: idea.substring(0, 100) },
      ipAddress: request.headers.get("x-forwarded-for") || undefined,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to generate draft:", error);
    const message = error instanceof Error ? error.message : "文案の生成に失敗しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
