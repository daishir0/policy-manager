import { prisma } from "@/lib/prisma";

/**
 * サービス固有権限のカテゴリ
 */
export const PERMISSION_CATEGORIES = {
  DOCUMENT: "document",
  QA: "qa",
  ADMIN: "admin",
} as const;

/**
 * 定義済みサービス固有権限
 */
export const SERVICE_PERMISSIONS = {
  // 文書関連
  DOCUMENT_READ: {
    name: "document:read",
    displayName: "文書閲覧",
    category: PERMISSION_CATEGORIES.DOCUMENT,
    description: "公開文書を閲覧する権限",
  },
  DOCUMENT_CREATE: {
    name: "document:create",
    displayName: "文書作成",
    category: PERMISSION_CATEGORIES.DOCUMENT,
    description: "新規文書を作成する権限",
  },
  DOCUMENT_UPDATE: {
    name: "document:update",
    displayName: "文書編集",
    category: PERMISSION_CATEGORIES.DOCUMENT,
    description: "文書を編集する権限",
  },
  DOCUMENT_DELETE: {
    name: "document:delete",
    displayName: "文書削除",
    category: PERMISSION_CATEGORIES.DOCUMENT,
    description: "文書を削除する権限",
  },
  DOCUMENT_PUBLISH: {
    name: "document:publish",
    displayName: "文書公開・廃止",
    category: PERMISSION_CATEGORIES.DOCUMENT,
    description: "文書を公開または廃止する権限",
  },

  // Q&A関連
  QA_USE: {
    name: "qa:use",
    displayName: "Q&A利用",
    category: PERMISSION_CATEGORIES.QA,
    description: "Q&A機能を利用する権限",
  },

  // 管理者機能
  ADMIN_USER_MANAGE: {
    name: "admin:user-manage",
    displayName: "ユーザー管理",
    category: PERMISSION_CATEGORIES.ADMIN,
    description: "サービス固有のユーザー権限を管理する権限",
  },
  ADMIN_SETTINGS: {
    name: "admin:settings",
    displayName: "設定管理",
    category: PERMISSION_CATEGORIES.ADMIN,
    description: "システム設定を管理する権限",
  },
} as const;

export class ServicePermissionService {
  /**
   * 全サービス権限を取得
   */
  async listPermissions() {
    return prisma.servicePermission.findMany({
      where: { isActive: true },
      orderBy: [{ category: "asc" }, { displayName: "asc" }],
    });
  }

  /**
   * カテゴリ別にサービス権限を取得
   */
  async listPermissionsByCategory(category: string) {
    return prisma.servicePermission.findMany({
      where: { category, isActive: true },
      orderBy: { displayName: "asc" },
    });
  }

  /**
   * ユーザーのサービス固有権限を取得
   */
  async getUserPermissions(userId: string) {
    const userPermissions = await prisma.userServicePermission.findMany({
      where: { userId },
      include: { permission: true },
    });

    return userPermissions.map((up) => ({
      id: up.permission.id,
      name: up.permission.name,
      displayName: up.permission.displayName,
      category: up.permission.category,
      grantedAt: up.grantedAt,
      grantedBy: up.grantedBy,
    }));
  }

  /**
   * ユーザーが特定のサービス権限を持っているか確認
   */
  async hasPermission(userId: string, permissionName: string): Promise<boolean> {
    const permission = await prisma.servicePermission.findUnique({
      where: { name: permissionName },
    });

    if (!permission) return false;

    const userPermission = await prisma.userServicePermission.findUnique({
      where: {
        userId_permissionId: {
          userId,
          permissionId: permission.id,
        },
      },
    });

    return !!userPermission;
  }

  /**
   * ユーザーにサービス権限を付与
   */
  async grantPermission(
    userId: string,
    permissionName: string,
    grantedBy: string
  ) {
    const permission = await prisma.servicePermission.findUnique({
      where: { name: permissionName },
    });

    if (!permission) {
      throw new Error(`Permission not found: ${permissionName}`);
    }

    return prisma.userServicePermission.upsert({
      where: {
        userId_permissionId: {
          userId,
          permissionId: permission.id,
        },
      },
      create: {
        userId,
        permissionId: permission.id,
        grantedBy,
      },
      update: {
        grantedAt: new Date(),
        grantedBy,
      },
      include: { permission: true },
    });
  }

  /**
   * ユーザーからサービス権限を削除
   */
  async revokePermission(userId: string, permissionName: string) {
    const permission = await prisma.servicePermission.findUnique({
      where: { name: permissionName },
    });

    if (!permission) {
      throw new Error(`Permission not found: ${permissionName}`);
    }

    return prisma.userServicePermission.delete({
      where: {
        userId_permissionId: {
          userId,
          permissionId: permission.id,
        },
      },
    });
  }

  /**
   * ユーザーに複数のサービス権限を一括付与
   */
  async grantMultiplePermissions(
    userId: string,
    permissionNames: string[],
    grantedBy: string
  ) {
    const results = [];

    for (const name of permissionNames) {
      try {
        const result = await this.grantPermission(userId, name, grantedBy);
        results.push({ name, success: true, result });
      } catch (error) {
        results.push({
          name,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return results;
  }

  /**
   * サービス権限のシード（初期データ作成）
   */
  async seedPermissions() {
    const permissions = Object.values(SERVICE_PERMISSIONS);
    const results = [];

    for (const perm of permissions) {
      const result = await prisma.servicePermission.upsert({
        where: { name: perm.name },
        create: {
          name: perm.name,
          displayName: perm.displayName,
          category: perm.category,
          description: perm.description,
        },
        update: {
          displayName: perm.displayName,
          category: perm.category,
          description: perm.description,
        },
      });
      results.push(result);
    }

    return results;
  }
}

export const servicePermissionService = new ServicePermissionService();
