"use client";

import { useState } from "react";
import { Search, SortAsc, FileText } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

type SearchResult = {
  id: string;
  title: string;
  summary: string | null;
  status: string;
  updatedAt: string;
  categories: { name: string }[];
};

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState("relevance");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;

    setIsLoading(true);
    setHasSearched(true);

    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(query)}&sortBy=${sortBy}`);
      if (response.ok) {
        const data = await response.json();
        setResults(data.documents || []);
      }
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PUBLISHED":
        return <Badge variant="default">公開中</Badge>;
      case "DRAFT":
        return <Badge variant="secondary">下書き</Badge>;
      case "RETIRED":
        return <Badge variant="outline">廃止</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">検索</h1>
        <p className="text-muted-foreground">
          キーワードで文書を検索できます
        </p>
      </div>

      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="検索キーワードを入力..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="pl-10"
          />
        </div>
        <div className="relative">
          <SortAsc className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <select
            name="sort"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="h-10 w-[180px] pl-10 pr-4 border rounded-md bg-background appearance-none cursor-pointer"
          >
            <option value="relevance">関連度順</option>
            <option value="updatedAt">更新日順</option>
            <option value="title">タイトル順</option>
          </select>
        </div>
        <Button onClick={handleSearch} disabled={isLoading}>
          {isLoading ? "検索中..." : "検索"}
        </Button>
      </div>

      {hasSearched && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {results.length}件の検索結果
          </p>

          {results.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>検索結果が見つかりませんでした</p>
                <p className="text-sm mt-2">別のキーワードで検索してみてください</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4" data-testid="search-results">
              {results.map((doc) => (
                <Link key={doc.id} href={`/admin/documents/${doc.id}`}>
                  <Card data-testid="search-result-item" className="cursor-pointer hover:bg-accent transition-colors">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg hover:underline">
                            {doc.title}
                          </CardTitle>
                          <CardDescription className="mt-1">
                            {doc.summary || "説明なし"}
                          </CardDescription>
                        </div>
                        {getStatusBadge(doc.status)}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>
                          更新日: {new Date(doc.updatedAt).toLocaleDateString("ja-JP")}
                        </span>
                        {doc.categories.length > 0 && (
                          <div className="flex gap-1">
                            {doc.categories.map((cat) => (
                              <Badge key={cat.name} variant="outline" className="text-xs">
                                {cat.name}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
