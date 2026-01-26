import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { DocumentStatus } from "@prisma/client";

// バリデーションスキーマ
export const createDocumentSchema = z.object({
  title: z.string().min(1, "タイトルを入力してください"),
  content: z.string().min(1, "本文を入力してください"),
  summary: z.string().optional(),
  categoryIds: z.array(z.string()).optional(),
  organizationIds: z.array(z.string()).optional(),
  effectiveDate: z.string().datetime().optional(),
  expirationDate: z.string().datetime().optional(),
});

export const updateDocumentSchema = z.object({
  title: z.string().min(1, "タイトルを入力してください").optional(),
  content: z.string().min(1, "本文を入力してください").optional(),
  summary: z.string().optional(),
  categoryIds: z.array(z.string()).optional(),
  organizationIds: z.array(z.string()).optional(),
  effectiveDate: z.string().datetime().nullable().optional(),
  expirationDate: z.string().datetime().nullable().optional(),
  changeNote: z.string().optional(),
});

export type CreateDocumentInput = z.infer<typeof createDocumentSchema>;
export type UpdateDocumentInput = z.infer<typeof updateDocumentSchema>;

export interface DocumentFilter {
  search?: string;
  status?: DocumentStatus;
  categoryId?: string;
  organizationId?: string;
  createdById?: string;
  page?: number;
  limit?: number;
}

export class DocumentService {
  async createDocument(input: CreateDocumentInput, createdById: string) {
    const validated = createDocumentSchema.parse(input);

    const document = await prisma.document.create({
      data: {
        title: validated.title,
        content: validated.content,
        summary: validated.summary,
        status: DocumentStatus.DRAFT,
        currentVersion: "1.0",
        effectiveDate: validated.effectiveDate ? new Date(validated.effectiveDate) : null,
        expirationDate: validated.expirationDate ? new Date(validated.expirationDate) : null,
        createdById,
        categories: validated.categoryIds?.length
          ? { create: validated.categoryIds.map((categoryId) => ({ categoryId })) }
          : undefined,
        organizations: validated.organizationIds?.length
          ? { create: validated.organizationIds.map((organizationId) => ({ organizationId })) }
          : undefined,
      },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        categories: { include: { category: true } },
        organizations: { include: { organization: true } },
      },
    });

    // 初期バージョンを履歴に保存
    await prisma.documentVersion.create({
      data: {
        documentId: document.id,
        version: "1.0",
        title: document.title,
        content: document.content,
        summary: document.summary,
        changeNote: "初版作成",
        editedById: createdById,
      },
    });

