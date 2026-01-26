import { z } from "zod";
import { prisma } from "@/lib/prisma";

export const createOrganizationSchema = z.object({
  name: z.string().min(1, "組織名を入力してください"),
  code: z.string().min(1, "組織コードを入力してください"),
  parentId: z.string().optional(),
  sortOrder: z.number().optional(),
});

export const updateOrganizationSchema = z.object({
  name: z.string().min(1, "組織名を入力してください").optional(),
  code: z.string().min(1, "組織コードを入力してください").optional(),
  parentId: z.string().nullable().optional(),
  sortOrder: z.number().optional(),
});

export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;
export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;

export class OrganizationService {
  async createOrganization(input: CreateOrganizationInput) {
    const validated = createOrganizationSchema.parse(input);

    // コード重複チェック
    const existing = await prisma.organization.findUnique({
      where: { code: validated.code },
    });
    if (existing) {
      throw new Error("この組織コードは既に使用されています");
    }

    return prisma.organization.create({
      data: {
        name: validated.name,
        code: validated.code,
        parentId: validated.parentId,
        sortOrder: validated.sortOrder || 0,
      },
      include: {
        parent: true,
        children: true,
      },
    });
  }

  async updateOrganization(id: string, input: UpdateOrganizationInput) {
    const validated = updateOrganizationSchema.parse(input);

    // コード重複チェック（自分以外）
    if (validated.code) {
      const existing = await prisma.organization.findFirst({
        where: {
          code: validated.code,
          NOT: { id },
        },
      });
      if (existing) {
        throw new Error("この組織コードは既に使用されています");
      }
    }

    // 循環参照チェック
    if (validated.parentId) {
      const wouldCreateCycle = await this.checkCycle(id, validated.parentId);
      if (wouldCreateCycle) {
        throw new Error("循環参照が発生します");
      }
    }

    return prisma.organization.update({
      where: { id },
      data: {
        ...(validated.name && { name: validated.name }),
        ...(validated.code && { code: validated.code }),
        ...(validated.parentId !== undefined && { parentId: validated.parentId }),
        ...(validated.sortOrder !== undefined && { sortOrder: validated.sortOrder }),
      },
      include: {
        parent: true,
        children: true,
      },
    });
  }

  async deleteOrganization(id: string) {
    // 子組織がある場合は削除不可
    const hasChildren = await prisma.organization.findFirst({
      where: { parentId: id },
    });

    if (hasChildren) {
      throw new Error("子組織が存在するため削除できません");
    }

    // 紐付いている文書があるか確認
    const hasDocuments = await prisma.documentOrganization.findFirst({
      where: { organizationId: id },
    });

    if (hasDocuments) {
      throw new Error("文書が紐付いているため削除できません");
    }

    await prisma.organization.delete({ where: { id } });
  }

  async getOrganization(id: string) {
    const organization = await prisma.organization.findUnique({
      where: { id },
      include: {
        parent: true,
        children: { orderBy: { sortOrder: "asc" } },
        documents: {
          include: {
            document: { select: { id: true, title: true, status: true } },
          },
        },
      },
    });

    if (!organization) {
      throw new Error("組織が見つかりません");
    }

    return organization;
  }

  async listOrganizations() {
    return prisma.organization.findMany({
      include: {
        parent: true,
        children: { orderBy: { sortOrder: "asc" } },
        _count: { select: { documents: true } },
      },
      orderBy: { sortOrder: "asc" },
    });
  }

  async getOrganizationTree() {
    const organizations = await prisma.organization.findMany({
      include: {
        _count: { select: { documents: true } },
      },
      orderBy: { sortOrder: "asc" },
    });

    // ツリー構造に変換
    const map = new Map<string, typeof organizations[0] & { children: typeof organizations }>();
    const roots: (typeof organizations[0] & { children: typeof organizations })[] = [];

    organizations.forEach((org) => {
      map.set(org.id, { ...org, children: [] });
    });

    organizations.forEach((org) => {
      const node = map.get(org.id)!;
      if (org.parentId && map.has(org.parentId)) {
        map.get(org.parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    });

    return roots;
  }

  private async checkCycle(organizationId: string, newParentId: string): Promise<boolean> {
    let currentId: string | null = newParentId;
    const visited = new Set<string>();

    while (currentId) {
      if (currentId === organizationId) {
        return true;
      }
      if (visited.has(currentId)) {
        return true;
      }
      visited.add(currentId);

      const found: { parentId: string | null } | null = await prisma.organization.findUnique({
        where: { id: currentId },
        select: { parentId: true },
      });
      currentId = found?.parentId || null;
    }

    return false;
  }
}

export const organizationService = new OrganizationService();
