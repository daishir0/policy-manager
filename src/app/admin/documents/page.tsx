"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
import { Plus, FileText, Edit, Eye, Search, X, ChevronLeft, ChevronRight, ChevronDown, Wand2 } from "lucide-react";

interface Document {
  id: string;
  title: string;
  status: string;
  currentVersion: string;
  createdBy: { name: string | null; email: string };
  assignee: { name: string | null; email: string } | null;
  updatedAt: string;
}

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

export default function DocumentsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState(searchParams.get("search") || "");

  const currentSearch = searchParams.get("search") || "";
  const currentStatus = searchParams.get("status") || "";
  const currentPage = parseInt(searchParams.get("page") || "1");
  const limit = 20;
  const totalPages = Math.ceil(total / limit);

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
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
      setLoading(false);
    }
  }, [currentSearch, currentStatus, currentPage]);

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
    router.push(`/admin/documents?${params}`);
  };

  const clearSearch = () => {
    setSearchInput("");
    const params = new URLSearchParams(searchParams.toString());
    params.delete("search");
    params.set("page", "1");
    router.push(`/admin/documents?${params}`);
  };

  const setStatus = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== "all") {
      params.set("status", value);
    } else {
      params.delete("status");
    }
    params.set("page", "1");
    router.push(`/admin/documents?${params}`);
  };

  const goToPage = (page: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(page));
    router.push(`/admin/documents?${params}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">文書一覧</h1>
          <p className="text-muted-foreground">登録されている文書を管理します</p>
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
              <Button onClick={applySearch} variant="secondary">検索</Button>
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
            文書 ({loading ? "..." : total}件)
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
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    読み込み中...
                  </TableCell>
                </TableRow>
              ) : documents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    {currentSearch ? "該当する文書が見つかりませんでした" : "文書がまだ登録されていません"}
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
                      {doc.assignee?.name || doc.assignee?.email || doc.createdBy.name || doc.createdBy.email}
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
                全{total}件中 {(currentPage - 1) * limit + 1}〜{Math.min(currentPage * limit, total)}件
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
  );
}
