import { z } from "zod";
import { prisma } from "@/lib/prisma";

// バリデーションスキーマ（ローカルDB更新用）
export const updateUserSchema = z.object({
  name: z.string().min(1, "名前を入力してください").optional(),
  image: z.string().url("有効なURLを入力してください").optional().nullable(),
});

export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export interface UserFilter {
  search?: string;
  roles?: string[];  // authRoles配列でフィルタ
  page?: number;
  limit?: number;
}

/**
 * ユーザーサービス
 *
 * 注: ユーザーの作成・削除・ロール管理は認証サービスで行う
 * このサービスはローカルDBにキャッシュされたユーザー情報の参照と、
 * 文書への割り当て等のために使用する
 */
export class UserService {
  /**
   * ユーザー情報を取得（ローカルDBから）
   */
  async getUser(id: string) {
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        assignedDocs: {
          where: { deletedAt: null },
          select: { id: true, title: true, status: true },
        },
        servicePermissions: {
          include: {
            permission: true,
          },
        },
      },
    });

    if (!user) {
      throw new Error("ユーザーが見つかりません");
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      image: user.image,
      authRoles: user.authRoles,
      syncedAt: user.syncedAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      assignedDocuments: user.assignedDocs,
      servicePermissions: user.servicePermissions.map((sp) => ({
        id: sp.permission.id,
        name: sp.permission.name,
        displayName: sp.permission.displayName,
        category: sp.permission.category,
        grantedAt: sp.grantedAt,
        grantedBy: sp.grantedBy,
      })),
    };
  }

  /**
   * ユーザー一覧を取得（ローカルDBから）
   */
  async listUsers(filter: UserFilter = {}) {
    const { search, roles, page = 1, limit = 20 } = filter;
    const skip = (page - 1) * limit;

    const where = {
      ...(search && {
        OR: [
          { email: { contains: search, mode: "insensitive" as const } },
          { name: { contains: search, mode: "insensitive" as const } },
        ],
      }),
      // authRoles配列に指定されたロールのいずれかが含まれるかチェック
      ...(roles && roles.length > 0 && {
        authRoles: { hasSome: roles },
      }),
    };

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { syncedAt: "desc" },
        include: {
          assignedDocs: {
            where: { deletedAt: null },
            select: { id: true, title: true, status: true },
          },
        },
      }),
      prisma.user.count({ where }),
    ]);

    return {
      users: users.map((user) => ({
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
        authRoles: user.authRoles,
        syncedAt: user.syncedAt,
        createdAt: user.createdAt,
        assignedDocs: user.assignedDocs,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * ユーザーのローカル情報を更新
   * 注: name, image のみ更新可能（ロール等はauth側で管理）
   */
  async updateUser(id: string, input: UpdateUserInput) {
    const validated = updateUserSchema.parse(input);

    const user = await prisma.user.update({
      where: { id },
      data: {
        ...(validated.name !== undefined && { name: validated.name }),
        ...(validated.image !== undefined && { image: validated.image }),
      },
    });

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      image: user.image,
      authRoles: user.authRoles,
      updatedAt: user.updatedAt,
    };
  }

  /**
   * 文書への担当者割り当て用にユーザーを検索
   */
  async searchUsersForAssignment(query: string, limit = 10) {
    const users = await prisma.user.findMany({
      where: {
        OR: [
          { email: { contains: query, mode: "insensitive" } },
          { name: { contains: query, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
      },
      take: limit,
    });

    return users;
  }

  /**
   * ユーザーが存在するか確認（作成されていなければ作成）
   * OAuth ログイン時に呼ばれることを想定
   */
  async ensureUser(userData: {
    id: string;
    email: string;
    name?: string | null;
    image?: string | null;
    authRoles?: string[];
  }) {
    return prisma.user.upsert({
      where: { id: userData.id },
      create: {
        id: userData.id,
        email: userData.email,
        name: userData.name,
        image: userData.image,
        authRoles: userData.authRoles || [],
        syncedAt: new Date(),
      },
      update: {
        email: userData.email,
        name: userData.name || undefined,
        image: userData.image || undefined,
        authRoles: userData.authRoles || undefined,
        syncedAt: new Date(),
      },
    });
  }
}

export const userService = new UserService();
