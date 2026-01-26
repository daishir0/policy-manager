import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { DocumentPermissionLevel } from "@prisma/client";

export const createDocumentPermissionSchema = z.object({
  documentId: z.string().uuid("文書IDが不正です"),
  userId: z.string().optional(),
  organizationId: z.string().optional(),
  permissionLevel: z.enum(["READ", "WRITE", "ADMIN"]).default("READ"),
}).refine(
  (data) => data.userId || data.organizationId,
  "ユーザーIDまたは組織IDのいずれかを指定してください"
).refine(
  (data) => !(data.userId && data.organizationId),
  "ユーザーIDと組織IDは同時に指定できません"
);

export const updateDocumentPermissionSchema = z.object({
  permissionLevel: z.enum(["READ", "WRITE", "ADMIN"]),
});

export type CreateDocumentPermissionInput = z.infer<typeof createDocumentPermissionSchema>;
export type UpdateDocumentPermissionInput = z.infer<typeof updateDocumentPermissionSchema>;

export class DocumentPermissionService {
  async createPermission(input: CreateDocumentPermissionInput) {
    const validated = createDocumentPermissionSchema.parse(input);

    // 文書の存在確認
    const document = await prisma.document.findUnique({
      where: { id: validated.documentId },
    });
    if (!document) {
      throw new Error("文書が見つかりません");
    }

    // ユーザーまたは組織の存在確認
    if (validated.userId) {
      const user = await prisma.user.findUnique({
        where: { id: validated.userId },
      });
      if (!user) {
        throw new Error("ユーザーが見つかりません");
      }

      // 重複チェック
      const existing = await prisma.documentPermission.findUnique({
        where: {
          documentId_userId: {
            documentId: validated.documentId,
            userId: validated.userId,
          },
        },
      });
      if (existing) {
        throw new Error("このユーザーへの権限は既に設定されています");
      }
    }

    if (validated.organizationId) {
      const org = await prisma.organization.findUnique({
        where: { id: validated.organizationId },
      });
      if (!org) {
        throw new Error("組織が見つかりません");
      }

      // 重複チェック
      const existing = await prisma.documentPermission.findUnique({
        where: {
          documentId_organizationId: {
            documentId: validated.documentId,
            organizationId: validated.organizationId,
          },
        },
      });
      if (existing) {
        throw new Error("この組織への権限は既に設定されています");
      }
    }

    return prisma.documentPermission.create({
      data: {
        documentId: validated.documentId,
        userId: validated.userId,
        organizationId: validated.organizationId,
        permissionLevel: validated.permissionLevel as DocumentPermissionLevel,
      },
      include: {
        document: { select: { id: true, title: true } },
      },
    });
  }

  async updatePermission(id: string, input: UpdateDocumentPermissionInput) {
    const validated = updateDocumentPermissionSchema.parse(input);

    const existing = await prisma.documentPermission.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new Error("権限設定が見つかりません");
    }

    return prisma.documentPermission.update({
      where: { id },
      data: {
        permissionLevel: validated.permissionLevel as DocumentPermissionLevel,
      },
      include: {
        document: { select: { id: true, title: true } },
      },
    });
  }

  async deletePermission(id: string): Promise<void> {
    const existing = await prisma.documentPermission.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new Error("権限設定が見つかりません");
    }

    await prisma.documentPermission.delete({ where: { id } });
  }

  async getPermission(id: string) {
    return prisma.documentPermission.findUnique({
      where: { id },
      include: {
        document: { select: { id: true, title: true } },
      },
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
      include: {
        document: { select: { id: true, title: true, status: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async listPermissionsByOrganization(organizationId: string) {
    return prisma.documentPermission.findMany({
      where: { organizationId },
      include: {
        document: { select: { id: true, title: true, status: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  // ユーザーが文書に対して持つ権限をチェック
  async checkUserPermission(
    userId: string,
    documentId: string
  ): Promise<{
    hasPermission: boolean;
    permissionLevel: DocumentPermissionLevel | null;
    source: "user" | "organization" | "none";
  }> {
    // 直接のユーザー権限をチェック
    const userPermission = await prisma.documentPermission.findUnique({
      where: {
        documentId_userId: {
          documentId,
          userId,
        },
      },
    });

    if (userPermission) {
      return {
        hasPermission: true,
        permissionLevel: userPermission.permissionLevel,
        source: "user",
      };
    }

    // 組織経由の権限をチェック（組織階層を考慮）
    const orgPermission = await this.checkOrganizationPermission(userId, documentId);
    if (orgPermission) {
      return {
        hasPermission: true,
        permissionLevel: orgPermission,
        source: "organization",
      };
    }

    return {
      hasPermission: false,
      permissionLevel: null,
      source: "none",
    };
  }

  // 組織経由の権限をチェック（階層を考慮）
  private async checkOrganizationPermission(
    userId: string,
    documentId: string
  ): Promise<DocumentPermissionLevel | null> {
    // ユーザーが所属する組織を取得（※将来の拡張のため）
    // 現在は文書に紐付いている組織と文書の権限を照合

    const documentOrgs = await prisma.documentOrganization.findMany({
      where: { documentId },
      select: { organizationId: true },
    });

    if (documentOrgs.length === 0) {
      return null;
    }

    const orgIds = documentOrgs.map((d) => d.organizationId);

    // 階層を考慮して権限をチェック
    const permissions = await prisma.documentPermission.findMany({
      where: {
        documentId,
        organizationId: { in: orgIds },
      },
      orderBy: { permissionLevel: "desc" }, // 最も高い権限を取得
    });

    if (permissions.length > 0) {
      // 最も高い権限レベルを返す
      return this.getHighestPermissionLevel(
        permissions.map((p) => p.permissionLevel)
      );
    }

    return null;
  }

  private getHighestPermissionLevel(
    levels: DocumentPermissionLevel[]
  ): DocumentPermissionLevel {
    const order: DocumentPermissionLevel[] = ["ADMIN", "WRITE", "READ"];
    for (const level of order) {
      if (levels.includes(level)) {
        return level;
      }
    }
    return "READ";
  }

  // 文書への特定権限があるかチェック
  async hasPermissionLevel(
    userId: string,
    documentId: string,
    requiredLevel: DocumentPermissionLevel
  ): Promise<boolean> {
    const result = await this.checkUserPermission(userId, documentId);

    if (!result.hasPermission) {
      return false;
    }

    const levelOrder: Record<DocumentPermissionLevel, number> = {
      READ: 1,
      WRITE: 2,
      ADMIN: 3,
    };

    return (
      levelOrder[result.permissionLevel!] >= levelOrder[requiredLevel]
    );
  }
}

export const documentPermissionService = new DocumentPermissionService();
