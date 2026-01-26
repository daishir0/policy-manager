import { claudeService, type Message } from "./claude.service";
import { embeddingService } from "./embedding.service";
import { prisma } from "@/lib/prisma";

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
    similarity: number;
  }>;
  confidence: number;
}

export interface DraftResult {
  draft: string;
  referencedDocuments: Array<{
    documentId: string;
    documentTitle: string;
  }>;
}

const CONTRADICTION_SYSTEM_PROMPT = `あなたは組織の文書管理システムのAIアシスタントです。
新しい文書と既存の文書の間に矛盾や不整合がないかを分析します。
矛盾がある場合は、具体的な箇所と修正提案を日本語で提示してください。

出力はJSON形式で以下の構造にしてください：
{
  "hasContradictions": boolean,
  "contradictions": [
    {
      "severity": "high" | "medium" | "low",
      "description": "矛盾の説明",
      "affectedSection": "既存文書の該当箇所",
      "suggestion": "修正提案"
    }
  ]
}`;

const QA_SYSTEM_PROMPT = `あなたは組織の文書に関する質問に回答するAIアシスタントです。
提供された文書の内容に基づいて、正確で簡潔な回答を日本語で提供してください。
回答には必ず根拠となる文書の該当箇所を引用してください。
文書に記載がない内容については、推測せず「該当する情報が見つかりませんでした」と回答してください。`;

const DRAFT_SYSTEM_PROMPT = `あなたは組織文書の作成を支援するAIアシスタントです。
ユーザーの要点やアイディアに基づいて、既存の文書スタイルと整合性のある文書案を日本語で作成してください。
既存の関連文書の形式や用語を参考にしてください。`;

export class AIService {
  // 矛盾チェック
  async checkContradictions(
    newDocumentContent: string,
    newDocumentTitle: string
  ): Promise<ContradictionResult> {
    // 類似文書を検索
    const similarDocs = await embeddingService.searchSimilar(newDocumentContent, 10, 0.5);

    if (similarDocs.length === 0) {
      return { hasContradictions: false, contradictions: [] };
    }

    // 類似文書の詳細を取得
    const documentIds = [...new Set(similarDocs.map((d) => d.documentId))];
    const documents = await prisma.document.findMany({
      where: { id: { in: documentIds } },
      select: { id: true, title: true, content: true },
    });

    const docMap = new Map(documents.map((d) => [d.id, d]));

    // コンテキストを構築
    const context = similarDocs
      .map((doc) => {
        const fullDoc = docMap.get(doc.documentId);
        return `【${fullDoc?.title}】\n${doc.chunkText}`;
      })
      .join("\n\n---\n\n");

    const messages: Message[] = [
      {
        role: "user",
        content: `新しい文書のタイトル: ${newDocumentTitle}

新しい文書の内容:
${newDocumentContent}

---

関連する既存文書:
${context}

上記の新しい文書と既存文書の間に矛盾や不整合がないか分析してください。`,
      },
    ];

    const response = await claudeService.sendMessage(messages, {
      systemPrompt: CONTRADICTION_SYSTEM_PROMPT,
      temperature: 0.3,
    });

    try {
      const result = JSON.parse(response.content);
      return {
        hasContradictions: result.hasContradictions,
        contradictions: result.contradictions.map((c: {
          severity: "high" | "medium" | "low";
          description: string;
          affectedSection: string;
          suggestion: string;
        }, index: number) => ({
          ...c,
          affectedDocumentId: documentIds[index % documentIds.length],
          affectedDocumentTitle: docMap.get(documentIds[index % documentIds.length])?.title || "",
        })),
      };
    } catch {
      console.error("Failed to parse contradiction check result");
      return { hasContradictions: false, contradictions: [] };
    }
  }

