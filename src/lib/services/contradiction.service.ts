import { prisma } from "@/lib/prisma";

export interface ContradictionItem {
  id: string;
  documentId: string;
  documentTitle: string;
  comparedDocId: string | null;
  comparedDocTitle: string | null;
  severity: string;
  description: string;
  suggestion: string;
  ignoredAt: Date | null;
  createdAt: Date;
}

export class ContradictionService {
  // 未無視の矛盾検出を取得
  async getActiveContradictions(): Promise<ContradictionItem[]> {
    const contradictions = await prisma.contradictionDetection.findMany({
      where: {
        ignoredAt: null,
      },
      include: {
        document: { select: { id: true, title: true } },
        comparedDoc: { select: { id: true, title: true } },
      },
      orderBy: [
        { severity: "asc" },  // high が先
        { createdAt: "desc" },
      ],
    });

    return contradictions.map((c) => ({
      id: c.id,
      documentId: c.documentId,
      documentTitle: c.document.title,
      comparedDocId: c.comparedDocId,
      comparedDocTitle: c.comparedDoc?.title ?? null,
      severity: c.severity,
      description: c.description,
      suggestion: c.suggestion,
      ignoredAt: c.ignoredAt,
      createdAt: c.createdAt,
    }));
  }

  // 全ての矛盾検出を取得（無視済み含む）
  async getAllContradictions(): Promise<ContradictionItem[]> {
    const contradictions = await prisma.contradictionDetection.findMany({
      include: {
        document: { select: { id: true, title: true } },
        comparedDoc: { select: { id: true, title: true } },
      },
      orderBy: [
        { ignoredAt: "asc" },  // null（未無視）が先
        { severity: "asc" },
        { createdAt: "desc" },
      ],
    });

    return contradictions.map((c) => ({
      id: c.id,
      documentId: c.documentId,
      documentTitle: c.document.title,
      comparedDocId: c.comparedDocId,
      comparedDocTitle: c.comparedDoc?.title ?? null,
      severity: c.severity,
      description: c.description,
      suggestion: c.suggestion,
      ignoredAt: c.ignoredAt,
      createdAt: c.createdAt,
    }));
  }

  // 未無視の矛盾数を取得
  async getActiveCount(): Promise<number> {
    return prisma.contradictionDetection.count({
      where: { ignoredAt: null },
    });
  }

  // 矛盾を無視
  async ignoreContradiction(id: string, userId: string): Promise<void> {
    await prisma.contradictionDetection.update({
      where: { id },
      data: {
        ignoredAt: new Date(),
        ignoredById: userId,
      },
    });
  }

  // 矛盾を作成
  async createContradiction(data: {
    documentId: string;
    comparedDocId: string | null;
    severity: string;
    description: string;
    suggestion: string;
  }): Promise<void> {
    // 同じ文書ペアの既存の未無視矛盾があれば削除（重複防止）
    await prisma.contradictionDetection.deleteMany({
      where: {
        documentId: data.documentId,
        comparedDocId: data.comparedDocId,
        ignoredAt: null,
      },
    });

    await prisma.contradictionDetection.create({
      data,
    });
  }

  // 特定文書の矛盾を全て削除（文書更新時にリセット）
  async clearContradictionsForDocument(documentId: string): Promise<void> {
    await prisma.contradictionDetection.deleteMany({
      where: {
        documentId,
        ignoredAt: null,  // 無視されていないものだけ削除
      },
    });
  }
}

export const contradictionService = new ContradictionService();
