"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Network, RefreshCw, ChevronRight, FileText } from "lucide-react";
import { toast } from "sonner";

interface DocNode {
  id: string;
  title: string;
  status: string;
  children: DocNode[];
}

interface DepsData {
  nodes: Array<{ id: string; title: string; status: string }>;
  edges: Array<{ from: string; to: string }>;
}

function buildTree(nodes: DepsData["nodes"], edges: DepsData["edges"]): DocNode[] {
  const childrenMap = new Map<string, string[]>();
  const hasParent = new Set<string>();

  for (const edge of edges) {
    if (!childrenMap.has(edge.to)) {
      childrenMap.set(edge.to, []);
    }
    childrenMap.get(edge.to)!.push(edge.from);
    hasParent.add(edge.from);
  }

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  function buildNode(id: string, visited = new Set<string>()): DocNode {
    const node = nodeMap.get(id);
    if (!node) return { id, title: "不明", status: "DRAFT", children: [] };
    if (visited.has(id)) {
      return { ...node, children: [] };
    }
    const newVisited = new Set(visited);
    newVisited.add(id);
    const childIds = childrenMap.get(id) || [];
    return {
      ...node,
      children: childIds.map((cid) => buildNode(cid, newVisited)),
    };
  }

  const roots = nodes.filter((n) => !hasParent.has(n.id));
  return roots.map((r) => buildNode(r.id));
}

function TreeNode({ node, level = 0 }: { node: DocNode; level?: number }) {
  const [expanded, setExpanded] = useState(level < 2);
  const hasChildren = node.children.length > 0;

  const statusColor = {
    PUBLISHED: "bg-green-500",
    DRAFT: "bg-gray-400",
    RETIRED: "bg-red-400",
  }[node.status] ?? "bg-gray-400";

  return (
    <div className={`${level > 0 ? "ml-6 border-l border-dashed pl-4 mt-2" : "mt-2"}`}>
      <div className="flex items-center gap-2">
        {hasChildren ? (
          <button onClick={() => setExpanded(!expanded)} className="text-muted-foreground hover:text-foreground">
            <ChevronRight className={`h-4 w-4 transition-transform ${expanded ? "rotate-90" : ""}`} />
          </button>
        ) : (
          <span className="w-4" />
        )}
        <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${statusColor}`} />
        <Link
          href={`/admin/documents/${node.id}`}
          className="text-sm font-medium hover:underline flex items-center gap-1"
        >
          <FileText className="h-3 w-3 text-muted-foreground" />
          {node.title}
        </Link>
        <Badge variant="outline" className="text-xs py-0">
          {node.status === "PUBLISHED" ? "公開" : node.status === "DRAFT" ? "下書き" : "廃止"}
        </Badge>
      </div>
      {hasChildren && expanded && (
        <div>
          {node.children.map((child, idx) => (
            <TreeNode key={`${node.id}-${child.id}-${idx}`} node={child} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function DependenciesPage() {
  const [loading, setLoading] = useState(true);
  const [tree, setTree] = useState<DocNode[]>([]);

  const fetchDependencies = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/dependencies/graph");
      if (!res.ok) throw new Error("取得失敗");
      const data: DepsData = await res.json();
      setTree(buildTree(data.nodes, data.edges));
    } catch {
      toast.error("依存関係の取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDependencies();
  }, [fetchDependencies]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Network className="h-8 w-8" />
            依存関係ツリー
          </h1>
          <p className="text-muted-foreground">文書間の依存関係を階層構造で表示します</p>
        </div>
        <button onClick={fetchDependencies} className="text-muted-foreground hover:text-foreground">
          <RefreshCw className={`h-5 w-5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-green-500" />公開中</span>
        <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-gray-400" />下書き</span>
        <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-red-400" />廃止</span>
        <span>・文書名クリックで詳細へ</span>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>文書ツリー</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : tree.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">依存関係が設定された文書はありません</p>
          ) : (
            <div className="py-2">
              {tree.map((node) => (
                <TreeNode key={node.id} node={node} level={0} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