  // Q&A回答生成
  async generateAnswer(
    question: string,
    sessionId: string,
    userId: string
  ): Promise<QAResult> {
    // 関連文書を検索
    const similarDocs = await embeddingService.searchSimilar(question, 5, 0.6);

    if (similarDocs.length === 0) {
      // Q&Aログを保存
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

    // 文書の詳細を取得
    const documentIds = [...new Set(similarDocs.map((d) => d.documentId))];
    const documents = await prisma.document.findMany({
      where: { id: { in: documentIds } },
      select: { id: true, title: true },
    });

    const docMap = new Map(documents.map((d) => [d.id, d]));

    // コンテキストを構築
    const context = similarDocs
      .map((doc) => {
        const fullDoc = docMap.get(doc.documentId);
        return `【${fullDoc?.title}】\n${doc.chunkText}`;
      })
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
      systemPrompt: QA_SYSTEM_PROMPT,
      temperature: 0.5,
    });

    const sources = similarDocs.map((doc) => ({
      documentId: doc.documentId,
      documentTitle: docMap.get(doc.documentId)?.title || "",
      relevantText: doc.chunkText,
      similarity: doc.similarity,
    }));

    const confidence = Math.min(
      1,
      similarDocs.reduce((sum, d) => sum + d.similarity, 0) / similarDocs.length
    );

    // Q&Aログを保存
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

  // 文案生成
  async generateDraft(
    idea: string,
    additionalContext?: string
  ): Promise<DraftResult> {
    // 関連文書を検索（Embeddingサービスが利用できない場合は空配列）
    let similarDocs: Array<{
      documentId: string;
      chunkText: string;
      similarity: number;
    }> = [];

    try {
      similarDocs = await embeddingService.searchSimilar(idea, 5, 0.5);
    } catch (error) {
      console.warn("Embedding service unavailable, generating draft without reference documents:", error);
      // Embeddingサービスが利用できない場合は参照文書なしで生成を続行
    }

    // 文書の詳細を取得
    const documentIds = [...new Set(similarDocs.map((d) => d.documentId))];
    const documents = documentIds.length > 0
      ? await prisma.document.findMany({
          where: { id: { in: documentIds } },
          select: { id: true, title: true, content: true },
        })
      : [];

    const docMap = new Map(documents.map((d) => [d.id, d]));

    // コンテキストを構築
    let context = "";
    if (similarDocs.length > 0) {
      context = similarDocs
        .map((doc) => {
          const fullDoc = docMap.get(doc.documentId);
          return `【${fullDoc?.title}】\n${doc.chunkText}`;
        })
        .join("\n\n---\n\n");
    }

    const messages: Message[] = [
      {
        role: "user",
        content: `以下のアイディア・要点に基づいて文書案を作成してください。

アイディア・要点:
${idea}

${additionalContext ? `追加の指示:\n${additionalContext}\n\n` : ""}
${context ? `参考となる既存文書:\n${context}` : ""}

上記を参考に、整合性のある文書案を作成してください。`,
      },
    ];

    const response = await claudeService.sendMessage(messages, {
      systemPrompt: DRAFT_SYSTEM_PROMPT,
      temperature: 0.7,
      maxTokens: 8192,
    });

    return {
      draft: response.content,
      referencedDocuments: documents.map((d) => ({
        documentId: d.id,
        documentTitle: d.title,
      })),
    };
  }

  // 文案の再生成
  async regenerateDraft(
    originalDraft: string,
    feedback: string,
    referencedDocumentIds: string[]
  ): Promise<DraftResult> {
    // 参照文書を取得
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

参考文書:
${context}

上記の指示に基づいて文書案を修正してください。`,
      },
    ];

    const response = await claudeService.sendMessage(messages, {
      systemPrompt: DRAFT_SYSTEM_PROMPT,
      temperature: 0.7,
      maxTokens: 8192,
    });

    return {
      draft: response.content,
      referencedDocuments: documents.map((d) => ({
        documentId: d.id,
        documentTitle: d.title,
      })),
    };
  }
}

export const aiService = new AIService();
