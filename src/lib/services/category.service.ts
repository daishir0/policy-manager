import { z } from "zod";
import { prisma } from "@/lib/prisma";

export const createCategorySchema = z.object({
  name: z.string().min(1, "カテゴリ名を入力してください"),
  description: z.string().optional(),
  parentId: z.string().optional(),
  sortOrder: z.number().optional(),
});

export const updateCategorySchema = z.object({
  name: z.string().min(1, "カテゴリ名を入力してください").optional(),
  description: z.string().optional(),
  parentId: z.string().nullable().optional(),
  sortOrder: z.number().optional(),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;

export class CategoryService {
  async createCategory(input: CreateCategoryInput) {
    const validated = createCategorySchema.parse(input);

    return prisma.category.create({
      data: {
        name: validated.name,
        description: validated.description,
        parentId: validated.parentId,
        sortOrder: validated.sortOrder || 0,
      },
      include: {
        parent: true,
        children: true,
      },
    });
  }

  async updateCategory(id: string, input: UpdateCategoryInput) {
    const validated = updateCategorySchema.parse(input);

    // 循環参照チェック
    if (validated.parentId) {
      const wouldCreateCycle = await this.checkCycle(id, validated.parentId);
      if (wouldCreateCycle) {
        throw new Error("循環参照が発生します");
      }
    }

    return prisma.category.update({
      where: { id },
      data: {
        ...(validated.name && { name: validated.name }),
        ...(validated.description !== undefined && { description: validated.description }),
        ...(validated.parentId !== undefined && { parentId: validated.parentId }),
        ...(validated.sortOrder !== undefined && { sortOrder: validated.sortOrder }),
      },
      include: {
        parent: true,
        children: true,
      },
    });
  }

  async deleteCategory(id: string) {
    // 子カテゴリがある場合は削除不可
    const hasChildren = await prisma.category.findFirst({
      where: { parentId: id },
    });

    if (hasChildren) {
      throw new Error("子カテゴリが存在するため削除できません");
    }

    // 紐付いている文書があるか確認
    const hasDocuments = await prisma.documentCategory.findFirst({
      where: { categoryId: id },
    });

    if (hasDocuments) {
      throw new Error("文書が紐付いているため削除できません");
    }

    await prisma.category.delete({ where: { id } });
  }

  async getCategory(id: string) {
    const category = await prisma.category.findUnique({
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

    if (!category) {
      throw new Error("カテゴリが見つかりません");
    }

    return category;
  }

  async listCategories() {
    return prisma.category.findMany({
      include: {
        parent: true,
        children: { orderBy: { sortOrder: "asc" } },
        _count: { select: { documents: true } },
      },
      orderBy: { sortOrder: "asc" },
    });
  }

  async getCategoryTree() {
    const categories = await prisma.category.findMany({
      include: {
        _count: { select: { documents: true } },
      },
      orderBy: { sortOrder: "asc" },
    });

    // ツリー構造に変換
    const map = new Map<string, typeof categories[0] & { children: typeof categories }>();
    const roots: (typeof categories[0] & { children: typeof categories })[] = [];

    categories.forEach((category) => {
      map.set(category.id, { ...category, children: [] });
    });

    categories.forEach((category) => {
      const node = map.get(category.id)!;
      if (category.parentId && map.has(category.parentId)) {
        map.get(category.parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    });

    return roots;
  }

  private async checkCycle(categoryId: string, newParentId: string): Promise<boolean> {
    let currentId: string | null = newParentId;
    const visited = new Set<string>();

    while (currentId) {
      if (currentId === categoryId) {
        return true;
      }
      if (visited.has(currentId)) {
        return true;
      }
      visited.add(currentId);

      const found: { parentId: string | null } | null = await prisma.category.findUnique({
        where: { id: currentId },
        select: { parentId: true },
      });
      currentId = found?.parentId || null;
    }

    return false;
  }
}

export const categoryService = new CategoryService();