    return document;
  }

  async updateDocument(id: string, input: UpdateDocumentInput, editedById: string) {
    const validated = updateDocumentSchema.parse(input);

    // 現在の文書を取得
    const current = await prisma.document.findUnique({
      where: { id },
      include: {
        categories: true,
        organizations: true,
      },
    });

    if (!current) {
      throw new Error("文書が見つかりません");
    }

    // バージョン番号を更新（マイナーバージョンアップ）
    const [major, minor] = current.currentVersion.split(".").map(Number);
    const newVersion = `${major}.${minor + 1}`;

    // トランザクションで更新
    const document = await prisma.$transaction(async (tx) => {
      // 現在の内容を履歴に保存
      if (validated.title || validated.content || validated.summary) {
        await tx.documentVersion.create({
          data: {
            documentId: id,
            version: newVersion,
            title: validated.title || current.title,
            content: validated.content || current.content,
            summary: validated.summary !== undefined ? validated.summary : current.summary,
            changeNote: validated.changeNote || "内容更新",
            editedById,
          },
        });
      }

      // カテゴリの更新
      if (validated.categoryIds !== undefined) {
        await tx.documentCategory.deleteMany({ where: { documentId: id } });
        if (validated.categoryIds.length > 0) {
          await tx.documentCategory.createMany({
            data: validated.categoryIds.map((categoryId) => ({ documentId: id, categoryId })),
          });
        }
      }

      // 組織の更新
      if (validated.organizationIds !== undefined) {
        await tx.documentOrganization.deleteMany({ where: { documentId: id } });
        if (validated.organizationIds.length > 0) {
          await tx.documentOrganization.createMany({
            data: validated.organizationIds.map((organizationId) => ({ documentId: id, organizationId })),
          });
        }
      }

      // 文書の更新
      return tx.document.update({
        where: { id },
        data: {
          ...(validated.title && { title: validated.title }),
          ...(validated.content && { content: validated.content }),
          ...(validated.summary !== undefined && { summary: validated.summary }),
          ...(validated.effectiveDate !== undefined && {
            effectiveDate: validated.effectiveDate ? new Date(validated.effectiveDate) : null,
          }),
          ...(validated.expirationDate !== undefined && {
            expirationDate: validated.expirationDate ? new Date(validated.expirationDate) : null,
          }),
          currentVersion: newVersion,
        },
        include: {
          createdBy: { select: { id: true, name: true, email: true } },
          categories: { include: { category: true } },
          organizations: { include: { organization: true } },
        },
      });
    });

    return document;
  }

  async deleteDocument(id: string, hardDelete = false) {
    if (hardDelete) {
      await prisma.document.delete({ where: { id } });
    } else {
      await prisma.document.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
    }
  }

  async getDocument(id: string) {
    const document = await prisma.document.findUnique({
      where: { id, deletedAt: null },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        categories: { include: { category: true } },
        organizations: { include: { organization: true } },
        attachments: true,
        dependencies: {
          include: { dependencyDoc: { select: { id: true, title: true } } },
        },
        dependents: {
          include: { dependentDoc: { select: { id: true, title: true } } },
        },
      },
    });

    if (!document) {
      throw new Error("文書が見つかりません");
    }

    return document;
  }

  async listDocuments(filter: DocumentFilter = {}) {
    const { search, status, categoryId, organizationId, createdById, page = 1, limit = 20 } = filter;
    const skip = (page - 1) * limit;

    const where = {
      deletedAt: null,
      ...(search && {
        OR: [
          { title: { contains: search, mode: "insensitive" as const } },
          { content: { contains: search, mode: "insensitive" as const } },
        ],
      }),
      ...(status && { status }),
      ...(categoryId && { categories: { some: { categoryId } } }),
      ...(organizationId && { organizations: { some: { organizationId } } }),
      ...(createdById && { createdById }),
    };

    const [documents, total] = await Promise.all([
      prisma.document.findMany({
        where,
        include: {
          createdBy: { select: { id: true, name: true, email: true } },
          categories: { include: { category: true } },
        },
        skip,
        take: limit,
        orderBy: { updatedAt: "desc" },
      }),
      prisma.document.count({ where }),
    ]);

    return {
      documents,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getVersionHistory(documentId: string) {
    return prisma.documentVersion.findMany({
      where: { documentId },
      include: {
        editedBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async getVersion(documentId: string, version: string) {
    const docVersion = await prisma.documentVersion.findFirst({
      where: { documentId, version },
      include: {
        editedBy: { select: { id: true, name: true, email: true } },
      },
    });

    if (!docVersion) {
      throw new Error("バージョンが見つかりません");
    }

    return docVersion;
  }

  async publishDocument(id: string, editedById: string) {
    const current = await prisma.document.findUnique({ where: { id } });
    if (!current) {
      throw new Error("文書が見つかりません");
    }

    // メジャーバージョンアップ
    const [major] = current.currentVersion.split(".").map(Number);
    const newVersion = `${major + 1}.0`;

    const document = await prisma.$transaction(async (tx) => {
      // 公開バージョンを履歴に保存
      await tx.documentVersion.create({
        data: {
          documentId: id,
          version: newVersion,
          title: current.title,
          content: current.content,
          summary: current.summary,
          changeNote: "公開",
          editedById,
        },
      });

      return tx.document.update({
        where: { id },
        data: {
          status: DocumentStatus.PUBLISHED,
          currentVersion: newVersion,
        },
        include: {
          createdBy: { select: { id: true, name: true, email: true } },
        },
      });
    });

    return document;
  }

  async retireDocument(id: string, editedById: string, expirationDate?: Date) {
    const document = await prisma.document.update({
      where: { id },
      data: {
        status: DocumentStatus.RETIRED,
        expirationDate: expirationDate || new Date(),
      },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });

    // 廃止履歴を記録
    await prisma.documentVersion.create({
      data: {
        documentId: id,
        version: document.currentVersion,
        title: document.title,
        content: document.content,
        summary: document.summary,
        changeNote: "廃止",
        editedById,
      },
    });

    return document;
  }
}

export const documentService = new DocumentService();
