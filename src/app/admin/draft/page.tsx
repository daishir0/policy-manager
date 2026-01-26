"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Lightbulb, Wand2, Copy, FileText, RefreshCw, CheckCircle } from "lucide-react";

interface DraftResult {
  draft: string;
  referencedDocuments: Array<{
    id: string;
    title: string;
    relevance: number;
  }>;
}

export default function DraftPage() {
  const [idea, setIdea] = useState("");
  const [additionalContext, setAdditionalContext] = useState("");
  const [result, setResult] = useState<DraftResult | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    if (!idea.trim()) {
      setError("アイディアを入力してください");
      return;
    }

    setGenerating(true);
    setError(null);

    try {
      const response = await fetch("/api/ai/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea, additionalContext }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "文案の生成に失敗しました");
      }

      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setGenerating(false);
    }
  };

  const handleRegenerate = async () => {
    if (!result?.draft || !feedback.trim()) {
      setError("修正指示を入力してください");
      return;
    }

    setGenerating(true);
    setError(null);

    try {
      const response = await fetch("/api/ai/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          regenerate: true,
          originalDraft: result.draft,
          feedback,
          referencedDocumentIds: result.referencedDocuments.map((d) => d.id),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "再生成に失敗しました");
      }

      const data = await response.json();
      setResult(data);
      setFeedback("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = async () => {
    if (result?.draft) {
      await navigator.clipboard.writeText(result.draft);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCreateDocument = () => {
    if (result?.draft) {
      const encodedContent = encodeURIComponent(result.draft);
      window.location.href = `/admin/documents/new?content=${encodedContent}`;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">文案生成</h1>
        <p className="text-muted-foreground">
          アイディアを入力するとAIが文書案を生成します
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* 入力エリア */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5" />
                アイディア入力
              </CardTitle>
              <CardDescription>
                作成したい文書のアイディアや要点を入力してください
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="idea">アイディア・要点 *</Label>
                <Textarea
                  id="idea"
                  placeholder="例: 在宅勤務に関するガイドラインを作成したい。週2日まで在宅勤務可能とし、事前申請が必要。セキュリティ対策として、会社支給のPCのみ使用可..."
                  className="min-h-[150px]"
                  value={idea}
                  onChange={(e) => setIdea(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="context">追加コンテキスト（任意）</Label>
                <Textarea
                  id="context"
                  placeholder="参考にしたい既存の規定や、特に考慮すべき点があれば記入してください"
                  className="min-h-[80px]"
                  value={additionalContext}
                  onChange={(e) => setAdditionalContext(e.target.value)}
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button
                onClick={handleGenerate}
                disabled={generating || !idea.trim()}
                className="w-full"
              >
                <Wand2 className={`mr-2 h-4 w-4 ${generating ? "animate-spin" : ""}`} />
                {generating ? "生成中..." : "文案を生成"}
              </Button>
            </CardContent>
          </Card>

          {/* 再生成エリア */}
          {result && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <RefreshCw className="h-5 w-5" />
                  修正・再生成
                </CardTitle>
                <CardDescription>
                  生成された文案に対する修正指示を入力してください
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  placeholder="例: もう少し具体的な手順を追加してください。また、例外ケースについても記載してください。"
                  className="min-h-[80px]"
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                />
                <Button
                  onClick={handleRegenerate}
                  disabled={generating || !feedback.trim()}
                  variant="outline"
                  className="w-full"
                >
                  <RefreshCw className={`mr-2 h-4 w-4 ${generating ? "animate-spin" : ""}`} />
                  {generating ? "再生成中..." : "指示に基づいて再生成"}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* 結果エリア */}
        <div className="space-y-4">
          <Card className="h-full">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    生成された文案
                  </CardTitle>
                  <CardDescription>
                    AIが生成した文書案を確認・編集できます
                  </CardDescription>
                </div>
                {result && (
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={handleCopy}>
                      {copied ? (
                        <>
                          <CheckCircle className="mr-1 h-4 w-4 text-green-500" />
                          コピー済み
                        </>
                      ) : (
                        <>
                          <Copy className="mr-1 h-4 w-4" />
                          コピー
                        </>
                      )}
                    </Button>
                    <Button size="sm" onClick={handleCreateDocument}>
                      <FileText className="mr-1 h-4 w-4" />
                      文書として作成
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {result ? (
                <div className="space-y-4">
                  <div className="rounded-lg border bg-muted/50 p-4">
                    <pre className="whitespace-pre-wrap text-sm">{result.draft}</pre>
                  </div>
                  {result.referencedDocuments && result.referencedDocuments.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium mb-2">参照した既存文書</h4>
                      <div className="space-y-2">
                        {result.referencedDocuments.map((doc) => (
                          <a
                            key={doc.id}
                            href={`/admin/documents/${doc.id}`}
                            className="flex items-center justify-between rounded-lg border p-2 hover:bg-accent transition-colors"
                          >
                            <span className="text-sm">{doc.title}</span>
                            <span className="text-xs text-muted-foreground">
                              関連度: {(doc.relevance * 100).toFixed(0)}%
                            </span>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Wand2 className="h-12 w-12 mb-4" />
                  <p>アイディアを入力して文案を生成してください</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
