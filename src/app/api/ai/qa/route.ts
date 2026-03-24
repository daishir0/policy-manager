import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { aiService } from "@/lib/services/ai.service";
import { auditService } from "@/lib/services/audit.service";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { randomUUID } from "crypto";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  if (!hasPermission(session.user.roles, session.user.permissions, PERMISSIONS.AI_QA)) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { question, sessionId } = body;

    if (!question) {
      return NextResponse.json(
        { error: "question は必須です" },
        { status: 400 }
      );
    }

    // セッションIDがない場合は新規作成
    const qaSessionId = sessionId || randomUUID();

    const result = await aiService.generateAnswer(
      question,
      qaSessionId,
      session.user.id
    );

    // アクセスログを記録
    await prisma.accessLog.create({
      data: {
        userId: session.user.id,
        action: "qa_ask",
        details: { question, sessionId: qaSessionId },
        ipAddress: request.headers.get("x-forwarded-for") || undefined,
        userAgent: request.headers.get("user-agent") || undefined,
      },
    });

    // 監査ログにも記録（ログ管理画面で確認可能）
    await auditService.log({
      userId: session.user.id,
      action: "qa_ask",
      entityType: "ai",
      details: { question: question.substring(0, 200), sessionId: qaSessionId },
      ipAddress: request.headers.get("x-forwarded-for") || undefined,
    });

    return NextResponse.json({ ...result, sessionId: qaSessionId });
  } catch (error) {
    console.error("Failed to generate answer:", error);
    const message = error instanceof Error ? error.message : "回答の生成に失敗しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Q&A履歴を取得
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const qaSessionId = searchParams.get("sessionId");

  try {
    const where = {
      userId: session.user.id,
      ...(qaSessionId && { sessionId: qaSessionId }),
    };

    const interactions = await prisma.qAInteraction.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return NextResponse.json({ interactions });
  } catch (error) {
    console.error("Failed to get Q&A history:", error);
    return NextResponse.json({ error: "Q&A履歴の取得に失敗しました" }, { status: 500 });
  }
}
