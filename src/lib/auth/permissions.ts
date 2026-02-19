import { auth } from "@/lib/auth";

// ロール定義
export const ROLES = {
  ADMIN: "ADMIN",
  STAFF: "STAFF",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

// 権限定義
export const PERMISSIONS = {
  // ユーザー管理
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
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

// ロールごとの権限マッピング
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  [ROLES.ADMIN]: Object.values(PERMISSIONS) as Permission[], // 全権限
  [ROLES.STAFF]: [
    PERMISSIONS.DOCUMENT_READ,
    PERMISSIONS.DOCUMENT_CREATE,
    PERMISSIONS.DOCUMENT_UPDATE,
    PERMISSIONS.AI_QA,
    PERMISSIONS.AI_DRAFT_GENERATE,
    PERMISSIONS.AI_CONTRADICTION_CHECK,
    PERMISSIONS.MESSAGE_READ,
  ],
};

// 権限チェック関数
export function hasPermission(role: Role, permission: Permission): boolean {
  const permissions = ROLE_PERMISSIONS[role];
  return permissions?.includes(permission) ?? false;
}

// 複数権限のいずれかを持っているかチェック
export function hasAnyPermission(role: Role, permissions: Permission[]): boolean {
  return permissions.some((permission) => hasPermission(role, permission));
}

// 複数権限の全てを持っているかチェック
export function hasAllPermissions(role: Role, permissions: Permission[]): boolean {
  return permissions.every((permission) => hasPermission(role, permission));
}

// ロールがADMINかチェック
export function isAdmin(role: Role): boolean {
  return role === ROLES.ADMIN;
}

// Server Actionで使用する権限チェック
export async function checkPermission(permission: Permission): Promise<boolean> {
  const session = await auth();
  if (!session?.user?.role) {
    return false;
  }
  return hasPermission(session.user.role as Role, permission);
}

// 権限がなければエラーをスローするガード関数
export async function requirePermission(permission: Permission): Promise<void> {
  const hasAccess = await checkPermission(permission);
  if (!hasAccess) {
    throw new Error("権限がありません");
  }
}
