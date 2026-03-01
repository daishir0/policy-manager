"use client";

import { useState, useEffect, useCallback, use } from "react";
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
import { AIDocumentChat } from "@/components/ai-document-chat";

interface SelectedDependency {
  id: string;
  title: string;
  isMain: boolean;
}

export default function EditDocumentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const contradictionSuggestion = searchParams.get("contradictionSuggestion") || "";
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [changeNote, setChangeNote] = useState("");
  const [selectedDeps, setSelectedDeps] = useState<SelectedDependency[]>([]);
  const [isPdfLoading, setIsPdfLoading] = useState(false);

  const fetchDocument = useCallback(async () => {
    try {
      const res = await fetch(`/api/documents/${resolvedParams.id}`);
      if (!res.ok) throw new Error("取得失敗");
      const doc = await res.json();
      setTitle(doc.title);
      setContent(doc.content);
      // isMainフラグを含む依存先リストを設定
      setSelectedDeps(
        (doc.dependencies || []).map((d: { isMain?: boolean; dependencyDoc: { id: string; title: string } }, index: number) => ({
          id: d.dependencyDoc.id,
          title: d.dependencyDoc.title,
          isMain: d.isMain ?? index === 0,
        }))
      );
    } catch {
      toast.error("文書の取得に失敗しました");
    } finally {
      setIsFetching(false);
    }
  }, [resolvedParams.id]);

  useEffect(() => {
    fetchDocument();
  }, [fetchDocument]);

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

  const handleSave = async () => {
    if (!title.trim() || !content.trim()) {
      toast.error("タイトルと本文は必須です");
      return;
    }

    setIsLoading(true);
    try {
      // メイン依存先を先頭にして送信（APIで最初の要素がisMain=trueになる）
      const sortedDeps = [...selectedDeps].sort((a, b) => (b.isMain ? 1 : 0) - (a.isMain ? 1 : 0));
      const res = await fetch(`/api/documents/${resolvedParams.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          content,
          changeNote: changeNote || "内容更新",
          dependencyIds: sortedDeps.map((d) => d.id),
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

  const handleApplySuggestion = (newContent: string) => {
    setContent(newContent);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/admin/documents/${resolvedParams.id}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            詳細に戻る
          </Link>
        </Button>
        <div className="flex gap-3">
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

      <div>
        <h1 className="text-2xl font-bold">文書を編集</h1>
        <p className="text-muted-foreground text-sm">保存後、非同期で矛盾チェックが実行されます</p>
      </div>

      {/* 2ペインレイアウト */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* 左ペイン: エディタ (60%) */}
        <div className="lg:col-span-3 space-y-4">
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-base">基本情報</CardTitle>
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
            <CardHeader className="py-3">
              <CardTitle className="text-base">依存先文書</CardTitle>
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
                excludeDocId={resolvedParams.id}
              />
            </CardContent>
          </Card>
        </div>

        {/* 右ペイン: AIチャット (40%) */}
        <div className="lg:col-span-2 lg:sticky lg:top-4 lg:self-start">
          <AIDocumentChat
            documentId={resolvedParams.id}
            currentContent={content}
            onApplySuggestion={handleApplySuggestion}
            initialInput={contradictionSuggestion}
          />
        </div>
      </div>
    </div>
  );
}
