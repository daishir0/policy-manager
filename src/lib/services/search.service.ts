import { prisma } from "@/lib/prisma";
import { embeddingService } from "./embedding.service";
import { DocumentStatus } from "@prisma/client";

export interface SearchFilter {
  query: string;
  status?: DocumentStatus;
  page?: number;
  limit?: number;
  sortBy?: "relevance" | "updatedAt" | "title";
  sortOrder?: "asc" | "desc";
}

export interface SearchResult {
  documents: Array<{
    id: string;
    title: string;
    content: string;
    status: DocumentStatus;
    currentVersion: string;
    updatedAt: Date;
    relevanceScore?: number;
  }>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export class SearchService {
  // ハイブリッド検索（キーワード + ベクトル）
  async search(filter: SearchFilter): Promise<SearchResult> {
    const {
      query,
      status,
      page = 1,
      limit = 20,
      sortBy = "relevance",
      sortOrder = "desc",
    } = filter;

    const skip = (page - 1) * limit;

    // キーワード検索の条件
    const where = {
      deletedAt: null,
      status: status || DocumentStatus.PUBLISHED,
      ...(query && {
        OR: [
          { title: { contains: query, mode: "insensitive" as const } },
          { content: { contains: query, mode: "insensitive" as const } },
        ],
      }),
    };

    // ベクトル検索も実行
    let vectorResults: Map<string, number> = new Map();
    if (query && sortBy === "relevance") {
      try {
        const similarDocs = await embeddingService.searchSimilar(query, 50, 0.5);
        vectorResults = new Map(similarDocs.map((d) => [d.documentId, d.similarity]));
      } catch (error) {
        console.error("Vector search failed, falling back to keyword search:", error);
      }
    }

    // 並び替え
    const orderBy = sortBy === "title"
      ? [{ title: sortOrder as "asc" | "desc" }]
      : [{ updatedAt: sortOrder as "asc" | "desc" }];

    const [documents, total] = await Promise.all([
      prisma.document.findMany({
        where,
        orderBy,
        skip,
        take: limit * 2, // ベクトル検索結果とマージするため多めに取得
      }),
      prisma.document.count({ where }),
    ]);

    // ベクトル検索結果とマージしてスコア付け
    let scoredDocuments = documents.map((doc) => ({
      id: doc.id,
      title: doc.title,
      content: doc.content.substring(0, 300) + (doc.content.length > 300 ? "..." : ""),
      status: doc.status,
      currentVersion: doc.currentVersion,
      updatedAt: doc.updatedAt,
      relevanceScore: vectorResults.get(doc.id) || 0,
    }));

    // 関連度でソート
    if (sortBy === "relevance" && vectorResults.size > 0) {
      scoredDocuments.sort((a, b) => {
        const scoreA = a.relevanceScore || 0;
        const scoreB = b.relevanceScore || 0;
        return sortOrder === "desc" ? scoreB - scoreA : scoreA - scoreB;
      });
    }

    // ページネーション適用
    scoredDocuments = scoredDocuments.slice(0, limit);

    return {
      documents: scoredDocuments,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ブックマーク追加
  async addBookmark(userId: string, documentId: string, note?: string) {
    return prisma.bookmark.upsert({
      where: {
        userId_documentId: { userId, documentId },
      },
      update: { note },
      create: { userId, documentId, note },
    });
  }

  // ブックマーク削除
  async removeBookmark(userId: string, documentId: string) {
    await prisma.bookmark.delete({
      where: {
        userId_documentId: { userId, documentId },
      },
    });
  }

  // ブックマーク一覧
  async listBookmarks(userId: string) {
    return prisma.bookmark.findMany({
      where: { userId },
      include: {
        document: {
          select: {
            id: true,
            title: true,
            status: true,
            currentVersion: true,
            updatedAt: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  // ブックマーク確認
  async isBookmarked(userId: string, documentId: string): Promise<boolean> {
    const bookmark = await prisma.bookmark.findUnique({
      where: {
        userId_documentId: { userId, documentId },
      },
    });
    return !!bookmark;
  }
}

export const searchService = new SearchService();
