import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { DocumentStatus } from "@prisma/client";

// バリデーションスキーマ
export const createDocumentSchema = z.object({
  title: z.string().min(1, "タイトルを入力してください"),
  content: z.string().min(1, "本文を入力してください"),
  dependencyIds: z.array(z.string()).optional(),
  assigneeId: z.string().optional(),
});

export const updateDocumentSchema = z.object({
  title: z.string().min(1, "タイトルを入力してください").optional(),
  content: z.string().min(1, "本文を入力してください").optional(),
  dependencyIds: z.array(z.string()).optional(),
  assigneeId: z.string().optional().nullable(),
  changeNote: z.string().optional(),
  status: z.nativeEnum(DocumentStatus).optional(),
});

export type CreateDocumentInput = z.infer<typeof createDocumentSchema>;
export type UpdateDocumentInput = z.infer<typeof updateDocumentSchema>;

export interface DocumentFilter {
  search?: string;
  status?: DocumentStatus;
  assigneeId?: string;
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
        status: DocumentStatus.PUBLISHED,
        currentVersion: "1.0",
        createdById,
        assigneeId: validated.assigneeId || createdById,
        dependencies: validated.dependencyIds?.length
          ? {
              create: validated.dependencyIds.map((dependencyDocId, index) => ({
                dependencyDocId,
                isMain: index === 0,  // 最初の依存先をメインに
              })),
            }
          : undefined,
      },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        assignee: { select: { id: true, name: true, email: true } },
        dependencies: {
          include: { dependencyDoc: { select: { id: true, title: true } } },
        },
      },
    });

    // 初期バージョンを履歴に保存
    await prisma.documentVersion.create({
      data: {
        documentId: document.id,
        version: "1.0",
        title: document.title,
        content: document.content,
        changeNote: "初版作成",
        editedById: createdById,
      },
    });

    return document;
  }

  async updateDocument(id: string, input: UpdateDocumentInput, editedById: string) {
    const validated = updateDocumentSchema.parse(input);

    const current = await prisma.document.findUnique({
      where: { id },
    });

    if (!current) {
      throw new Error("文書が見つかりません");
    }

    // バージョン番号を更新（マイナーバージョンアップ）
    const [major, minor] = current.currentVersion.split(".").map(Number);
    const newVersion = `${major}.${minor + 1}`;

    const document = await prisma.$transaction(async (tx) => {
      // 内容変更時はバージョン履歴を保存
      if (validated.title || validated.content) {
        await tx.documentVersion.create({
          data: {
            documentId: id,
            version: newVersion,
            title: validated.title || current.title,
            content: validated.content || current.content,
            changeNote: validated.changeNote || "内容更新",
            editedById,
          },
        });
      }

      // 依存関係の更新
      if (validated.dependencyIds !== undefined) {
        await tx.documentDependency.deleteMany({ where: { dependentDocId: id } });
        if (validated.dependencyIds.length > 0) {
          await tx.documentDependency.createMany({
            data: validated.dependencyIds.map((dependencyDocId, index) => ({
              dependentDocId: id,
              dependencyDocId,
              isMain: index === 0,  // 最初の依存先をメインに
            })),
          });
        }
      }

      return tx.document.update({
        where: { id },
        data: {
          ...(validated.title && { title: validated.title }),
          ...(validated.content && { content: validated.content }),
          ...(validated.assigneeId !== undefined && { assigneeId: validated.assigneeId }),
          ...(validated.status && { status: validated.status }),
          ...(validated.title || validated.content ? { currentVersion: newVersion } : {}),
        },
        include: {
          createdBy: { select: { id: true, name: true, email: true } },
          assignee: { select: { id: true, name: true, email: true } },
          dependencies: {
            include: { dependencyDoc: { select: { id: true, title: true } } },
          },
          dependents: {
            include: { dependentDoc: { select: { id: true, title: true } } },
          },
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
        assignee: { select: { id: true, name: true, email: true } },
        attachments: true,
        versions: {
          include: { editedBy: { select: { name: true, email: true } } },
          orderBy: { createdAt: "desc" },
        },
        dependencies: {
          include: { dependencyDoc: { select: { id: true, title: true, status: true } } },
          orderBy: { createdAt: "asc" },  // 作成順でソート（最初がメイン）
        },
        dependents: {
          include: { dependentDoc: { select: { id: true, title: true, status: true } } },
        },
      },
    });

    if (!document) {
      throw new Error("文書が見つかりません");
    }

    // isMainフラグを含めて返す
    return {
      ...document,
      dependencies: document.dependencies.map((dep) => ({
        ...dep,
        isMain: dep.isMain,
      })),
    };
  }

  async listDocuments(filter: DocumentFilter = {}) {
    const { search, status, assigneeId, createdById, page = 1, limit = 20 } = filter;
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
      ...(assigneeId && { assigneeId }),
      ...(createdById && { createdById }),
    };

    const [documents, total] = await Promise.all([
      prisma.document.findMany({
        where,
        include: {
          createdBy: { select: { id: true, name: true, email: true } },
          assignee: { select: { id: true, name: true, email: true } },
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

  async publishDocument(id: string, editedById: string) {
    const current = await prisma.document.findUnique({ where: { id } });
    if (!current) {
      throw new Error("文書が見つかりません");
    }

    const [major] = current.currentVersion.split(".").map(Number);
    const newVersion = `${major + 1}.0`;

    const document = await prisma.$transaction(async (tx) => {
      await tx.documentVersion.create({
        data: {
          documentId: id,
          version: newVersion,
          title: current.title,
          content: current.content,
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
          assignee: { select: { id: true, name: true, email: true } },
        },
      });
    });

    return document;
  }

  async retireDocument(id: string, editedById: string) {
    const current = await prisma.document.findUnique({ where: { id } });
    if (!current) {
      throw new Error("文書が見つかりません");
    }

    const document = await prisma.document.update({
      where: { id },
      data: { status: DocumentStatus.RETIRED },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        assignee: { select: { id: true, name: true, email: true } },
      },
    });

    await prisma.documentVersion.create({
      data: {
        documentId: id,
        version: current.currentVersion,
        title: current.title,
        content: current.content,
        changeNote: "廃止",
        editedById,
      },
    });

    return document;
  }
}

export const documentService = new DocumentService();
