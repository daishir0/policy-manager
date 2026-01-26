"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Lightbulb, RefreshCw, Check, X, FileText, Search, Trash2 } from "lucide-react";

interface Proposal {
  id: string;
  type: "REVISION" | "NEW_DOCUMENT" | "RETIREMENT";
  title: string;
  description: string;
  reasoning: string;
  status: "PENDING" | "ACCEPTED" | "REJECTED";
  createdAt: string;
  relatedDocuments: Array<{
    document: {
      id: string;
      title: string;
    };
  }>;
}

interface ProposalsResponse {
  proposals: Proposal[];
  total: number;
  page: number;
  totalPages: number;
}

export default function ProposalsPage() {
  const [data, setData] = useState<ProposalsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("PENDING");

  const fetchProposals = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.append("status", statusFilter);
      const response = await fetch(`/api/proposals?${params.toString()}`);
      if (!response.ok) {
        throw new Error("提案一覧の取得に失敗しました");
      }
      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProposals();
  }, [statusFilter]);

  const handleGenerateProposals = async () => {
    setGenerating(true);
    try {
      const response = await fetch("/api/proposals/generate", { method: "POST" });
      if (!response.ok) {
        throw new Error("提案の生成に失敗しました");
      }
      fetchProposals();
    } catch (err) {
      alert(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setGenerating(false);
    }
  };

  const handleUpdateStatus = async (proposalId: string, status: "ACCEPTED" | "REJECTED", reason?: string) => {
    try {
      const response = await fetch(`/api/proposals/${proposalId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, reason }),
      });
      if (!response.ok) {
        throw new Error("ステータスの更新に失敗しました");
      }
      fetchProposals();
    } catch (err) {
      alert(err instanceof Error ? err.message : "エラーが発生しました");
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case "REVISION":
        return <Badge variant="default">改訂提案</Badge>;
      case "NEW_DOCUMENT":
        return <Badge variant="secondary">新規作成提案</Badge>;
      case "RETIREMENT":
        return <Badge variant="outline">廃止提案</Badge>;
      default:
        return <Badge>{type}</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PENDING":
        return <Badge variant="outline">未対応</Badge>;
      case "ACCEPTED":
        return <Badge variant="default" className="bg-green-500">採択</Badge>;
      case "REJECTED":
        return <Badge variant="destructive">却下</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "REVISION":
        return <FileText className="h-5 w-5 text-blue-500" />;
      case "NEW_DOCUMENT":
        return <Search className="h-5 w-5 text-green-500" />;
      case "RETIREMENT":
        return <Trash2 className="h-5 w-5 text-orange-500" />;
      default:
        return <Lightbulb className="h-5 w-5" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">改善提案</h1>
          <p className="text-muted-foreground">
            AIによる文書改善提案を確認・管理します
          </p>
        </div>
        <Button onClick={handleGenerateProposals} disabled={generating}>
          <RefreshCw className={`mr-2 h-4 w-4 ${generating ? "animate-spin" : ""}`} />
          {generating ? "生成中..." : "提案を生成"}
        </Button>
      </div>

      {/* フィルター */}
      <div className="flex gap-2">
        <Button
          variant={statusFilter === "PENDING" ? "default" : "outline"}
          size="sm"
          onClick={() => setStatusFilter("PENDING")}
        >
          未対応
        </Button>
        <Button
          variant={statusFilter === "ACCEPTED" ? "default" : "outline"}
          size="sm"
          onClick={() => setStatusFilter("ACCEPTED")}
        >
          採択済み
        </Button>
        <Button
          variant={statusFilter === "REJECTED" ? "default" : "outline"}
          size="sm"
          onClick={() => setStatusFilter("REJECTED")}
        >
          却下
        </Button>
        <Button
          variant={statusFilter === "" ? "default" : "outline"}
          size="sm"
          onClick={() => setStatusFilter("")}
        >
          すべて
        </Button>
      </div>

      {/* 提案一覧 */}
      <div className="space-y-4">
        {loading ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">読み込み中...</p>
            </CardContent>
          </Card>
        ) : error ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-destructive">{error}</p>
            </CardContent>
          </Card>
        ) : data?.proposals && data.proposals.length > 0 ? (
          data.proposals.map((proposal) => (
            <Card key={proposal.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    {getTypeIcon(proposal.type)}
                    <div>
                      <CardTitle className="text-lg">{proposal.title}</CardTitle>
                      <div className="flex items-center gap-2 mt-1">
                        {getTypeBadge(proposal.type)}
                        {getStatusBadge(proposal.status)}
                      </div>
                    </div>
                  </div>
                  {proposal.status === "PENDING" && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-green-600 hover:text-green-700"
                        onClick={() => handleUpdateStatus(proposal.id, "ACCEPTED")}
                      >
                        <Check className="mr-1 h-4 w-4" />
                        採択
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive hover:text-destructive"
                        onClick={() => {
                          const reason = prompt("却下理由を入力してください");
                          if (reason !== null) {
                            handleUpdateStatus(proposal.id, "REJECTED", reason);
                          }
                        }}
                      >
                        <X className="mr-1 h-4 w-4" />
                        却下
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground">説明</h4>
                    <p className="text-sm mt-1">{proposal.description}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground">提案理由</h4>
                    <p className="text-sm mt-1">{proposal.reasoning}</p>
                  </div>
                  {proposal.relatedDocuments && proposal.relatedDocuments.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground">関連文書</h4>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {proposal.relatedDocuments.map((rel) => (
                          <a
                            key={rel.document.id}
                            href={`/admin/documents/${rel.document.id}`}
                            className="text-sm text-primary hover:underline"
                          >
                            {rel.document.title}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground">
                    作成日: {new Date(proposal.createdAt).toLocaleString("ja-JP")}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <Lightbulb className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">提案がありません</p>
                <p className="text-sm text-muted-foreground mt-1">
                  「提案を生成」ボタンをクリックしてAIに改善提案を生成させてください
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
