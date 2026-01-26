"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Network, FileText, ArrowRight, RefreshCw, Filter } from "lucide-react";

interface DependencyNode {
  id: string;
  title: string;
  status: string;
}

interface DependencyEdge {
  id: string;
  sourceDocumentId: string;
  targetDocumentId: string;
  type: string;
  description: string | null;
}

interface DependencyGraph {
  nodes: DependencyNode[];
  edges: DependencyEdge[];
}

export default function DependenciesPage() {
  const [graph, setGraph] = useState<DependencyGraph | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  const fetchGraph = async (documentId?: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = documentId ? `?documentId=${documentId}` : "";
      const response = await fetch(`/api/dependencies/graph${params}`);
      if (!response.ok) {
        throw new Error("依存関係の取得に失敗しました");
      }
      const data = await response.json();
      setGraph(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGraph();
  }, []);

  const handleNodeClick = (nodeId: string) => {
    if (selectedNode === nodeId) {
      setSelectedNode(null);
      fetchGraph();
    } else {
      setSelectedNode(nodeId);
      fetchGraph(nodeId);
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case "REFERENCE":
        return <Badge variant="default">参照</Badge>;
      case "CITATION":
        return <Badge variant="secondary">引用</Badge>;
      case "PARENT":
        return <Badge variant="outline">上位規定</Badge>;
      case "SUPPLEMENT":
        return <Badge>補足</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  const getNodeById = (id: string) => graph?.nodes.find((n) => n.id === id);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">依存関係</h1>
          <p className="text-muted-foreground">
            文書間の依存関係を可視化します
          </p>
        </div>
        <div className="flex gap-2">
          {selectedNode && (
            <Button variant="outline" onClick={() => { setSelectedNode(null); fetchGraph(); }}>
              <Filter className="mr-2 h-4 w-4" />
              フィルター解除
            </Button>
          )}
          <Button variant="outline" onClick={() => fetchGraph(selectedNode || undefined)}>
            <RefreshCw className="mr-2 h-4 w-4" />
            更新
          </Button>
        </div>
      </div>

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
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* ノード一覧 */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                文書一覧
              </CardTitle>
              <CardDescription>
                {graph?.nodes.length || 0} 件の文書
              </CardDescription>
            </CardHeader>
            <CardContent>
              {graph?.nodes && graph.nodes.length > 0 ? (
                <div className="space-y-2 max-h-[500px] overflow-y-auto">
                  {graph.nodes.map((node) => (
                    <button
                      key={node.id}
                      onClick={() => handleNodeClick(node.id)}
                      className={`w-full text-left rounded-lg border p-3 transition-colors ${
                        selectedNode === node.id
                          ? "bg-primary/10 border-primary"
                          : "hover:bg-accent"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium truncate">{node.title}</span>
                        <Badge variant={node.status === "PUBLISHED" ? "default" : "secondary"} className="text-xs">
                          {node.status === "PUBLISHED" ? "公開" : "下書き"}
                        </Badge>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">依存関係のある文書がありません</p>
              )}
            </CardContent>
          </Card>

          {/* 依存関係 */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Network className="h-5 w-5" />
                依存関係
              </CardTitle>
              <CardDescription>
                {graph?.edges.length || 0} 件の依存関係
              </CardDescription>
            </CardHeader>
            <CardContent>
              {graph?.edges && graph.edges.length > 0 ? (
                <div className="space-y-3 max-h-[500px] overflow-y-auto">
                  {graph.edges.map((edge) => {
                    const sourceNode = getNodeById(edge.sourceDocumentId);
                    const targetNode = getNodeById(edge.targetDocumentId);
                    return (
                      <div
                        key={edge.id}
                        className="flex items-center gap-3 rounded-lg border p-3"
                      >
                        <a
                          href={`/admin/documents/${edge.sourceDocumentId}`}
                          className="flex-1 min-w-0"
                        >
                          <div className="text-sm font-medium truncate hover:underline">
                            {sourceNode?.title || "不明な文書"}
                          </div>
                        </a>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {getTypeBadge(edge.type)}
                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <a
                          href={`/admin/documents/${edge.targetDocumentId}`}
                          className="flex-1 min-w-0"
                        >
                          <div className="text-sm font-medium truncate hover:underline text-right">
                            {targetNode?.title || "不明な文書"}
                          </div>
                        </a>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Network className="h-12 w-12 mb-4" />
                  <p>依存関係がありません</p>
                  <p className="text-sm mt-1">
                    文書編集画面から依存関係を追加できます
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* 依存関係の説明 */}
      <Card>
        <CardHeader>
          <CardTitle>依存関係の種類</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-1">
              <Badge variant="default">参照</Badge>
              <p className="text-sm text-muted-foreground">
                他の文書を参照している関係
              </p>
            </div>
            <div className="space-y-1">
              <Badge variant="secondary">引用</Badge>
              <p className="text-sm text-muted-foreground">
                他の文書の内容を引用している関係
              </p>
            </div>
            <div className="space-y-1">
              <Badge variant="outline">上位規定</Badge>
              <p className="text-sm text-muted-foreground">
                上位の規定に基づく従属関係
              </p>
            </div>
            <div className="space-y-1">
              <Badge>補足</Badge>
              <p className="text-sm text-muted-foreground">
                他の文書を補足する関係
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
