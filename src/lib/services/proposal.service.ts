import { prisma } from "@/lib/prisma";
import { ProposalStatus, ProposalType } from "@prisma/client";
import { analyticsService } from "./analytics.service";

export interface ProposalFilter {
  type?: ProposalType;
  status?: ProposalStatus;
  page?: number;
  limit?: number;
}

export class ProposalService {
  // 提案を作成
  async createProposal(
    type: ProposalType,
    title: string,
    description: string,
    reasoning: string,
    relatedDocumentIds?: string[]
  ) {
    return prisma.proposal.create({
      data: {
        type,
        title,
        description,
        reasoning,
        relatedDocuments: relatedDocumentIds ? relatedDocumentIds : undefined,
      },
    });
  }

  // 提案を取得
  async getProposal(id: string) {
    const proposal = await prisma.proposal.findUnique({
      where: { id },
    });

    if (!proposal) {
      throw new Error("提案が見つかりません");
    }

    // 関連文書を取得
    const relatedDocIds = proposal.relatedDocuments as string[] | null;
    let relatedDocs: Array<{ id: string; title: string }> = [];
    if (relatedDocIds && relatedDocIds.length > 0) {
      relatedDocs = await prisma.document.findMany({
        where: { id: { in: relatedDocIds } },
        select: { id: true, title: true },
      });
    }

    return { ...proposal, relatedDocs };
  }

  // 提案一覧
  async listProposals(filter: ProposalFilter = {}) {
    const { type, status, page = 1, limit = 20 } = filter;
    const skip = (page - 1) * limit;

    const where = {
      ...(type && { type }),
      ...(status && { status }),
    };

    const [proposals, total] = await Promise.all([
      prisma.proposal.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.proposal.count({ where }),
    ]);

    return {
      proposals,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // 提案を採択
  async acceptProposal(id: string) {
    return prisma.proposal.update({
      where: { id },
      data: { status: ProposalStatus.ACCEPTED },
    });
  }

  // 提案を却下
  async rejectProposal(id: string) {
    return prisma.proposal.update({
      where: { id },
      data: { status: ProposalStatus.REJECTED },
    });
  }

  // 利用ログ分析に基づく提案を自動生成
  async generateProposalsFromAnalytics() {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const stats = await analyticsService.getStats(thirtyDaysAgo, new Date());
    const unansweredQuestions = await analyticsService.getUnansweredQuestions();

    const proposals: Array<{
      type: ProposalType;
      title: string;
      description: string;
      reasoning: string;
      relatedDocumentIds?: string[];
    }> = [];

    // 1. 頻繁にアクセスされる文書の改訂提案
    for (const doc of stats.topDocuments.slice(0, 3)) {
      if (doc.viewCount > 50) {
        proposals.push({
          type: ProposalType.REVISION,
          title: `「${doc.documentTitle}」の内容見直し提案`,
          description: `この文書は過去30日間で${doc.viewCount}回閲覧されており、多くのユーザーが参照しています。内容が最新かどうか確認し、必要に応じて更新することを推奨します。`,
          reasoning: `アクセス数が多い文書は重要度が高く、常に最新の状態を保つ必要があります。`,
          relatedDocumentIds: [doc.documentId],
        });
      }
    }

    // 2. 未回答質問に基づく新設提案
    const frequentUnanswered = unansweredQuestions.filter((q) => q.count >= 3);
    for (const question of frequentUnanswered.slice(0, 3)) {
      proposals.push({
        type: ProposalType.NEW,
        title: `FAQ追加提案: ${question.question.substring(0, 50)}...`,
        description: `「${question.question}」という質問が${question.count}回寄せられていますが、適切な回答が見つかりませんでした。この内容に関するFAQまたは文書の新設を推奨します。`,
        reasoning: `複数のユーザーから同様の質問が寄せられており、文書の追加が必要と判断されます。`,
      });
    }

    // 3. 検索されているが該当文書がないキーワードに基づく新設提案
    const topSearches = stats.topSearchTerms.slice(0, 5);
    for (const search of topSearches) {
      if (search.count >= 10) {
        proposals.push({
          type: ProposalType.NEW,
          title: `「${search.term}」に関する文書作成提案`,
          description: `「${search.term}」というキーワードで${search.count}回検索されています。このトピックに関する文書の作成を検討してください。`,
          reasoning: `検索頻度が高いキーワードは、ユーザーの関心事項を示しています。`,
        });
      }
    }

    // 提案を保存
    const savedProposals = [];
    for (const p of proposals) {
      // 同じ内容の提案が既に存在しないか確認
      const existing = await prisma.proposal.findFirst({
        where: {
          title: p.title,
          status: ProposalStatus.PENDING,
        },
      });

      if (!existing) {
        const saved = await this.createProposal(
          p.type,
          p.title,
          p.description,
          p.reasoning,
          p.relatedDocumentIds
        );
        savedProposals.push(saved);
      }
    }

    return savedProposals;
  }
}

export const proposalService = new ProposalService();
