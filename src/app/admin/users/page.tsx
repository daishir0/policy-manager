"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Users, Search, Mail, Edit, FileText, RefreshCw, ExternalLink } from "lucide-react";
import { toast } from "sonner";

interface AssignedDoc {
  id: string;
  title: string;
  status: string;
}

interface User {
  id: string;
  email: string;
  name: string | null;
  authRoles: string[];
  createdAt: string;
  assignedDocs?: AssignedDoc[];
}

interface UsersResponse {
  users: User[];
  total: number;
  page: number;
  totalPages: number;
}

interface DocOption {
  id: string;
  title: string;
  assigneeId: string | null;
}

// 管理者ロールを判定
const isAdminUser = (roles: string[]): boolean => {
  return roles.some((role) => ["super_admin", "admin", "ADMIN"].includes(role));
};

// 認証サービスのベースURL（環境変数から取得）
// authサービスは (admin) Route Groupを使用しているため、URLは /users になる
const authAdminUrl = process.env.NEXT_PUBLIC_AUTH_BASE_URL
  ? `${process.env.NEXT_PUBLIC_AUTH_BASE_URL}/users`
  : null;

export default function UsersPage() {
  const [data, setData] = useState<UsersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({ name: "" });
  const [updating, setUpdating] = useState(false);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [assigningUser, setAssigningUser] = useState<User | null>(null);
  const [allDocs, setAllDocs] = useState<DocOption[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);

  const fetchUsers = useCallback(async (search?: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      const response = await fetch(`/api/users?${params.toString()}`);
      if (!response.ok) throw new Error("ユーザー一覧の取得に失敗しました");
      const result = await response.json();
      setData(result);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleSearch = () => fetchUsers(searchQuery);

  const handleOpenEditDialog = (user: User) => {
    setEditingUser(user);
    setEditForm({ name: user.name || "" });
    setIsEditDialogOpen(true);
  };

  const handleEditUser = async () => {
    if (!editingUser) return;
    setUpdating(true);
    try {
      const response = await fetch(`/api/users/${editingUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      if (!response.ok) {
        const d = await response.json();
        throw new Error(d.error || "ユーザーの更新に失敗しました");
      }
      setIsEditDialogOpen(false);
      setEditingUser(null);
      toast.success("ユーザーを更新しました");
      fetchUsers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setUpdating(false);
    }
  };

  const handleOpenAssignDialog = async (user: User) => {
    setAssigningUser(user);
    setIsAssignDialogOpen(true);
    setDocsLoading(true);
    try {
      const res = await fetch("/api/documents?limit=100");
      const d = await res.json();
      setAllDocs((d.documents || []).map((doc: { id: string; title: string; assigneeId: string | null }) => ({
        id: doc.id,
        title: doc.title,
        assigneeId: doc.assigneeId,
      })));
    } catch {
      toast.error("文書一覧の取得に失敗しました");
    } finally {
      setDocsLoading(false);
    }
  };

  const handleChangeAssignee = async (docId: string, newAssigneeId: string) => {
    try {
      const res = await fetch(`/api/documents/${docId}/assignee`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assigneeId: newAssigneeId }),
      });
      if (!res.ok) throw new Error("担当者の変更に失敗しました");
      toast.success("担当者を変更しました");
      // ローカル更新
      setAllDocs((prev) => prev.map((d) => d.id === docId ? { ...d, assigneeId: newAssigneeId } : d));
      fetchUsers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "エラーが発生しました");
    }
  };

  const getRoleBadge = (roles: string[]) => {
    if (isAdminUser(roles)) {
      return <Badge variant="destructive">管理者</Badge>;
    }
    return <Badge variant="secondary">スタッフ</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">ユーザー管理</h1>
          <p className="text-muted-foreground">システムユーザーの担当者割り当てを行います</p>
        </div>
        {authAdminUrl && (
          <Button asChild variant="outline">
            <a href={authAdminUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="mr-2 h-4 w-4" />
              認証サービスでユーザー管理
            </a>
          </Button>
        )}
      </div>

      {/* 検索 */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="名前またはメールアドレスで検索..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
            </div>
            <Button onClick={handleSearch}>検索</Button>
          </div>
        </CardContent>
      </Card>

      {/* ユーザー一覧 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            ユーザー一覧
          </CardTitle>
          <CardDescription>{data?.total || 0} 件のユーザー</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : data?.users && data.users.length > 0 ? (
            <div className="space-y-4">
              {data.users.map((user) => (
                <div key={user.id} className="rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                        <Users className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{user.name || "名前未設定"}</span>
                          {getRoleBadge(user.authRoles || [])}
                        </div>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Mail className="h-3 w-3" />
                          {user.email}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleOpenAssignDialog(user)}>
                        <FileText className="mr-1 h-4 w-4" />
                        担当文書
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenEditDialog(user)}
                        data-testid="edit-user-button"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  {/* 担当文書一覧（簡易表示） */}
                  {user.assignedDocs && user.assignedDocs.length > 0 && (
                    <div className="mt-3 pl-14">
                      <p className="text-xs text-muted-foreground mb-1">担当文書: {user.assignedDocs.length}件</p>
                      <div className="flex flex-wrap gap-1">
                        {user.assignedDocs.slice(0, 5).map((doc) => (
                          <Badge key={doc.id} variant="outline" className="text-xs">
                            {doc.title}
                          </Badge>
                        ))}
                        {user.assignedDocs.length > 5 && (
                          <Badge variant="outline" className="text-xs text-muted-foreground">
                            +{user.assignedDocs.length - 5}件
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">ユーザーがいません</p>
          )}
        </CardContent>
      </Card>

      {/* 編集ダイアログ */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ユーザー編集</DialogTitle>
            <DialogDescription>{editingUser?.email} の表示名を編集します</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-name">名前</Label>
              <Input
                id="edit-name"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                placeholder="山田 太郎"
              />
            </div>
            <p className="text-sm text-muted-foreground">
              ※ ロールや認証情報は{authAdminUrl ? <a href={authAdminUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">認証サービス</a> : "認証サービス"}で管理されています
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>キャンセル</Button>
            <Button onClick={handleEditUser} disabled={updating}>
              {updating ? "更新中..." : "更新"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 担当者変更ダイアログ */}
      <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>担当文書管理</DialogTitle>
            <DialogDescription>
              {assigningUser?.name || assigningUser?.email} の担当文書を管理します
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {docsLoading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                <p className="text-sm text-muted-foreground mb-3">
                  文書を選択して担当者を {assigningUser?.name || assigningUser?.email} に変更できます
                </p>
                {allDocs.map((doc) => {
                  const isAssigned = doc.assigneeId === assigningUser?.id;
                  return (
                    <div key={doc.id} className="flex items-center justify-between p-2 border rounded-md">
                      <span className="text-sm">{doc.title}</span>
                      {isAssigned ? (
                        <Badge variant="secondary">担当中</Badge>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => assigningUser && handleChangeAssignee(doc.id, assigningUser.id)}
                        >
                          担当者に設定
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setIsAssignDialogOpen(false)}>閉じる</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
