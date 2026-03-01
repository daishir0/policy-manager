import { claudeService, type Message } from "./claude.service";
import { prisma } from "@/lib/prisma";
import { AI_PROMPTS } from "@/lib/ai/prompts";
import { messageService } from "./message.service";
import { contradictionService } from "./contradiction.service";
import { auditService } from "./audit.service";

// 現在の日付情報を取得（JST）
function getCurrentDateInfo(): string {
  const now = new Date();
  const jst = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));
  const year = jst.getFullYear();
  const month = jst.getMonth() + 1;
  const day = jst.getDate();
  const weekday = ["日", "月", "火", "水", "木", "金", "土"][jst.getDay()];

  return `本日: ${year}年${month}月${day}日（${weekday}曜日）`;
}

export interface ContradictionResult {
  hasContradictions: boolean;
  contradictions: Array<{
    severity: "high" | "medium" | "low";
    description: string;
    affectedDocumentId: string;
    affectedDocumentTitle: string;
    affectedSection: string;
    suggestion: string;
  }>;
}

export interface QAResult {
  answer: string;
  sources: Array<{
    documentId: string;
    documentTitle: string;
    relevantText: string;
  }>;
  confidence: number;
}

export interface DraftResult {
  draft: string;
  referencedDocuments: Array<{
    documentId: string;
    documentTitle: string;
  }>;
  suggestedTitle?: string;
  suggestedDependencies?: string[];
}

// ドキュメントツリーウォーク：対象文書から上下方向に文書を収集
// 上方向: メイン依存（isMain=true）のみを辿ってルートまで
// 下方向: 全ての依存元（子）を末端まで辿る
async function collectDocumentTree(documentId: string): Promise<string[]> {
  const visited = new Set<string>();

  // 上方向（ルートまで）: メイン依存のみ
  async function collectAncestors(docId: string) {
    if (visited.has(docId)) return;
    visited.add(docId);

    const mainDeps = await prisma.documentDependency.findMany({
      where: {
        dependentDocId: docId,
        isMain: true,  // メイン依存のみ
      },
      select: { dependencyDocId: true },
    });

    for (const dep of mainDeps) {
      await collectAncestors(dep.dependencyDocId);
    }
  }

  // 下方向（末端まで）: 全ての子を辿る
  async function collectDescendants(docId: string) {
    if (visited.has(docId)) return;
    visited.add(docId);

    const dependents = await prisma.documentDependency.findMany({
      where: { dependencyDocId: docId },
      select: { dependentDocId: true },
    });

    for (const dep of dependents) {
      await collectDescendants(dep.dependentDocId);
    }
  }

  // 起点から上下両方向に収集
  await collectAncestors(documentId);
  visited.delete(documentId);  // リセットして下方向へ
  await collectDescendants(documentId);

  visited.delete(documentId); // 編集文書自身を除く
  return Array.from(visited);
}

// キーワード抽出（Claude APIを使用）
async function extractKeywords(text: string, promptTemplate: string): Promise<string[]> {
  try {
    const messages: Message[] = [
      { role: "user", content: `${promptTemplate}\n\n${text}` },
    ];
    const response = await claudeService.sendMessage(messages, { temperature: 0.1, maxTokens: 100 });
    return response.content
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);
  } catch {
    // キーワード抽出失敗時は空配列
    return [];
  }
}

// キーワードで文書を全文検索（LIKE検索）
async function searchDocumentsByKeywords(keywords: string[], limit = 5) {
  if (keywords.length === 0) return [];

  const conditions = keywords.map((keyword) => ({
    OR: [
      { title: { contains: keyword, mode: "insensitive" as const } },
      { content: { contains: keyword, mode: "insensitive" as const } },
    ],
  }));

  return prisma.document.findMany({
    where: {
      AND: [
        { deletedAt: null },
        { status: "PUBLISHED" },
        { OR: conditions },
      ],
    },
    select: { id: true, title: true, content: true, assigneeId: true },
    take: limit,
  });
}

