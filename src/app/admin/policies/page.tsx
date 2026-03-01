"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  FileText,
  Edit,
  Eye,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Wand2,
  Network,
  RefreshCw,
  List,
  TreePine,
} from "lucide-react";
import { toast } from "sonner";

// ===== 共通 =====
const statusBadge = (status: string) => {
  switch (status) {
    case "PUBLISHED":
      return <Badge className="bg-green-500">公開中</Badge>;
    case "DRAFT":
      return <Badge variant="secondary">下書き</Badge>;
    case "RETIRED":
      return <Badge variant="outline">廃止</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
};

// ===== ツリービュー関連 =====
interface DocNode {
  id: string;
  title: string;
  status: string;
  children: DocNode[];
}

interface DepsData {
  nodes: Array<{ id: string; title: string; status: string }>;
  edges: Array<{ from: string; to: string; isMain: boolean }>;
}

function buildTree(nodes: DepsData["nodes"], edges: DepsData["edges"]): DocNode[] {
  // メイン依存関係のエッジのみを使用してツリーを構築
  const mainEdges = edges.filter(e => e.isMain);

  const childrenMap = new Map<string, string[]>();
  const hasParent = new Set<string>();

  for (const edge of mainEdges) {
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

// ツリーの開閉状態を管理するためのキー
const TREE_EXPANDED_KEY = "policy-tree-expanded-nodes";

// ツリーから全ノードIDを収集する関数
function collectAllNodeIds(nodes: DocNode[]): string[] {
  const ids: string[] = [];
  function collect(node: DocNode) {
    ids.push(node.id);
    node.children.forEach(collect);
  }
  nodes.forEach(collect);
  return ids;
}

interface TreeNodeProps {
  node: DocNode;
  level?: number;
  expandedNodes: Set<string>;
  onToggle: (nodeId: string) => void;
}

function TreeNode({ node, level = 0, expandedNodes, onToggle }: TreeNodeProps) {
  const hasChildren = node.children.length > 0;
  const expanded = expandedNodes.has(node.id);

  const statusColor = {
    PUBLISHED: "bg-green-500",
    DRAFT: "bg-gray-400",
    RETIRED: "bg-red-400",
  }[node.status] ?? "bg-gray-400";

  return (
    <div className={`${level > 0 ? "ml-6 border-l border-dashed pl-4 mt-2" : "mt-2"}`}>
      <div className="flex items-center gap-2">
        {hasChildren ? (
          <button onClick={() => onToggle(node.id)} className="text-muted-foreground hover:text-foreground">
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
      </div>
      {hasChildren && expanded && (
        <div>
          {node.children.map((child, idx) => (
            <TreeNode
              key={`${node.id}-${child.id}-${idx}`}
              node={child}
              level={level + 1}
              expandedNodes={expandedNodes}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ===== リストビュー関連 =====
interface Document {
  id: string;
  title: string;
  status: string;
  currentVersion: string;
  createdBy: { name: string | null; email: string };
  assignee: { name: string | null; email: string } | null;
  updatedAt: string;
}

// ===== メインページ =====
function PoliciesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const defaultTab = searchParams.get("tab") || "tree";

  // ツリービュー state
  const [treeLoading, setTreeLoading] = useState(true);
  const [tree, setTree] = useState<DocNode[]>([]);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // リストビュー state
  const [documents, setDocuments] = useState<Document[]>([]);
  const [total, setTotal] = useState(0);
  const [listLoading, setListLoading] = useState(true);
  const [searchInput, setSearchInput] = useState(searchParams.get("search") || "");

  const currentSearch = searchParams.get("search") || "";
  const currentStatus = searchParams.get("status") || "";
  const currentPage = parseInt(searchParams.get("page") || "1");
  const limit = 20;
  const totalPages = Math.ceil(total / limit);

  // ===== ツリービューのデータ取得 =====
  const fetchDependencies = useCallback(async () => {
    setTreeLoading(true);
    try {
      const res = await fetch("/api/dependencies/graph");
      if (!res.ok) throw new Error("取得失敗");
      const data: DepsData = await res.json();
      setTree(buildTree(data.nodes, data.edges));
    } catch {
      toast.error("依存関係の取得に失敗しました");
    } finally {
      setTreeLoading(false);
    }
  }, []);

  // ===== リストビューのデータ取得 =====
  const fetchDocuments = useCallback(async () => {
    setListLoading(true);
    try {
      const params = new URLSearchParams();
      if (currentSearch) params.set("search", currentSearch);
      if (currentStatus) params.set("status", currentStatus);
      params.set("page", String(currentPage));
      params.set("limit", "20");

      const res = await fetch(`/api/documents?${params}`);
      if (!res.ok) throw new Error("取得失敗");
      const data = await res.json();
      setDocuments(data.documents);
      setTotal(data.pagination?.total ?? 0);
    } catch {
      setDocuments([]);
    } finally {
      setListLoading(false);
    }
  }, [currentSearch, currentStatus, currentPage]);

  useEffect(() => {
    fetchDependencies();
  }, [fetchDependencies]);

  // ツリーデータ取得後に開閉状態を初期化
  useEffect(() => {
    if (tree.length > 0 && isInitialLoad) {
      // localStorageから保存された状態を読み込む
      try {
        const saved = localStorage.getItem(TREE_EXPANDED_KEY);
        if (saved) {
          const savedIds = JSON.parse(saved) as string[];
          setExpandedNodes(new Set(savedIds));
        } else {
          // 保存された状態がない場合は全展開
          const allIds = collectAllNodeIds(tree);
          setExpandedNodes(new Set(allIds));
        }
      } catch {
        // エラー時は全展開
        const allIds = collectAllNodeIds(tree);
        setExpandedNodes(new Set(allIds));
      }
      setIsInitialLoad(false);
    }
  }, [tree, isInitialLoad]);

  // 開閉状態のトグルハンドラ
  const handleToggleNode = useCallback((nodeId: string) => {
    setExpandedNodes((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId);
      } else {
        newSet.add(nodeId);
      }
      // localStorageに保存
      try {
        localStorage.setItem(TREE_EXPANDED_KEY, JSON.stringify([...newSet]));
      } catch {
        // 保存失敗は無視
      }
      return newSet;
    });
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const applySearch = () => {
    const params = new URLSearchParams(searchParams.toString());
    if (searchInput) {
      params.set("search", searchInput);
    } else {
      params.delete("search");
    }
    params.set("page", "1");
    params.set("tab", "list");
    router.push(`/admin/policies?${params}`);
  };

  const clearSearch = () => {
    setSearchInput("");
    const params = new URLSearchParams(searchParams.toString());
    params.delete("search");
    params.set("page", "1");
    params.set("tab", "list");
    router.push(`/admin/policies?${params}`);
  };

  const setStatus = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== "all") {
      params.set("status", value);
    } else {
      params.delete("status");
    }
    params.set("page", "1");
    params.set("tab", "list");
    router.push(`/admin/policies?${params}`);
  };

  const goToPage = (page: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(page));
    params.set("tab", "list");
    router.push(`/admin/policies?${params}`);
  };

  const handleTabChange = (tab: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    router.push(`/admin/policies?${params}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <FileText className="h-8 w-8" />
            ポリシー一覧
          </h1>
          <p className="text-muted-foreground">登録されているポリシー文書を管理します</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              新規作成
              <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href="/admin/documents/new">
                <FileText className="mr-2 h-4 w-4" />
                手動で作成
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/admin/draft">
                <Wand2 className="mr-2 h-4 w-4" />
                AIで文案作成
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Tabs defaultValue={defaultTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="tree" className="flex items-center gap-2">
            <TreePine className="h-4 w-4" />
            ツリービュー
          </TabsTrigger>
          <TabsTrigger value="list" className="flex items-center gap-2">
            <List className="h-4 w-4" />
            リストビュー
          </TabsTrigger>
        </TabsList>

        {/* ===== ツリービュー ===== */}
        <TabsContent value="tree" className="mt-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
                  公開中
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block w-2 h-2 rounded-full bg-gray-400" />
                  下書き
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block w-2 h-2 rounded-full bg-red-400" />
                  廃止
                </span>
              </div>
              <button onClick={fetchDependencies} className="text-muted-foreground hover:text-foreground">
                <RefreshCw className={`h-5 w-5 ${treeLoading ? "animate-spin" : ""}`} />
              </button>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Network className="h-5 w-5" />
                  依存関係ツリー
                </CardTitle>
              </CardHeader>
              <CardContent>
                {treeLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : tree.length === 0 ? (
                  <p className="text-center text-muted-foreground py-12">
                    依存関係が設定された文書はありません
                  </p>
                ) : (
                  <div className="py-2">
                    {tree.map((node) => (
                      <TreeNode
                        key={node.id}
                        node={node}
                        level={0}
                        expandedNodes={expandedNodes}
                        onToggle={handleToggleNode}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ===== リストビュー ===== */}
        <TabsContent value="list" className="mt-4">
          <div className="space-y-4">
            {/* 検索バー */}
            <Card>
              <CardContent className="pt-4">
                <div className="flex gap-2">
                  <div className="flex-1 flex gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="タイトルまたは本文で検索..."
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && applySearch()}
                        className="pl-9"
                      />
                      {searchInput && (
                        <button
                          onClick={clearSearch}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    <Button onClick={applySearch} variant="secondary">
                      検索
                    </Button>
                  </div>
                  <Select value={currentStatus || "all"} onValueChange={setStatus}>
                    <SelectTrigger className="w-36">
                      <SelectValue placeholder="ステータス" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全て</SelectItem>
                      <SelectItem value="PUBLISHED">公開中</SelectItem>
                      <SelectItem value="DRAFT">下書き</SelectItem>
                      <SelectItem value="RETIRED">廃止</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {currentSearch && (
                  <p className="text-sm text-muted-foreground mt-2">
                    「{currentSearch}」の検索結果: {total}件
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  文書 ({listLoading ? "..." : total}件)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>タイトル</TableHead>
                      <TableHead>ステータス</TableHead>
                      <TableHead>バージョン</TableHead>
                      <TableHead>担当者</TableHead>
                      <TableHead>更新日</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {listLoading ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          読み込み中...
                        </TableCell>
                      </TableRow>
                    ) : documents.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          {currentSearch
                            ? "該当する文書が見つかりませんでした"
                            : "文書がまだ登録されていません"}
                        </TableCell>
                      </TableRow>
                    ) : (
                      documents.map((doc) => (
                        <TableRow key={doc.id}>
                          <TableCell className="font-medium">
                            <Link href={`/admin/documents/${doc.id}`} className="hover:underline">
                              {doc.title}
                            </Link>
                          </TableCell>
                          <TableCell>{statusBadge(doc.status)}</TableCell>
                          <TableCell>v{doc.currentVersion}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {doc.assignee?.name ||
                              doc.assignee?.email ||
                              doc.createdBy.name ||
                              doc.createdBy.email}
                          </TableCell>
                          <TableCell>
                            {new Date(doc.updatedAt).toLocaleDateString("ja-JP")}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button variant="ghost" size="sm" asChild>
                                <Link href={`/admin/documents/${doc.id}`}>
                                  <Eye className="h-4 w-4" />
                                </Link>
                              </Button>
                              <Button variant="ghost" size="sm" asChild>
                                <Link href={`/admin/documents/${doc.id}/edit`}>
                                  <Edit className="h-4 w-4" />
                                </Link>
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>

                {/* ページネーション */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between pt-4">
                    <p className="text-sm text-muted-foreground">
                      全{total}件中 {(currentPage - 1) * limit + 1}〜
                      {Math.min(currentPage * limit, total)}件
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => goToPage(currentPage - 1)}
                        disabled={currentPage <= 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                        前へ
                      </Button>
                      <span className="text-sm">
                        {currentPage} / {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => goToPage(currentPage + 1)}
                        disabled={currentPage >= totalPages}
                      >
                        次へ
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function PoliciesPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center">読み込み中...</div>}>
      <PoliciesContent />
    </Suspense>
  );
}
