"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Save, Loader2, Upload, X } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { DependencyTreeSelector } from "@/components/dependency-tree-selector";

interface SelectedDependency {
  id: string;
  title: string;
  isMain: boolean;
}

function NewDocumentContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [title, setTitle] = useState(searchParams.get("title") || "");
  const [content, setContent] = useState(searchParams.get("content") || "");
  const [selectedDeps, setSelectedDeps] = useState<SelectedDependency[]>([]);
  const [isPdfLoading, setIsPdfLoading] = useState(false);
  const pendingDepIds = useRef<string[]>([]);

  // sessionStorageからの復元（文案生成からの遷移）
  useEffect(() => {
    const saved = sessionStorage.getItem("draftData");
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (data.title) setTitle(data.title);
        if (data.content) setContent(data.content);
        if (Array.isArray(data.dependencyIds) && data.dependencyIds.length > 0) {
          // 文書タイトルを取得して依存先を設定
          fetch("/api/documents?limit=1000")
            .then((r) => r.json())
            .then((docsData) => {
              const docs = docsData.documents || [];
              const matched = data.dependencyIds
                .map((id: string, index: number) => {
                  const doc = docs.find((d: { id: string; title: string }) => d.id === id);
                  return doc ? { id: doc.id, title: doc.title, isMain: index === 0 } : null;
                })
                .filter(Boolean) as SelectedDependency[];
              if (matched.length > 0) setSelectedDeps(matched);
            })
            .catch(() => {});
        }
        sessionStorage.removeItem("draftData");
      } catch {}
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsPdfLoading(true);
    try {
      // 新規作成前なので一時的なIDを使用
      const formData = new FormData();
      formData.append("file", file);
      // pdf-extractエンドポイントは文書IDが必要なので、
      // 新規作成時はフォームリーダーでテキストを読む（PDF解析は保存後に利用）
      toast.info("新規作成時のPDF抽出は保存後に利用できます。テキストを手動で入力してください。");
    } catch {
      toast.error("PDF処理に失敗しました");
    } finally {
      setIsPdfLoading(false);
      e.target.value = "";
    }
  };

  const handleCreate = async () => {
    if (!title.trim() || !content.trim()) {
      toast.error("タイトルと本文は必須です");
      return;
    }

    setIsLoading(true);
    try {
      // メイン依存先を先頭にして送信（APIで最初の要素がisMain=trueになる）
      const sortedDeps = [...selectedDeps].sort((a, b) => (b.isMain ? 1 : 0) - (a.isMain ? 1 : 0));
      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          content,
          dependencyIds: sortedDeps.map((d) => d.id),
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "作成失敗");
      }
      const doc = await res.json();
      toast.success("文書を作成しました");
      router.push(`/admin/documents/${doc.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "作成に失敗しました");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/admin/policies">
            <ArrowLeft className="mr-2 h-4 w-4" />
            一覧に戻る
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="text-3xl font-bold">新規文書作成</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>基本情報</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">タイトル *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="文書タイトル"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="content">本文 *</Label>
              <div className="flex items-center gap-2">
                <Label
                  htmlFor="pdf-upload"
                  className="cursor-pointer flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                >
                  {isPdfLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  PDFから読み込み
                </Label>
                <input
                  id="pdf-upload"
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={handlePdfUpload}
                  disabled={isPdfLoading}
                />
              </div>
            </div>
            <Textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Markdownで記述できます"
              className="min-h-[400px] font-mono text-sm"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>依存先文書</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {selectedDeps.length > 0 && (
            <div className="mb-4 p-3 bg-muted/50 rounded-lg">
              <p className="text-sm font-medium mb-2">選択中:</p>
              <div className="space-y-1">
                {selectedDeps.map((dep) => (
                  <div key={dep.id} className="flex items-center gap-2 text-sm">
                    <span className={dep.isMain ? "text-blue-600 font-medium" : "text-muted-foreground"}>
                      {dep.isMain ? "● メイン:" : "○ サブ:"}
                    </span>
                    <span>{dep.title}</span>
                    <button
                      onClick={() => {
                        const newDeps = selectedDeps.filter(d => d.id !== dep.id);
                        if (dep.isMain && newDeps.length > 0) {
                          newDeps[0].isMain = true;
                        }
                        setSelectedDeps(newDeps);
                      }}
                      className="ml-auto text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          <DependencyTreeSelector
            selectedDeps={selectedDeps}
            onChange={setSelectedDeps}
          />
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button variant="outline" asChild>
          <Link href="/admin/policies">キャンセル</Link>
        </Button>
        <Button onClick={handleCreate} disabled={isLoading}>
          {isLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          作成
        </Button>
      </div>
    </div>
  );
}

export default function NewDocumentPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center">読み込み中...</div>}>
      <NewDocumentContent />
    </Suspense>
  );
}
