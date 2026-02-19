import { claudeService, type Message } from "./claude.service";
import { prisma } from "@/lib/prisma";
import { AI_PROMPTS } from "@/lib/ai/prompts";
import { messageService } from "./message.service";

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

// ドキュメントツリーウォーク：対象文書から上下方向に全文書を収集
async function collectDocumentTree(documentId: string): Promise<string[]> {
  const visited = new Set<string>();
  const queue = [documentId];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    if (visited.has(currentId)) continue;
    visited.add(currentId);

    // 上方向（依存先・親）を取得
    const deps = await prisma.documentDependency.findMany({
      where: { dependentDocId: currentId },
      select: { dependencyDocId: true },
    });

    // 下方向（依存元・子）を取得
    const dependents = await prisma.documentDependency.findMany({
      where: { dependencyDocId: currentId },
      select: { dependentDocId: true },
    });

    for (const dep of deps) {
      if (!visited.has(dep.dependencyDocId)) {
        queue.push(dep.dependencyDocId);
      }
    }
    for (const dependent of dependents) {
      if (!visited.has(dependent.dependentDocId)) {
        queue.push(dependent.dependentDocId);
      }
    }
  }

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
  async checkContradictionsWithTree(
    editedDocumentId: string,
    editedDocumentTitle: string,
    editedDocumentContent: string
  ): Promise<void> {
    try {
      // ツリーウォークで関連文書を収集
      const relatedDocIds = await collectDocumentTree(editedDocumentId);

      if (relatedDocIds.length === 0) return;

      const relatedDocs = await prisma.document.findMany({
        where: {
          id: { in: relatedDocIds },
          deletedAt: null,
        },
        select: { id: true, title: true, content: true, assigneeId: true },
      });

      // 各関連文書と1対1で矛盾チェック
      for (const relatedDoc of relatedDocs) {
        const messages: Message[] = [
          {
            role: "user",
            content: `編集された文書のタイトル: ${editedDocumentTitle}

編集された文書の内容:
${editedDocumentContent.substring(0, 3000)}

---

比較する既存文書のタイトル: ${relatedDoc.title}

比較する既存文書の内容:
${relatedDoc.content.substring(0, 3000)}

上記2つの文書の間に矛盾や不整合がないか分析してください。`,
          },
        ];

        const response = await claudeService.sendMessage(messages, {
          systemPrompt: AI_PROMPTS.CONTRADICTION_CHECK,
          temperature: 0.3,
        });

        try {
          // JSONブロックを抽出
          const jsonMatch = response.content.match(/\{[\s\S]*\}/);
          if (!jsonMatch) continue;

          const result = JSON.parse(jsonMatch[0]);

          if (result.hasContradictions && result.contradictions?.length > 0) {
            // 担当者にメッセージを送信
            const targetUserId = relatedDoc.assigneeId;
            if (!targetUserId) continue;

            const contradictionSummary = result.contradictions
              .map((c: { severity: string; description: string; suggestion: string }) =>
                `【${c.severity === "high" ? "重大" : c.severity === "medium" ? "中程度" : "軽微"}】${c.description}\n修正提案: ${c.suggestion}`
              )
              .join("\n\n");

            const messageContent = `文書「${editedDocumentTitle}」の編集により、担当文書「${relatedDoc.title}」との矛盾が検出されました。\n\n${contradictionSummary}\n\n確認・修正をお願いします。`;

            await messageService.createMessage({
              userId: targetUserId,
              content: messageContent,
              documentId: relatedDoc.id,
            });
          }
        } catch (parseError) {
          console.error("Failed to parse contradiction check result:", parseError);
        }
      }
    } catch (error) {
      console.error("Contradiction check with tree failed:", error);
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
        content: `新しい文書のタイトル: ${newDocumentTitle}

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
        content: `質問: ${question}

参考文書:
${context}

上記の文書を参考に質問に回答してください。`,
      },
    ];

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
        content: `以下のアイディア・要点に基づいて文書案を作成してください。

アイディア・要点:
${idea}

${context ? `参考となる既存文書:\n${context}` : ""}

上記を参考に、整合性のある文書案をMarkdown形式で作成してください。
最初の行を文書タイトル（# タイトル）としてください。`,
      },
    ];

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
        content: `現在の文書案:
${originalDraft}

修正の指示:
${feedback}

${context ? `参考文書:\n${context}` : ""}

上記の指示に基づいて文書案を修正してください。`,
      },
    ];

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
  }
}

export const aiService = new AIService();
