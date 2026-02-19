"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ClipboardList, RefreshCw, Search, X } from "lucide-react";
import { toast } from "sonner";

interface AuditLog {
  id: string;
  userId: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  details: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
}

interface LogsResponse {
  logs: AuditLog[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

const ACTION_LABELS: Record<string, string> = {
  login: "ログイン",
  logout: "ログアウト",
  login_failed: "ログイン失敗",
  user_create: "ユーザー作成",
  user_update: "ユーザー更新",
  user_delete: "ユーザー削除",
  role_change: "ロール変更",
  document_create: "文書作成",
  document_update: "文書更新",
  document_delete: "文書削除",
  document_publish: "文書公開",
  document_retire: "文書廃止",
  document_view: "文書閲覧",
  contradiction_check: "矛盾チェック",
  qa_ask: "Q&A質問",
  draft_generate: "文案生成",
  assignee_change: "担当者変更",
  message_read: "メッセージ既読",
  pdf_extract: "PDF抽出",
};

const ACTION_BADGE_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  login: "default",
  logout: "secondary",
  login_failed: "destructive",
  user_create: "default",
  user_delete: "destructive",
  document_delete: "destructive",
  document_publish: "default",
  document_retire: "outline",
};

export default function LogsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [data, setData] = useState<LogsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [userSearch, setUserSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    if (status === "loading") return;
    if (!session || session.user.role !== "ADMIN") {
      router.replace("/admin");
    }
  }, [session, status, router]);

  const fetchLogs = useCallback(async () => {
    if (!session || session.user.role !== "ADMIN") return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (userSearch) params.set("userId", userSearch);
      if (actionFilter) params.set("action", actionFilter);
      params.set("page", String(currentPage));
      params.set("limit", "50");

      const res = await fetch(`/api/audit-logs?${params}`);
      if (!res.ok) throw new Error("ログ取得失敗");
      const result = await res.json();
      setData(result);
    } catch {
      toast.error("ログの取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }, [session, userSearch, actionFilter, currentPage]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  if (status === "loading" || (session && session.user.role !== "ADMIN")) {
    return (
      <div className="flex items-center justify-center h-48">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const getActionBadge = (action: string) => {
    const variant = ACTION_BADGE_VARIANT[action] ?? "secondary";
    return <Badge variant={variant}>{ACTION_LABELS[action] ?? action}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <ClipboardList className="h-8 w-8" />
            ログ管理
          </h1>
          <p className="text-muted-foreground">システムの全操作ログを確認できます</p>
        </div>
        <button onClick={fetchLogs} className="text-muted-foreground hover:text-foreground">
          <RefreshCw className={`h-5 w-5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* フィルター */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex gap-2 flex-wrap">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="ユーザーIDで絞り込み..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && fetchLogs()}
                className="pl-9"
              />
              {userSearch && (
                <button
                  onClick={() => setUserSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <Select value={actionFilter || "all"} onValueChange={(v) => setActionFilter(v === "all" ? "" : v)}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="アクション種別" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全て</SelectItem>
                {Object.entries(ACTION_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={fetchLogs} variant="secondary">絞り込み</Button>
          </div>
        </CardContent>
      </Card>

      {/* ログ一覧 */}
      <Card>
        <CardHeader>
          <CardTitle>
            操作ログ ({loading ? "..." : data?.pagination.total ?? 0}件)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : data?.logs && data.logs.length > 0 ? (
            <div className="space-y-2">
              {data.logs.map((log) => (
                <div key={log.id} className="flex items-start gap-4 p-3 border rounded-lg text-sm">
                  <div className="flex-shrink-0 w-40 text-muted-foreground text-xs pt-0.5">
                    {new Date(log.createdAt).toLocaleString("ja-JP")}
                  </div>
                  <div className="flex-shrink-0">
                    {getActionBadge(log.action)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {log.userId && (
                        <span className="text-muted-foreground text-xs">UID: {log.userId.slice(0, 8)}...</span>
                      )}
                      {log.entityType && log.entityId && (
                        <span className="text-muted-foreground text-xs">
                          {log.entityType}: {log.entityId.slice(0, 8)}...
                        </span>
                      )}
                      {log.ipAddress && (
                        <span className="text-muted-foreground text-xs">IP: {log.ipAddress}</span>
                      )}
                    </div>
                    {log.details && Object.keys(log.details).length > 0 && (
                      <p className="text-xs text-muted-foreground mt-1 truncate">
                        {log.action === "qa_ask" && (log.details as Record<string, unknown>).question
                          ? `質問: ${String((log.details as Record<string, unknown>).question)}`
                          : (log.details as Record<string, unknown>).title
                            ? `文書: ${String((log.details as Record<string, unknown>).title)}`
                            : JSON.stringify(log.details).slice(0, 100)}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-12">ログがありません</p>
          )}

          {/* ページネーション */}
          {data && data.pagination.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => p - 1)}
              >
                前へ
              </Button>
              <span className="text-sm text-muted-foreground">
                {currentPage} / {data.pagination.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage >= data.pagination.totalPages}
                onClick={() => setCurrentPage((p) => p + 1)}
              >
                次へ
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
