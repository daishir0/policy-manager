import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { DocumentPermissionLevel } from "@prisma/client";

export const createDocumentPermissionSchema = z.object({
  documentId: z.string().uuid("文書IDが不正です"),
  userId: z.string(),
  permissionLevel: z.enum(["READ", "WRITE", "ADMIN"]).default("READ"),
});

export const updateDocumentPermissionSchema = z.object({
  permissionLevel: z.enum(["READ", "WRITE", "ADMIN"]),
});

export type CreateDocumentPermissionInput = z.infer<typeof createDocumentPermissionSchema>;
export type UpdateDocumentPermissionInput = z.infer<typeof updateDocumentPermissionSchema>;

export class DocumentPermissionService {
  async createPermission(input: CreateDocumentPermissionInput) {
    const validated = createDocumentPermissionSchema.parse(input);

    const [document, user] = await Promise.all([
      prisma.document.findUnique({ where: { id: validated.documentId } }),
      prisma.user.findUnique({ where: { id: validated.userId } }),
    ]);
    if (!document) throw new Error("文書が見つかりません");
    if (!user) throw new Error("ユーザーが見つかりません");

    const existing = await prisma.documentPermission.findUnique({
      where: {
        documentId_userId: {
          documentId: validated.documentId,
          userId: validated.userId,
        },
      },
    });
    if (existing) throw new Error("このユーザーへの権限は既に設定されています");

    return prisma.documentPermission.create({
      data: {
        documentId: validated.documentId,
        userId: validated.userId,
        permissionLevel: validated.permissionLevel as DocumentPermissionLevel,
      },
      include: {
        document: { select: { id: true, title: true } },
      },
    });
  }

  async updatePermission(id: string, input: UpdateDocumentPermissionInput) {
    const validated = updateDocumentPermissionSchema.parse(input);
    const existing = await prisma.documentPermission.findUnique({ where: { id } });
    if (!existing) throw new Error("権限設定が見つかりません");
    return prisma.documentPermission.update({
      where: { id },
      data: { permissionLevel: validated.permissionLevel as DocumentPermissionLevel },
      include: { document: { select: { id: true, title: true } } },
    });
  }

  async deletePermission(id: string): Promise<void> {
    const existing = await prisma.documentPermission.findUnique({ where: { id } });
    if (!existing) throw new Error("権限設定が見つかりません");
    await prisma.documentPermission.delete({ where: { id } });
  }

  async getPermission(id: string) {
    return prisma.documentPermission.findUnique({
      where: { id },
      include: { document: { select: { id: true, title: true } } },
    });
  }

  async listPermissionsByDocument(documentId: string) {
    return prisma.documentPermission.findMany({
      where: { documentId },
      orderBy: { createdAt: "desc" },
    });
  }

  async listPermissionsByUser(userId: string) {
    return prisma.documentPermission.findMany({
      where: { userId },
      include: { document: { select: { id: true, title: true, status: true } } },
      orderBy: { createdAt: "desc" },
    });
  }
}

export const documentPermissionService = new DocumentPermissionService();
