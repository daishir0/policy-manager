"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, ExternalLink, Check, RefreshCw, ArrowLeft, Edit } from "lucide-react";
import { toast } from "sonner";

interface ContradictionItem {
  id: string;
  documentId: string;
  documentTitle: string;
  comparedDocId: string | null;
  comparedDocTitle: string | null;
  severity: string;
  description: string;
  suggestion: string;
  ignoredAt: string | null;
  createdAt: string;
}

const severityBadge = (severity: string) => {
  switch (severity) {
    case "high":
      return <Badge className="bg-red-500">重大</Badge>;
    case "medium":
      return <Badge className="bg-yellow-500">中程度</Badge>;
    case "low":
      return <Badge variant="secondary">軽微</Badge>;
    default:
      return <Badge variant="outline">{severity}</Badge>;
  }
};

export default function ContradictionsPage() {
  const [contradictions, setContradictions] = useState<ContradictionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [ignoringId, setIgnoringId] = useState<string | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const searchParams = useSearchParams();

  // URLハッシュからスクロール先を取得
  useEffect(() => {
    const hash = window.location.hash;
    if (hash && hash.startsWith("#contradiction-")) {
      const targetId = hash.replace("#contradiction-", "");
      setHighlightedId(targetId);
    }
  }, [searchParams]);

  // 矛盾一覧の読み込み完了後にスクロール
  useEffect(() => {
    if (!loading && highlightedId) {
      const targetCard = cardRefs.current.get(highlightedId);
      if (targetCard) {
        setTimeout(() => {
          targetCard.scrollIntoView({ behavior: "smooth", block: "center" });
          // ハイライト解除タイマー
          setTimeout(() => setHighlightedId(null), 3000);
        }, 100);
      }
    }
  }, [loading, highlightedId]);

  const fetchContradictions = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/contradictions");
      if (!res.ok) throw new Error("取得失敗");
      const data = await res.json();
      setContradictions(data.contradictions || []);
    } catch {
      toast.error("矛盾検出一覧の取得に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContradictions();
  }, []);

  const handleIgnore = async (id: string) => {
    setIgnoringId(id);
    try {
      const res = await fetch(`/api/contradictions/${id}/ignore`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("無視失敗");
      toast.success("この指摘を無視しました");
      fetchContradictions();
    } catch {
      toast.error("操作に失敗しました");
    } finally {
      setIgnoringId(null);
    }
  };

  const activeCount = contradictions.filter(c => !c.ignoredAt).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Button variant="ghost" size="sm" asChild className="mb-2">
            <Link href="/admin/policies">
              <ArrowLeft className="mr-2 h-4 w-4" />
              ポリシー一覧に戻る
            </Link>
          </Button>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <AlertTriangle className="h-8 w-8 text-yellow-500" />
            矛盾検出一覧
          </h1>
          <p className="text-muted-foreground">
            文書間で検出された矛盾・不整合を確認できます
          </p>
        </div>
        <Button variant="outline" onClick={fetchContradictions} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          更新
        </Button>
      </div>

      {loading ? (
        <Card>
          <CardContent className="py-12 text-center">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
            <p className="mt-4 text-muted-foreground">読み込み中...</p>
          </CardContent>
        </Card>
      ) : contradictions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Check className="h-12 w-12 mx-auto text-green-500" />
            <p className="mt-4 text-lg font-medium">矛盾は検出されていません</p>
            <p className="text-muted-foreground">すべての文書が整合性を保っています</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            検出件数: {activeCount}件（無視済み含む合計: {contradictions.length}件）
          </p>

          {contradictions.map((item) => (
            <Card
              key={item.id}
              id={`contradiction-${item.id}`}
              ref={(el) => {
                if (el) cardRefs.current.set(item.id, el);
              }}
              className={`transition-all duration-500 ${
                item.ignoredAt ? "opacity-50 border-dashed" : ""
              } ${highlightedId === item.id ? "ring-2 ring-yellow-400 bg-yellow-50 dark:bg-yellow-950/20" : ""}`}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    {severityBadge(item.severity)}
                    {item.ignoredAt && (
                      <Badge variant="outline" className="text-muted-foreground">
                        無視済み
                      </Badge>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(item.createdAt).toLocaleString("ja-JP")}
                  </span>
                </div>
                <CardTitle className="text-base mt-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link
                      href={`/admin/documents/${item.documentId}`}
                      className="text-blue-600 hover:underline flex items-center gap-1"
                    >
                      {item.documentTitle}
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                    {item.comparedDocId ? (
                      <>
                        <span className="text-muted-foreground">と</span>
                        <Link
                          href={`/admin/documents/${item.comparedDocId}`}
                          className="text-blue-600 hover:underline flex items-center gap-1"
                        >
                          {item.comparedDocTitle}
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                        <span className="text-muted-foreground">の間で矛盾を検出</span>
                      </>
                    ) : (
                      <span className="text-muted-foreground">の矛盾チェック結果（一括）</span>
                    )}
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">矛盾の内容:</p>
                  <p className="text-sm bg-muted/50 p-3 rounded-lg">{item.description}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">修正提案:</p>
                  <p className="text-sm bg-blue-50 dark:bg-blue-950/30 p-3 rounded-lg text-blue-800 dark:text-blue-200 whitespace-pre-wrap">
                    {item.suggestion}
                  </p>
                </div>
                {!item.ignoredAt && (
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="default"
                      size="sm"
                      asChild
                    >
                      <Link
                        href={`/admin/documents/${item.documentId}/edit?contradictionSuggestion=${encodeURIComponent(
                          `以下の改修指摘ポイントを元に、当文書を改善して\n\n【矛盾の内容】\n${item.description}\n\n【修正提案】\n${item.suggestion}`
                        )}`}
                      >
                        <Edit className="mr-2 h-4 w-4" />
                        この指摘を元に修正する
                      </Link>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleIgnore(item.id)}
                      disabled={ignoringId === item.id}
                    >
                      {ignoringId === item.id ? (
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="mr-2 h-4 w-4" />
                      )}
                      この指摘を無視する
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
