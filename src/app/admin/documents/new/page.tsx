"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Save, Loader2, CheckCircle } from "lucide-react";
import Link from "next/link";

export default function NewDocumentPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [summary, setSummary] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    setSuccess(false);

    try {
      const response = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          content,
          summary,
          categoryIds: categoryId ? [categoryId] : [],
        }),
      });

      if (response.ok) {
        const document = await response.json();
        setSuccess(true);
        setTimeout(() => {
          router.push(`/admin/documents/${document.id}`);
        }, 1500);
      } else {
        const data = await response.json();
        setError(data.error || "文書の作成に失敗しました");
      }
    } catch {
      setError("文書の作成に失敗しました");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/documents">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">新規文書作成</h1>
          <p className="text-muted-foreground">
            新しい文書を作成します
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>文書情報</CardTitle>
            <CardDescription>
              文書のタイトルと内容を入力してください
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                {error}
              </div>
            )}

            {success && (
              <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                文書を保存しました
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="title">タイトル</Label>
              <Input
                id="title"
                name="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="文書のタイトルを入力"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="summary">概要</Label>
              <Textarea
                id="summary"
                name="summary"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="文書の概要を入力"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">カテゴリ</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger>
                  <SelectValue placeholder="カテゴリを選択" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default-category-1">通達</SelectItem>
                  <SelectItem value="default-category-2">方針書</SelectItem>
                  <SelectItem value="default-category-3">事業計画書</SelectItem>
                  <SelectItem value="default-category-4">ハンドブック</SelectItem>
                  <SelectItem value="default-category-5">マニュアル</SelectItem>
                  <SelectItem value="default-category-6">規程</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="content">本文</Label>
              <div className="border rounded-md p-4 min-h-[300px]">
                <Textarea
                  id="content"
                  name="content"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="文書の本文を入力（Markdown形式対応）"
                  className="min-h-[280px] border-0 focus-visible:ring-0 p-0 resize-none ProseMirror"
                  required
                />
              </div>
            </div>

            <div className="flex justify-end gap-4">
              <Link href="/admin/documents">
                <Button variant="outline" type="button">
                  キャンセル
                </Button>
              </Link>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    保存中...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    保存
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
