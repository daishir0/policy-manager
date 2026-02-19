import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export interface AccessStats {
  totalViews: number;
  uniqueUsers: number;
  topDocuments: Array<{
    documentId: string;
    documentTitle: string;
    viewCount: number;
  }>;
  topSearchTerms: Array<{
    term: string;
    count: number;
  }>;
  dailyStats: Array<{
    date: string;
    views: number;
    searches: number;
    qaQuestions: number;
  }>;
}

export interface UnansweredQuestion {
  question: string;
  count: number;
  lastAsked: Date;
}

export class AnalyticsService {
  // アクセスログを記録
  async logAccess(
    userId: string,
    action: string,
    documentId?: string,
    details?: Prisma.InputJsonValue,
    ipAddress?: string,
    userAgent?: string
  ) {
    return prisma.accessLog.create({
      data: {
        userId,
        action,
        documentId,
        details: details ?? undefined,
        ipAddress,
        userAgent,
      },
    });
  }

  // アクセス統計を取得
  async getStats(startDate: Date, endDate: Date): Promise<AccessStats> {
    const [
      totalViews,
      uniqueUsers,
      topDocuments,
      searchLogs,
      dailyStatsRaw,
    ] = await Promise.all([
      // 総閲覧数
      prisma.accessLog.count({
        where: {
          action: "view",
          createdAt: { gte: startDate, lte: endDate },
        },
      }),

      // ユニークユーザー数
      prisma.accessLog.groupBy({
        by: ["userId"],
        where: {
          createdAt: { gte: startDate, lte: endDate },
        },
      }).then((r) => r.length),

      // 人気文書
      prisma.accessLog.groupBy({
        by: ["documentId"],
        where: {
          action: "view",
          documentId: { not: null },
          createdAt: { gte: startDate, lte: endDate },
        },
        _count: { documentId: true },
        orderBy: { _count: { documentId: "desc" } },
        take: 10,
      }),

      // 検索ログ
      prisma.accessLog.findMany({
        where: {
          action: "search",
          createdAt: { gte: startDate, lte: endDate },
        },
        select: { details: true },
      }),

      // 日別統計
      prisma.$queryRaw<Array<{ date: Date | string; action: string; count: bigint }>>`
        SELECT
          DATE("createdAt") as date,
          action,
          COUNT(*) as count
        FROM access_logs
        WHERE "createdAt" >= ${startDate} AND "createdAt" <= ${endDate}
        GROUP BY DATE("createdAt"), action
        ORDER BY date DESC
      `,
    ]);

    // 文書タイトルを取得
    const documentIds = topDocuments
      .map((d) => d.documentId)
      .filter((id): id is string => id !== null);
    const documents = await prisma.document.findMany({
      where: { id: { in: documentIds } },
      select: { id: true, title: true },
    });
    const docMap = new Map(documents.map((d) => [d.id, d.title]));

    // 検索キーワードを集計
    const searchTerms = new Map<string, number>();
    searchLogs.forEach((log) => {
      const details = log.details as { query?: string } | null;
      if (details?.query) {
        const count = searchTerms.get(details.query) || 0;
        searchTerms.set(details.query, count + 1);
      }
    });

    // 日別統計を整形（$queryRawのDATE()はDateオブジェクトを返すため文字列に変換）
    const dailyMap = new Map<string, { views: number; searches: number; qaQuestions: number }>();
    dailyStatsRaw.forEach((row) => {
      const dateStr = row.date instanceof Date
        ? row.date.toISOString().split("T")[0]
        : String(row.date);
      const existing = dailyMap.get(dateStr) || { views: 0, searches: 0, qaQuestions: 0 };
      if (row.action === "view") existing.views = Number(row.count);
      else if (row.action === "search") existing.searches = Number(row.count);
      else if (row.action === "qa_ask") existing.qaQuestions = Number(row.count);
      dailyMap.set(dateStr, existing);
    });

    return {
      totalViews,
      uniqueUsers,
      topDocuments: topDocuments.map((d) => ({
        documentId: d.documentId!,
        documentTitle: docMap.get(d.documentId!) || "不明",
        viewCount: d._count.documentId,
      })),
      topSearchTerms: Array.from(searchTerms.entries())
        .map(([term, count]) => ({ term, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 20),
      dailyStats: Array.from(dailyMap.entries())
        .map(([date, stats]) => ({ date, ...stats }))
        .sort((a, b) => b.date.localeCompare(a.date)),
    };
  }

  // 文書別統計
  async getDocumentStats(documentId: string, startDate: Date, endDate: Date) {
    const [viewCount, uniqueViewers, recentLogs] = await Promise.all([
      prisma.accessLog.count({
        where: {
          documentId,
          action: "view",
          createdAt: { gte: startDate, lte: endDate },
        },
      }),
      prisma.accessLog.groupBy({
        by: ["userId"],
        where: {
          documentId,
          action: "view",
          createdAt: { gte: startDate, lte: endDate },
        },
      }).then((r) => r.length),
      prisma.accessLog.findMany({
        where: {
          documentId,
          createdAt: { gte: startDate, lte: endDate },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
    ]);

    return {
      viewCount,
      uniqueViewers,
      recentLogs,
    };
  }

  // 未回答質問を取得
  async getUnansweredQuestions(): Promise<UnansweredQuestion[]> {
    const questions = await prisma.qAInteraction.findMany({
      where: {
        confidence: { lt: 0.3 },
      },
      select: {
        question: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // 質問をグループ化
    const questionMap = new Map<string, { count: number; lastAsked: Date }>();
    questions.forEach((q) => {
      const normalized = q.question.toLowerCase().trim();
      const existing = questionMap.get(normalized);
      if (existing) {
        existing.count++;
        if (q.createdAt > existing.lastAsked) {
          existing.lastAsked = q.createdAt;
        }
      } else {
        questionMap.set(normalized, { count: 1, lastAsked: q.createdAt });
      }
    });

    return Array.from(questionMap.entries())
      .map(([question, data]) => ({
        question,
        count: data.count,
        lastAsked: data.lastAsked,
      }))
      .sort((a, b) => b.count - a.count);
  }
}

export const analyticsService = new AnalyticsService();
