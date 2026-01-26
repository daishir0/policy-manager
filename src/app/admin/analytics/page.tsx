"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart3, Eye, Search, MessageSquare, TrendingUp, Users, Calendar } from "lucide-react";

interface AccessStats {
  totalViews: number;
  uniqueUsers: number;
  topDocuments: Array<{
    documentId: string;
    documentTitle: string;
    viewCount: number;
  }>;
  topSearchTerms: Array<{
    term: string;
    count: number;
  }>;
  dailyStats: Array<{
    date: string;
    views: number;
    searches: number;
    qaQuestions: number;
  }>;
}

export default function AnalyticsPage() {
  const [stats, setStats] = useState<AccessStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<"7d" | "30d" | "90d">("30d");

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      setError(null);

      const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
      const endDate = new Date().toISOString();

      try {
        const response = await fetch(`/api/analytics?startDate=${startDate}&endDate=${endDate}`);
        if (!response.ok) {
          throw new Error("統計情報の取得に失敗しました");
        }
        const data = await response.json();
        setStats(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "エラーが発生しました");
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [period]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">アクセス統計</h1>
          <p className="text-muted-foreground">読み込み中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">アクセス統計</h1>
          <p className="text-destructive">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">アクセス統計</h1>
          <p className="text-muted-foreground">
            利用状況の分析とアクセス統計を確認できます
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={period === "7d" ? "default" : "outline"}
            size="sm"
            onClick={() => setPeriod("7d")}
          >
            7日間
          </Button>
          <Button
            variant={period === "30d" ? "default" : "outline"}
            size="sm"
            onClick={() => setPeriod("30d")}
          >
            30日間
          </Button>
          <Button
            variant={period === "90d" ? "default" : "outline"}
            size="sm"
            onClick={() => setPeriod("90d")}
          >
            90日間
          </Button>
        </div>
      </div>

      {/* サマリーカード */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">総閲覧数</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalViews || 0}</div>
            <p className="text-xs text-muted-foreground">期間内の文書閲覧回数</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">ユニークユーザー</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.uniqueUsers || 0}</div>
            <p className="text-xs text-muted-foreground">期間内のアクティブユーザー数</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">検索キーワード数</CardTitle>
            <Search className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.topSearchTerms?.length || 0}</div>
            <p className="text-xs text-muted-foreground">ユニークな検索クエリ数</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">日別データ</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.dailyStats?.length || 0}</div>
            <p className="text-xs text-muted-foreground">アクティブな日数</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* 人気文書ランキング */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              人気文書ランキング
            </CardTitle>
            <CardDescription>最もよく閲覧されている文書</CardDescription>
          </CardHeader>
          <CardContent>
            {stats?.topDocuments && stats.topDocuments.length > 0 ? (
              <div className="space-y-3">
                {stats.topDocuments.slice(0, 10).map((doc, index) => (
                  <div key={doc.documentId} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-medium">
                        {index + 1}
                      </span>
                      <a
                        href={`/admin/documents/${doc.documentId}`}
                        className="text-sm hover:underline truncate max-w-[200px]"
                      >
                        {doc.documentTitle}
                      </a>
                    </div>
                    <span className="text-sm text-muted-foreground">{doc.viewCount} 回</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">データがありません</p>
            )}
          </CardContent>
        </Card>

        {/* 検索キーワードランキング */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              検索キーワードランキング
            </CardTitle>
            <CardDescription>よく検索されているキーワード</CardDescription>
          </CardHeader>
          <CardContent>
            {stats?.topSearchTerms && stats.topSearchTerms.length > 0 ? (
              <div className="space-y-3">
                {stats.topSearchTerms.slice(0, 10).map((term, index) => (
                  <div key={term.term} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-secondary text-xs font-medium">
                        {index + 1}
                      </span>
                      <span className="text-sm truncate max-w-[200px]">{term.term}</span>
                    </div>
                    <span className="text-sm text-muted-foreground">{term.count} 回</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">データがありません</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 日別推移 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            日別アクセス推移
          </CardTitle>
          <CardDescription>日ごとの閲覧・検索・Q&A件数</CardDescription>
        </CardHeader>
        <CardContent>
          {stats?.dailyStats && stats.dailyStats.length > 0 ? (
            <div className="space-y-2">
              <div className="grid grid-cols-4 gap-4 text-sm font-medium text-muted-foreground border-b pb-2">
                <div>日付</div>
                <div className="text-right">閲覧</div>
                <div className="text-right">検索</div>
                <div className="text-right">Q&A</div>
              </div>
              {stats.dailyStats.slice(0, 14).map((day) => (
                <div key={day.date} className="grid grid-cols-4 gap-4 text-sm py-1">
                  <div>{day.date}</div>
                  <div className="text-right">{day.views}</div>
                  <div className="text-right">{day.searches}</div>
                  <div className="text-right">{day.qaQuestions}</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">データがありません</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
