"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, Check, X, Users } from "lucide-react";

interface Role {
  id: string;
  name: string;
  description: string | null;
}

const PERMISSION_GROUPS = [
  {
    name: "文書管理",
    permissions: [
      { key: "DOCUMENT_CREATE", label: "文書作成" },
      { key: "DOCUMENT_READ", label: "文書閲覧" },
      { key: "DOCUMENT_UPDATE", label: "文書編集" },
      { key: "DOCUMENT_DELETE", label: "文書削除" },
      { key: "DOCUMENT_PUBLISH", label: "文書公開" },
    ],
  },
  {
    name: "AI機能",
    permissions: [
      { key: "AI_QA", label: "Q&A利用" },
      { key: "AI_DRAFT_GENERATE", label: "文案生成" },
      { key: "AI_CONTRADICTION_CHECK", label: "矛盾チェック" },
    ],
  },
  {
    name: "管理機能",
    permissions: [
      { key: "USER_READ", label: "ユーザー閲覧" },
      { key: "USER_CREATE", label: "ユーザー作成" },
      { key: "USER_UPDATE", label: "ユーザー編集" },
      { key: "USER_DELETE", label: "ユーザー削除" },
      { key: "ANALYTICS_VIEW", label: "統計閲覧" },
      { key: "PROPOSAL_MANAGE", label: "提案管理" },
    ],
  },
];

const ROLE_PERMISSIONS: Record<string, string[]> = {
  ADMIN: [
    "DOCUMENT_CREATE", "DOCUMENT_READ", "DOCUMENT_UPDATE", "DOCUMENT_DELETE", "DOCUMENT_PUBLISH",
    "AI_QA", "AI_DRAFT_GENERATE", "AI_CONTRADICTION_CHECK",
    "USER_READ", "USER_CREATE", "USER_UPDATE", "USER_DELETE", "ANALYTICS_VIEW", "PROPOSAL_MANAGE",
  ],
  DOCUMENT_ADMIN: [
    "DOCUMENT_CREATE", "DOCUMENT_READ", "DOCUMENT_UPDATE", "DOCUMENT_DELETE", "DOCUMENT_PUBLISH",
    "AI_QA", "AI_DRAFT_GENERATE", "AI_CONTRADICTION_CHECK",
    "ANALYTICS_VIEW", "PROPOSAL_MANAGE",
  ],
  EMPLOYEE: [
    "DOCUMENT_READ",
    "AI_QA",
  ],
};

export default function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRoles = async () => {
      try {
        const response = await fetch("/api/roles");
        if (!response.ok) {
          throw new Error("ロール一覧の取得に失敗しました");
        }
        const data = await response.json();
        setRoles(data.roles || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "エラーが発生しました");
      } finally {
        setLoading(false);
      }
    };

    fetchRoles();
  }, []);

  const hasPermission = (roleName: string, permissionKey: string) => {
    const permissions = ROLE_PERMISSIONS[roleName];
    return permissions?.includes(permissionKey) || false;
  };

  const getRoleLabel = (name: string) => {
    switch (name) {
      case "ADMIN": return "システム管理者";
      case "DOCUMENT_ADMIN": return "文書管理者";
      case "EMPLOYEE": return "一般従業員";
      default: return name;
    }
  };

  const getRoleBadgeVariant = (name: string) => {
    switch (name) {
      case "ADMIN": return "destructive";
      case "DOCUMENT_ADMIN": return "default";
      default: return "secondary";
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">権限設定</h1>
        <p className="text-muted-foreground">
          ロールごとの権限設定を確認できます
        </p>
      </div>

      {/* ロール一覧 */}
      <div className="grid gap-4 md:grid-cols-3">
        {loading ? (
          <Card className="md:col-span-3">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">読み込み中...</p>
            </CardContent>
          </Card>
        ) : error ? (
          <Card className="md:col-span-3">
            <CardContent className="pt-6">
              <p className="text-sm text-destructive">{error}</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {["ADMIN", "DOCUMENT_ADMIN", "EMPLOYEE"].map((roleName) => (
              <Card key={roleName}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Shield className="h-5 w-5" />
                      {getRoleLabel(roleName)}
                    </CardTitle>
                    <Badge variant={getRoleBadgeVariant(roleName)}>{roleName}</Badge>
                  </div>
                  <CardDescription>
                    {roleName === "ADMIN" && "すべての機能にアクセス可能"}
                    {roleName === "DOCUMENT_ADMIN" && "文書管理とAI機能を利用可能"}
                    {roleName === "EMPLOYEE" && "文書閲覧とQ&Aを利用可能"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {PERMISSION_GROUPS.map((group) => (
                      <div key={group.name}>
                        <h4 className="text-sm font-medium mb-2">{group.name}</h4>
                        <div className="space-y-1">
                          {group.permissions.map((perm) => (
                            <div key={perm.key} className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">{perm.label}</span>
                              {hasPermission(roleName, perm.key) ? (
                                <Check className="h-4 w-4 text-green-500" />
                              ) : (
                                <X className="h-4 w-4 text-muted-foreground/50" />
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </>
        )}
      </div>

      {/* 権限マトリックス */}
      <Card>
        <CardHeader>
          <CardTitle>権限マトリックス</CardTitle>
          <CardDescription>
            各ロールの権限を一覧で確認できます
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 pr-4">権限</th>
                  <th className="text-center py-2 px-4">
                    <Badge variant="destructive">管理者</Badge>
                  </th>
                  <th className="text-center py-2 px-4">
                    <Badge variant="default">文書管理者</Badge>
                  </th>
                  <th className="text-center py-2 px-4">
                    <Badge variant="secondary">従業員</Badge>
                  </th>
                </tr>
              </thead>
              <tbody>
                {PERMISSION_GROUPS.map((group) => (
                  <>
                    <tr key={group.name} className="bg-muted/50">
                      <td colSpan={4} className="py-2 px-2 font-medium">
                        {group.name}
                      </td>
                    </tr>
                    {group.permissions.map((perm) => (
                      <tr key={perm.key} className="border-b">
                        <td className="py-2 pr-4 text-muted-foreground">{perm.label}</td>
                        <td className="text-center py-2 px-4">
                          {hasPermission("ADMIN", perm.key) ? (
                            <Check className="h-4 w-4 text-green-500 mx-auto" />
                          ) : (
                            <X className="h-4 w-4 text-muted-foreground/50 mx-auto" />
                          )}
                        </td>
                        <td className="text-center py-2 px-4">
                          {hasPermission("DOCUMENT_ADMIN", perm.key) ? (
                            <Check className="h-4 w-4 text-green-500 mx-auto" />
                          ) : (
                            <X className="h-4 w-4 text-muted-foreground/50 mx-auto" />
                          )}
                        </td>
                        <td className="text-center py-2 px-4">
                          {hasPermission("EMPLOYEE", perm.key) ? (
                            <Check className="h-4 w-4 text-green-500 mx-auto" />
                          ) : (
                            <X className="h-4 w-4 text-muted-foreground/50 mx-auto" />
                          )}
                        </td>
                      </tr>
                    ))}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