export class AIService {
  // 矛盾チェック（ツリーウォーク版）- 非同期で呼ばれる
  // 全関連文書をまとめて1回のAPI呼び出しでチェック
  async checkContradictionsWithTree(
    editedDocumentId: string,
    editedDocumentTitle: string,
    editedDocumentContent: string
  ): Promise<void> {
    try {
      // この文書の既存の未無視矛盾をクリア
      await contradictionService.clearContradictionsForDocument(editedDocumentId);

      // 編集文書の担当者を取得
      const editedDoc = await prisma.document.findUnique({
        where: { id: editedDocumentId },
        select: { assigneeId: true },
      });
      const targetUserId = editedDoc?.assigneeId;

      // ツリーウォークで関連文書を収集
      const relatedDocIds = await collectDocumentTree(editedDocumentId);

      if (relatedDocIds.length === 0) {
        // 関連文書なし → 通知のみ
        if (targetUserId) {
          await messageService.createMessage({
            userId: targetUserId,
            content: `文書「${editedDocumentTitle}」の矛盾チェック完了：関連文書がないためチェック対象がありませんでした。`,
            documentId: editedDocumentId,
          });
        }
        return;
      }

      const relatedDocs = await prisma.document.findMany({
        where: {
          id: { in: relatedDocIds },
          deletedAt: null,
        },
        select: { id: true, title: true, content: true },
      });

      // 全関連文書をコンテキストに含める（各2000文字まで）
      const context = relatedDocs
        .map((doc) => `【${doc.title}】\n${doc.content.substring(0, 2000)}`)
        .join("\n\n---\n\n");

      // 1回のAI呼び出し
      const messages: Message[] = [
        {
          role: "user",
          content: `${getCurrentDateInfo()}

編集された文書のタイトル: ${editedDocumentTitle}

編集された文書の内容:
${editedDocumentContent.substring(0, 3000)}

---

比較する関連文書一覧:
${context}

上記の編集された文書と、全ての関連文書の間に矛盾や不整合がないか分析してください。`,
        },
      ];

      const response = await claudeService.sendMessage(messages, {
        systemPrompt: AI_PROMPTS.CONTRADICTION_CHECK,
        temperature: 0.3,
      });

      // JSONパース
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return;
      const result = JSON.parse(jsonMatch[0]);

      // 1つの矛盾レコードを作成
      await contradictionService.createContradiction({
        documentId: editedDocumentId,
        comparedDocId: null, // 一括チェックなのでnull
        severity: result.hasContradictions ? "medium" : "low",
        description:
          result.summary ||
          (result.hasContradictions
            ? "矛盾が検出されました"
            : "矛盾は検出されませんでした"),
        suggestion: result.hasContradictions
          ? result.contradictions
              .map(
                (c: { relatedDocumentTitle: string; description: string }) =>
                  `【${c.relatedDocumentTitle}】${c.description}`
              )
              .join("\n")
          : "対応不要です",
      });

      // 担当者に通知
      if (targetUserId) {
        let messageContent: string;
        if (result.hasContradictions) {
          const details = result.contradictions
            .map(
              (c: {
                relatedDocumentTitle: string;
                description: string;
                suggestion: string;
              }) =>
                `・【${c.relatedDocumentTitle}】${c.description}\n  → ${c.suggestion}`
            )
            .join("\n\n");
          messageContent = `文書「${editedDocumentTitle}」の矛盾チェック完了：\n\n⚠️ 矛盾が検出されました\n\n${details}`;
        } else {
          messageContent = `文書「${editedDocumentTitle}」の矛盾チェック完了：\n\n✅ 矛盾はありませんでした`;
        }

        await messageService.createMessage({
          userId: targetUserId,
          content: messageContent,
          documentId: editedDocumentId,
        });
      }
    } catch (error) {
      console.error("Contradiction check with tree failed:", error);
      // 監査ログに記録
      await auditService.log({
        action: "ai_error",
        entityType: "document",
        entityId: editedDocumentId,
        details: {
          operation: "contradiction_check",
          documentTitle: editedDocumentTitle,
          error: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }

  // 旧矛盾チェック（直接呼び出し用）
  async checkContradictions(
    newDocumentContent: string,
    newDocumentTitle: string
  ): Promise<ContradictionResult> {
    // キーワード抽出で関連文書を検索
    const keywords = await extractKeywords(newDocumentTitle + " " + newDocumentContent.substring(0, 500), AI_PROMPTS.QA_KEYWORD_EXTRACT);
    const relatedDocs = await searchDocumentsByKeywords(keywords, 5);

    if (relatedDocs.length === 0) {
      return { hasContradictions: false, contradictions: [] };
    }

    const context = relatedDocs
      .map((doc) => `【${doc.title}】\n${doc.content.substring(0, 1000)}`)
      .join("\n\n---\n\n");

    const messages: Message[] = [
      {
        role: "user",
        content: `${getCurrentDateInfo()}

新しい文書のタイトル: ${newDocumentTitle}

新しい文書の内容:
${newDocumentContent.substring(0, 3000)}

---

関連する既存文書:
${context}

上記の新しい文書と既存文書の間に矛盾や不整合がないか分析してください。`,
      },
    ];

    const response = await claudeService.sendMessage(messages, {
      systemPrompt: AI_PROMPTS.CONTRADICTION_CHECK,
      temperature: 0.3,
    });

    try {
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return { hasContradictions: false, contradictions: [] };

      const result = JSON.parse(jsonMatch[0]);
      const docIds = relatedDocs.map((d) => d.id);

      return {
        hasContradictions: result.hasContradictions ?? false,
        contradictions: (result.contradictions || []).map((c: {
          severity: "high" | "medium" | "low";
          description: string;
          affectedSection: string;
          suggestion: string;
        }, index: number) => ({
          ...c,
          affectedDocumentId: docIds[index % docIds.length],
          affectedDocumentTitle: relatedDocs[index % relatedDocs.length]?.title || "",
        })),
      };
    } catch {
      return { hasContradictions: false, contradictions: [] };
    }
  }

  // Q&A回答生成（キーワード抽出+LIKE検索）
  async generateAnswer(
    question: string,
    sessionId: string,
    userId: string
  ): Promise<QAResult> {
    // キーワード抽出
    const keywords = await extractKeywords(question, AI_PROMPTS.QA_KEYWORD_EXTRACT);

    // キーワードで文書を検索
    const relatedDocs = keywords.length > 0
      ? await searchDocumentsByKeywords(keywords, 5)
      : [];

    if (relatedDocs.length === 0) {
      await prisma.qAInteraction.create({
        data: {
          userId,
          sessionId,
          question,
          answer: "申し訳ございませんが、ご質問に関連する文書が見つかりませんでした。",
          sources: [],
          confidence: 0,
        },
      });

      return {
        answer: "申し訳ございませんが、ご質問に関連する文書が見つかりませんでした。質問を言い換えていただくか、より具体的な内容でお尋ねください。",
        sources: [],
        confidence: 0,
      };
    }

    const context = relatedDocs
      .map((doc) => `【${doc.title}】\n${doc.content.substring(0, 1500)}`)
      .join("\n\n---\n\n");

    const messages: Message[] = [
      {
        role: "user",
        content: `${getCurrentDateInfo()}

質問: ${question}

参考文書:
${context}

上記の文書を参考に質問に回答してください。`,
      },
    ];

    try {
      const response = await claudeService.sendMessage(messages, {
        systemPrompt: AI_PROMPTS.QA_ANSWER,
        temperature: 0.5,
      });

      const sources = relatedDocs.map((doc) => ({
        documentId: doc.id,
        documentTitle: doc.title,
        relevantText: doc.content.substring(0, 200) + "...",
      }));

      const confidence = Math.min(1, keywords.length > 0 ? 0.7 : 0.3);

      await prisma.qAInteraction.create({
        data: {
          userId,
          sessionId,
          question,
          answer: response.content,
          sources: sources as unknown as never,
          confidence,
        },
      });

      return {
        answer: response.content,
        sources,
        confidence,
      };
    } catch (error) {
      console.error("Q&A answer generation failed:", error);
      await auditService.log({
        userId,
        action: "ai_error",
        entityType: "qa",
        details: {
          operation: "qa_answer",
          question: question.substring(0, 200),
          error: error instanceof Error ? error.message : String(error),
        },
      });
      throw error;
    }
  }

  // 文案生成（キーワード検索強化）
  async generateDraft(
    idea: string,
    documentTitle?: string
  ): Promise<DraftResult> {
    let relatedDocs: Array<{ id: string; title: string; content: string }> = [];

    try {
      if (documentTitle) {
        // タイトル指定検索
        relatedDocs = await prisma.document.findMany({
          where: {
            title: { contains: documentTitle, mode: "insensitive" },
            deletedAt: null,
            status: "PUBLISHED",
          },
          select: { id: true, title: true, content: true },
          take: 3,
        });
      }

      if (relatedDocs.length === 0) {
        // キーワード抽出で検索
        const keywords = await extractKeywords(idea, AI_PROMPTS.DRAFT_KEYWORD_EXTRACT);
        relatedDocs = await searchDocumentsByKeywords(keywords, 5);
      }
    } catch (error) {
      console.warn("Document search for draft failed:", error);
    }

    const context = relatedDocs.length > 0
      ? relatedDocs
          .map((doc) => `【${doc.title}】\n${doc.content.substring(0, 1000)}`)
          .join("\n\n---\n\n")
      : "";

    const messages: Message[] = [
      {
        role: "user",
        content: `${getCurrentDateInfo()}

以下のアイディア・要点に基づいて文書案を作成してください。

アイディア・要点:
${idea}

${context ? `参考となる既存文書:\n${context}` : ""}

上記を参考に、整合性のある文書案をMarkdown形式で作成してください。
最初の行を文書タイトル（# タイトル）としてください。`,
      },
    ];

    try {
      const response = await claudeService.sendMessage(messages, {
        systemPrompt: AI_PROMPTS.DRAFT_GENERATE,
        temperature: 0.7,
        maxTokens: 8192,
      });

      // タイトルを抽出（最初の # 行）
      const titleMatch = response.content.match(/^#\s+(.+)/m);
      const suggestedTitle = titleMatch ? titleMatch[1].trim() : "";

      // 関連文書IDを候補として返す
      const suggestedDependencies = relatedDocs.map((d) => d.id);

      return {
        draft: response.content,
        referencedDocuments: relatedDocs.map((d) => ({
          documentId: d.id,
          documentTitle: d.title,
        })),
        suggestedTitle,
        suggestedDependencies,
      };
    } catch (error) {
      console.error("Draft generation failed:", error);
      await auditService.log({
        action: "ai_error",
        entityType: "draft",
        details: {
          operation: "draft_generate",
          idea: idea.substring(0, 200),
          error: error instanceof Error ? error.message : String(error),
        },
      });
      throw error;
    }
  }

  // 文案の再生成
  async regenerateDraft(
    originalDraft: string,
    feedback: string,
    referencedDocumentIds: string[]
  ): Promise<DraftResult> {
    const documents = await prisma.document.findMany({
      where: { id: { in: referencedDocumentIds } },
      select: { id: true, title: true, content: true },
    });

    const context = documents
      .map((d) => `【${d.title}】\n${d.content.substring(0, 1000)}...`)
      .join("\n\n---\n\n");

    const messages: Message[] = [
      {
        role: "user",
        content: `${getCurrentDateInfo()}

現在の文書案:
${originalDraft}

修正の指示:
${feedback}

${context ? `参考文書:\n${context}` : ""}

上記の指示に基づいて文書案を修正してください。`,
      },
    ];

    try {
      const response = await claudeService.sendMessage(messages, {
        systemPrompt: AI_PROMPTS.DRAFT_GENERATE,
        temperature: 0.7,
        maxTokens: 8192,
      });

      const titleMatch = response.content.match(/^#\s+(.+)/m);
      const suggestedTitle = titleMatch ? titleMatch[1].trim() : "";

      return {
        draft: response.content,
        referencedDocuments: documents.map((d) => ({
          documentId: d.id,
          documentTitle: d.title,
        })),
        suggestedTitle,
        suggestedDependencies: documents.map((d) => d.id),
      };
    } catch (error) {
      console.error("Draft regeneration failed:", error);
      await auditService.log({
        action: "ai_error",
        entityType: "draft",
        details: {
          operation: "draft_regenerate",
          feedback: feedback.substring(0, 200),
          error: error instanceof Error ? error.message : String(error),
        },
      });
      throw error;
    }
  }

  // 編集提案を生成
  async suggestEdit(
    documentId: string,
    currentContent: string,
    instruction: string
  ): Promise<{
    suggestedContent: string;
    explanation: string;
  }> {
    // 関連文書のコンテキストを取得（依存先）
    let context = "";
    try {
      const dependencies = await prisma.documentDependency.findMany({
        where: { dependentDocId: documentId },
        include: {
          dependencyDoc: { select: { title: true, content: true } },
        },
        take: 3,
      });

      if (dependencies.length > 0) {
        context = dependencies
          .map((d) => `【${d.dependencyDoc.title}】\n${d.dependencyDoc.content.substring(0, 800)}`)
          .join("\n\n---\n\n");
      }
    } catch {
      // コンテキスト取得失敗は無視
    }

    const messages: Message[] = [
      {
        role: "user",
        content: `${getCurrentDateInfo()}

現在の文書内容:
${currentContent}

${context ? `参考となる依存先文書:\n${context}\n\n` : ""}
ユーザーからの編集指示:
${instruction}

上記の指示に基づいて、文書を編集してください。
以下の形式でJSONを返してください:
{
  "suggestedContent": "編集後の文書全文（Markdown形式）",
  "explanation": "変更内容の簡潔な説明（1-2文）"
}`,
      },
    ];

    let response;
    try {
      response = await claudeService.sendMessage(messages, {
        systemPrompt: `あなたは文書編集のアシスタントです。ユーザーの指示に従って文書を編集し、結果をJSON形式で返してください。
文書のスタイルと一貫性を保ちながら、指示された変更を適切に反映してください。
必ず有効なJSONを返してください。`,
        temperature: 0.5,
        maxTokens: 8192,
      });
    } catch (error) {
      console.error("Suggest edit failed:", error);
      await auditService.log({
        action: "ai_error",
        entityType: "document",
        entityId: documentId,
        details: {
          operation: "suggest_edit",
          instruction: instruction.substring(0, 200),
          error: error instanceof Error ? error.message : String(error),
        },
      });
      throw error;
    }

    try {
      // JSONブロックを抽出
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        // JSONが見つからない場合はレスポンス全体を提案として返す
        return {
          suggestedContent: response.content,
          explanation: "編集を提案しました。",
        };
      }

      const result = JSON.parse(jsonMatch[0]);
      return {
        suggestedContent: result.suggestedContent || response.content,
        explanation: result.explanation || "編集を提案しました。",
      };
    } catch {
      // パースに失敗した場合はレスポンス全体を返す
      return {
        suggestedContent: response.content,
        explanation: "編集を提案しました。",
      };
    }
  }
}

export const aiService = new AIService();
