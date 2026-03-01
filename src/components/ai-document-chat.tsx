"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { DiffViewer } from "@/components/diff-viewer";
import { MessageSquare, Send, Check, X, Loader2, Wand2 } from "lucide-react";
import { toast } from "sonner";

interface AIDocumentChatProps {
  documentId: string;
  currentContent: string;
  onApplySuggestion: (newContent: string) => void;
  initialInput?: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  suggestion?: string;  // AI提案の新しい本文
}

export function AIDocumentChat({
  documentId,
  currentContent,
  onApplySuggestion,
  initialInput = "",
}: AIDocumentChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState(initialInput);
  const [loading, setLoading] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState<string | null>(null);

  // initialInputが変更されたら反映（ページ遷移時）
  useEffect(() => {
    if (initialInput) {
      setInput(initialInput);
    }
  }, [initialInput]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setLoading(true);

    try {
      const res = await fetch("/api/ai/suggest-edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId,
          currentContent,
          instruction: userMessage,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "提案の取得に失敗しました");
      }

      const data = await res.json();

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.explanation || "以下の変更を提案します。",
          suggestion: data.suggestedContent,
        },
      ]);

      if (data.suggestedContent) {
        setActiveSuggestion(data.suggestedContent);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "エラーが発生しました");
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "申し訳ございません。提案の生成に失敗しました。" },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    if (activeSuggestion) {
      onApplySuggestion(activeSuggestion);
      setActiveSuggestion(null);
      toast.success("提案を適用しました");
    }
  };

  const handleReject = () => {
    setActiveSuggestion(null);
    toast.info("提案を却下しました");
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Wand2 className="h-5 w-5" />
          AI編集アシスタント
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col gap-4 overflow-hidden">
        {/* チャット履歴 */}
        <div className="flex-1 overflow-y-auto space-y-3 min-h-0">
          {messages.length === 0 ? (
            <div className="text-center text-muted-foreground text-sm py-8">
              <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>編集の指示を入力してください</p>
              <p className="text-xs mt-1">例: 「冒頭に目的セクションを追加して」</p>
            </div>
          ) : (
            messages.map((msg, i) => (
              <div
                key={i}
                className={`text-sm p-3 rounded-lg ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground ml-8"
                    : "bg-muted mr-8"
                }`}
              >
                {msg.content}
              </div>
            ))
          )}
          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground p-3">
              <Loader2 className="h-4 w-4 animate-spin" />
              提案を生成中...
            </div>
          )}
        </div>

        {/* 差分表示 */}
        {activeSuggestion && (
          <div className="border rounded-lg overflow-hidden">
            <div className="bg-muted px-3 py-2 text-sm font-medium flex items-center justify-between">
              <span>変更内容のプレビュー</span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleReject}
                  className="h-7 px-2"
                >
                  <X className="h-3 w-3 mr-1" />
                  却下
                </Button>
                <Button
                  size="sm"
                  onClick={handleApply}
                  className="h-7 px-2"
                >
                  <Check className="h-3 w-3 mr-1" />
                  適用
                </Button>
              </div>
            </div>
            <div className="max-h-48 overflow-y-auto">
              <DiffViewer oldText={currentContent} newText={activeSuggestion} />
            </div>
          </div>
        )}

        {/* 入力エリア */}
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="編集の指示を入力..."
            className="min-h-[80px] resize-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                handleSend();
              }
            }}
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="self-end"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
