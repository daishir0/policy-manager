"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Save, Loader2, Upload, X, Plus } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

interface DocumentOption {
  id: string;
  title: string;
}

function NewDocumentContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [title, setTitle] = useState(searchParams.get("title") || "");
  const [content, setContent] = useState(searchParams.get("content") || "");
  const [selectedDeps, setSelectedDeps] = useState<DocumentOption[]>([]);
  const [allDocuments, setAllDocuments] = useState<DocumentOption[]>([]);
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
        if (Array.isArray(data.dependencyIds)) {
          pendingDepIds.current = data.dependencyIds;
        }
        sessionStorage.removeItem("draftData");
      } catch {}
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetch("/api/documents?limit=100")
      .then((r) => r.json())
      .then((data) => {
        const docs = (data.documents || []).map((d: DocumentOption) => ({ id: d.id, title: d.title }));
        setAllDocuments(docs);
        // 文案生成からの依存先IDを自動セット
        if (pendingDepIds.current.length > 0) {
          const matched = docs.filter((d: DocumentOption) => pendingDepIds.current.includes(d.id));
          if (matched.length > 0) setSelectedDeps(matched);
          pendingDepIds.current = [];
        }
      })
      .catch(() => {});
  }, []);

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

  const toggleDep = (doc: DocumentOption) => {
    setSelectedDeps((prev) => {
      if (prev.some((d) => d.id === doc.id)) {
        return prev.filter((d) => d.id !== doc.id);
      }
      return [...prev, doc];
    });
  };

  const handleCreate = async () => {
    if (!title.trim() || !content.trim()) {
      toast.error("タイトルと本文は必須です");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          content,
          dependencyIds: selectedDeps.map((d) => d.id),
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

  const availableToAdd = allDocuments.filter(
    (d) => !selectedDeps.some((s) => s.id === d.id)
  );

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/admin/documents">
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
            <div className="flex flex-wrap gap-2">
              {selectedDeps.map((dep) => (
                <Badge key={dep.id} variant="secondary" className="gap-1 pr-1">
                  {dep.title}
                  <button onClick={() => toggleDep(dep)} className="ml-1 hover:text-destructive">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
          {availableToAdd.length > 0 && (
            <div>
              <p className="text-sm text-muted-foreground mb-2">依存先を追加:</p>
              <div className="max-h-48 overflow-y-auto border rounded-md p-2 space-y-1">
                {availableToAdd.map((doc) => (
                  <button
                    key={doc.id}
                    onClick={() => toggleDep(doc)}
                    className="w-full text-left px-3 py-1.5 text-sm rounded hover:bg-accent flex items-center gap-2"
                  >
                    <Plus className="h-3 w-3 text-muted-foreground" />
                    {doc.title}
                  </button>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button variant="outline" asChild>
          <Link href="/admin/documents">キャンセル</Link>
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
