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
import { ClipboardList, RefreshCw, Search, X, Calendar } from "lucide-react";
import { toast } from "sonner";

interface AuditLog {
  id: string;
  userId: string | null;
  userName: string | null;
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

interface UserOption {
  id: string;
  name: string | null;
  email: string;
}

type DatePreset = "today" | "7days" | "30days" | "all";

const DATE_PRESETS: { value: DatePreset; label: string }[] = [
  { value: "today", label: "今日" },
  { value: "7days", label: "7日間" },
  { value: "30days", label: "30日間" },
  { value: "all", label: "全期間" },
];

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
  ai_error: "AI呼び出し失敗",
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
  ai_error: "destructive",
};

// 管理者ロールチェック（super_admin または admin）
const hasAdminRole = (roles: string[] | undefined): boolean => {
  if (!roles) return false;
  return roles.some((role) => ["super_admin", "admin", "ADMIN"].includes(role));
};

export default function LogsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [data, setData] = useState<LogsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState("");
  const [activeKeyword, setActiveKeyword] = useState("");
  const [userFilter, setUserFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [users, setUsers] = useState<UserOption[]>([]);

  useEffect(() => {
    if (status === "loading") return;
    if (!session || !hasAdminRole(session.user.roles)) {
      router.replace("/admin");
    }
  }, [session, status, router]);

  // ユーザー一覧を取得（ドロップダウン用）
  useEffect(() => {
    if (!session || !hasAdminRole(session.user.roles)) return;
    fetch("/api/users?limit=100")
      .then((res) => res.json())
      .then((result) => {
        setUsers(result.users || []);
      })
      .catch(() => {});
  }, [session]);

  const fetchLogs = useCallback(async () => {
    if (!session || !hasAdminRole(session.user.roles)) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeKeyword) params.set("keyword", activeKeyword);
      if (userFilter) params.set("userId", userFilter);
      if (actionFilter) params.set("action", actionFilter);

      if (datePreset !== "all") {
        const now = new Date();
        let startDate: Date;
        if (datePreset === "today") {
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        } else if (datePreset === "7days") {
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        } else {
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        }
        params.set("startDate", startDate.toISOString());
      }

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
  }, [session, activeKeyword, userFilter, actionFilter, datePreset, currentPage]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const applyKeyword = () => {
    setActiveKeyword(keyword);
    setCurrentPage(1);
  };

  const clearKeyword = () => {
    setKeyword("");
    setActiveKeyword("");
    setCurrentPage(1);
  };

  if (status === "loading" || (session && !hasAdminRole(session.user.roles))) {
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
        <CardContent className="pt-4 space-y-3">
          {/* Row 1: キーワード検索 + ドロップダウン */}
          <div className="flex gap-2 flex-wrap">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="ユーザー名・文書名・質問内容で検索..."
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && applyKeyword()}
                className="pl-9"
              />
              {keyword && (
                <button
                  onClick={clearKeyword}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <Select
              value={userFilter || "all"}
              onValueChange={(v) => {
                setUserFilter(v === "all" ? "" : v);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="ユーザー" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全ユーザー</SelectItem>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name || u.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={actionFilter || "all"}
              onValueChange={(v) => {
                setActionFilter(v === "all" ? "" : v);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="アクション種別" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全アクション</SelectItem>
                {Object.entries(ACTION_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={applyKeyword} variant="secondary">検索</Button>
          </div>

          {/* Row 2: 日付プリセット */}
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">期間:</span>
            <div className="flex gap-1">
              {DATE_PRESETS.map((preset) => (
                <Button
                  key={preset.value}
                  variant={datePreset === preset.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setDatePreset(preset.value);
                    setCurrentPage(1);
                  }}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
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
                        <span className="text-muted-foreground text-xs">{log.userName || log.userId.slice(0, 8) + "..."}</span>
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
