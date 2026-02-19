"use client";

import { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
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

export default function EditDocumentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [changeNote, setChangeNote] = useState("");
  const [selectedDeps, setSelectedDeps] = useState<DocumentOption[]>([]);
  const [allDocuments, setAllDocuments] = useState<DocumentOption[]>([]);
  const [isPdfLoading, setIsPdfLoading] = useState(false);

  const fetchDocument = useCallback(async () => {
    try {
      const res = await fetch(`/api/documents/${resolvedParams.id}`);
      if (!res.ok) throw new Error("取得失敗");
      const doc = await res.json();
      setTitle(doc.title);
      setContent(doc.content);
      setSelectedDeps(
        (doc.dependencies || []).map((d: { dependencyDoc: DocumentOption }) => d.dependencyDoc)
      );
    } catch {
      toast.error("文書の取得に失敗しました");
    } finally {
      setIsFetching(false);
    }
  }, [resolvedParams.id]);

  useEffect(() => {
    fetchDocument();
    // 他の文書一覧を取得（依存先選択用）
    fetch("/api/documents?limit=100")
      .then((r) => r.json())
      .then((data) => {
        setAllDocuments(
          (data.documents || [])
            .filter((d: { id: string }) => d.id !== resolvedParams.id)
            .map((d: { id: string; title: string }) => ({ id: d.id, title: d.title }))
        );
      })
      .catch(() => {});
  }, [fetchDocument, resolvedParams.id]);

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsPdfLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/documents/${resolvedParams.id}/pdf-extract`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("PDF抽出失敗");
      const data = await res.json();
      // 本文に追記
      setContent((prev) => prev + (prev ? "\n\n---\n\n" : "") + data.text);
      toast.success("PDFからテキストを抽出しました");
    } catch {
      toast.error("PDF抽出に失敗しました");
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

  const handleSave = async () => {
    if (!title.trim() || !content.trim()) {
      toast.error("タイトルと本文は必須です");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`/api/documents/${resolvedParams.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          content,
          changeNote: changeNote || "内容更新",
          dependencyIds: selectedDeps.map((d) => d.id),
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "更新失敗");
      }
      toast.success("保存しました。矛盾チェックを非同期で実行中です。");
      router.push(`/admin/documents/${resolvedParams.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存に失敗しました");
    } finally {
      setIsLoading(false);
    }
  };

  if (isFetching) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const availableToAdd = allDocuments.filter(
    (d) => !selectedDeps.some((s) => s.id === d.id)
  );

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/admin/documents/${resolvedParams.id}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            詳細に戻る
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="text-3xl font-bold">文書を編集</h1>
        <p className="text-muted-foreground mt-1">保存後、非同期で矛盾チェックが実行されます</p>
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
                  PDFから追記
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

          <div className="space-y-2">
            <Label htmlFor="changeNote">変更メモ</Label>
            <Input
              id="changeNote"
              value={changeNote}
              onChange={(e) => setChangeNote(e.target.value)}
              placeholder="変更内容の説明（オプション）"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>依存先文書</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 選択済み */}
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

          {/* 追加可能な文書 */}
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
          <Link href={`/admin/documents/${resolvedParams.id}`}>キャンセル</Link>
        </Button>
        <Button onClick={handleSave} disabled={isLoading}>
          {isLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          保存
        </Button>
      </div>
    </div>
  );
}
