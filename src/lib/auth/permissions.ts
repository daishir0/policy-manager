import { auth } from "@/lib/auth";

// グローバルロール定義（authサービスで管理）
export const GLOBAL_ROLES = {
  SUPER_ADMIN: "super_admin",
  ADMIN: "admin",
  USER: "user",
} as const;

export type GlobalRole = (typeof GLOBAL_ROLES)[keyof typeof GLOBAL_ROLES];

// 権限定義（authサービスのグローバル権限名に対応）
export const PERMISSIONS = {
  // ユーザー管理（authサービスで管理）
  USER_CREATE: "user:create",
  USER_READ: "user:read",
  USER_UPDATE: "user:update",
  USER_DELETE: "user:delete",

  // 文書管理
  DOCUMENT_CREATE: "document:create",
  DOCUMENT_READ: "document:read",
  DOCUMENT_UPDATE: "document:update",
  DOCUMENT_DELETE: "document:delete",
  DOCUMENT_PUBLISH: "document:publish",
  DOCUMENT_ASSIGN: "document:assign",

  // AI機能
  AI_CONTRADICTION_CHECK: "ai:contradiction_check",
  AI_DRAFT_GENERATE: "ai:draft_generate",
  AI_QA: "ai:qa",

  // メッセージ
  MESSAGE_READ: "message:read",
  MESSAGE_CREATE: "message:create",

  // 分析
  ANALYTICS_VIEW: "analytics:view",

  // 監査
  AUDIT_VIEW: "audit:view",

  // 設定
  SETTINGS_VIEW: "settings:view",
  SETTINGS_UPDATE: "settings:update",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

// ロールごとのデフォルト権限マッピング
// 注: 実際の権限はauthサービスから取得したpermissions配列で判定
const ROLE_DEFAULT_PERMISSIONS: Record<GlobalRole, Permission[]> = {
  [GLOBAL_ROLES.SUPER_ADMIN]: Object.values(PERMISSIONS) as Permission[],
  [GLOBAL_ROLES.ADMIN]: Object.values(PERMISSIONS) as Permission[],
  [GLOBAL_ROLES.USER]: [
    PERMISSIONS.DOCUMENT_READ,
    PERMISSIONS.DOCUMENT_CREATE,
    PERMISSIONS.DOCUMENT_UPDATE,
    PERMISSIONS.AI_QA,
    PERMISSIONS.AI_DRAFT_GENERATE,
    PERMISSIONS.AI_CONTRADICTION_CHECK,
    PERMISSIONS.MESSAGE_READ,
  ],
};

// 旧ロール名から新ロール名へのマッピング（後方互換性用）
const LEGACY_ROLE_MAP: Record<string, GlobalRole> = {
  ADMIN: GLOBAL_ROLES.SUPER_ADMIN,
  STAFF: GLOBAL_ROLES.USER,
};

/**
 * ロール名を正規化（旧ロール名にも対応）
 */
function normalizeRole(role: string): GlobalRole {
  // 新ロール名の場合はそのまま返す
  if (Object.values(GLOBAL_ROLES).includes(role as GlobalRole)) {
    return role as GlobalRole;
  }
  // 旧ロール名の場合はマッピング
  return LEGACY_ROLE_MAP[role] || GLOBAL_ROLES.USER;
}

/**
 * 権限チェック（authサービスからの権限配列を使用）
 * @param userRoles ユーザーのロール配列
 * @param userPermissions ユーザーの権限配列（authサービスから取得）
 * @param requiredPermission 必要な権限
 */
export function hasPermission(
  userRoles: string[],
  userPermissions: string[],
  requiredPermission: Permission
): boolean {
  // authサービスから取得した権限に含まれているかチェック
  if (userPermissions.includes(requiredPermission)) {
    return true;
  }

  // 権限配列にない場合、ロールからデフォルト権限を判定
  for (const role of userRoles) {
    const normalizedRole = normalizeRole(role);
    const rolePermissions = ROLE_DEFAULT_PERMISSIONS[normalizedRole];
    if (rolePermissions?.includes(requiredPermission)) {
      return true;
    }
  }

  return false;
}

/**
 * 複数権限のいずれかを持っているかチェック
 */
export function hasAnyPermission(
  userRoles: string[],
  userPermissions: string[],
  permissions: Permission[]
): boolean {
  return permissions.some((permission) =>
    hasPermission(userRoles, userPermissions, permission)
  );
}

/**
 * 複数権限の全てを持っているかチェック
 */
export function hasAllPermissions(
  userRoles: string[],
  userPermissions: string[],
  permissions: Permission[]
): boolean {
  return permissions.every((permission) =>
    hasPermission(userRoles, userPermissions, permission)
  );
}

/**
 * 管理者かどうかをチェック（super_admin または admin ロール）
 */
export function isAdmin(userRoles: string[]): boolean {
  return userRoles.some((role) => {
    const normalized = normalizeRole(role);
    return (
      normalized === GLOBAL_ROLES.SUPER_ADMIN ||
      normalized === GLOBAL_ROLES.ADMIN
    );
  });
}

/**
 * スーパー管理者かどうかをチェック
 */
export function isSuperAdmin(userRoles: string[]): boolean {
  return userRoles.some((role) => {
    const normalized = normalizeRole(role);
    return normalized === GLOBAL_ROLES.SUPER_ADMIN;
  });
}

/**
 * Server Actionで使用する権限チェック
 */
export async function checkPermission(permission: Permission): Promise<boolean> {
  const session = await auth();
  if (!session?.user) {
    return false;
  }
  const roles = session.user.roles || [];
  const permissions = session.user.permissions || [];
  return hasPermission(roles, permissions, permission);
}

/**
 * Server Actionで使用する管理者チェック
 */
export async function checkIsAdmin(): Promise<boolean> {
  const session = await auth();
  if (!session?.user) {
    return false;
  }
  return isAdmin(session.user.roles || []);
}

/**
 * 権限がなければエラーをスローするガード関数
 */
export async function requirePermission(permission: Permission): Promise<void> {
  const hasAccess = await checkPermission(permission);
  if (!hasAccess) {
    throw new Error("権限がありません");
  }
}

/**
 * 管理者でなければエラーをスローするガード関数
 */
export async function requireAdmin(): Promise<void> {
  const isAdminUser = await checkIsAdmin();
  if (!isAdminUser) {
    throw new Error("管理者権限が必要です");
  }
}
