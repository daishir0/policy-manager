import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { aiService } from "@/lib/services/ai.service";
import { hasPermission, PERMISSIONS, type Role } from "@/lib/auth/permissions";
import { contradictionService } from "@/lib/services/contradiction.service";
import { messageService } from "@/lib/services/message.service";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  if (!hasPermission(session.user.role as Role, PERMISSIONS.AI_CONTRADICTION_CHECK)) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { content, title, documentId } = body;

    if (!content || !title) {
      return NextResponse.json(
        { error: "content と title は必須です" },
        { status: 400 }
      );
    }

    const result = await aiService.checkContradictions(content, title);

    // documentIdがある場合はDB保存と通知を行う
    if (documentId) {
      // 既存の未無視矛盾をクリア
      await contradictionService.clearContradictionsForDocument(documentId);

      // 編集文書の担当者を取得
      const editedDoc = await prisma.document.findUnique({
        where: { id: documentId },
        select: { assigneeId: true },
      });
      const targetUserId = editedDoc?.assigneeId;

      // 矛盾レコードを作成
      const summary = result.hasContradictions
        ? `${result.contradictions.length}件の矛盾が検出されました`
        : "矛盾は検出されませんでした";

      await contradictionService.createContradiction({
        documentId,
        comparedDocId: null,
        severity: result.hasContradictions ? "medium" : "low",
        description: summary,
        suggestion: result.hasContradictions
          ? result.contradictions
              .map((c) => `【${c.affectedDocumentTitle}】${c.description}`)
              .join("\n")
          : "対応不要です",
      });

      // 担当者に通知
      if (targetUserId) {
        let messageContent: string;
        if (result.hasContradictions) {
          const details = result.contradictions
            .map(
              (c) =>
                `・【${c.affectedDocumentTitle}】${c.description}\n  → ${c.suggestion}`
            )
            .join("\n\n");
          messageContent = `文書「${title}」の矛盾チェック完了：\n\n⚠️ 矛盾が検出されました\n\n${details}`;
        } else {
          messageContent = `文書「${title}」の矛盾チェック完了：\n\n✅ 矛盾はありませんでした`;
        }

        await messageService.createMessage({
          userId: targetUserId,
          content: messageContent,
          documentId,
        });
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to check contradictions:", error);
    const message = error instanceof Error ? error.message : "矛盾チェックに失敗しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
