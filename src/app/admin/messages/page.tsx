"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Inbox, CheckCheck, FileText, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface Message {
  id: string;
  content: string;
  readAt: string | null;
  createdAt: string;
  document: { id: string; title: string } | null;
}

export default function MessagesPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch("/api/messages");
      if (!res.ok) throw new Error("取得失敗");
      const data = await res.json();
      setMessages(data);
    } catch {
      toast.error("メッセージの取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  const markAsRead = async (id: string) => {
    try {
      const res = await fetch(`/api/messages/${id}/read`, { method: "POST" });
      if (!res.ok) throw new Error("既読処理失敗");
      setMessages((prev) =>
        prev.map((m) =>
          m.id === id ? { ...m, readAt: new Date().toISOString() } : m
        )
      );
      toast.success("既読にしました");
    } catch {
      toast.error("既読処理に失敗しました");
    }
  };

  const markAllAsRead = async () => {
    const unread = messages.filter((m) => !m.readAt);
    await Promise.all(unread.map((m) => markAsRead(m.id)));
  };

  const unreadCount = messages.filter((m) => !m.readAt).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Inbox className="h-7 w-7" />
          <div>
            <h1 className="text-2xl font-bold">受信箱</h1>
            <p className="text-sm text-muted-foreground">
              {unreadCount > 0 ? `未読 ${unreadCount} 件` : "未読メッセージなし"}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchMessages}>
            <RefreshCw className="h-4 w-4 mr-1" />
            更新
          </Button>
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={markAllAsRead}>
              <CheckCheck className="h-4 w-4 mr-1" />
              全て既読
            </Button>
          )}
        </div>
      </div>

      {messages.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Inbox className="h-12 w-12 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">メッセージはありません</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {messages.map((message) => (
            <Card
              key={message.id}
              className={`transition-colors ${!message.readAt ? "border-blue-200 bg-blue-50/30 dark:bg-blue-950/10" : ""}`}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {!message.readAt && (
                      <Badge variant="default" className="bg-blue-500 text-xs">未読</Badge>
                    )}
                    <span className="text-sm text-muted-foreground">
                      {new Date(message.createdAt).toLocaleString("ja-JP")}
                    </span>
                  </div>
                  {!message.readAt && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => markAsRead(message.id)}
                      className="h-7 text-xs"
                    >
                      <CheckCheck className="h-3 w-3 mr-1" />
                      既読
                    </Button>
                  )}
                </div>
                {message.document && (
                  <div className="flex items-center gap-1 text-sm">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <Link
                      href={`/admin/documents/${message.document.id}`}
                      className="text-blue-600 hover:underline font-medium"
                    >
                      {message.document.title}
                    </Link>
                  </div>
                )}
              </CardHeader>
              <CardContent>
                <CardTitle className="text-sm font-normal whitespace-pre-wrap leading-relaxed">
                  {message.content}
                </CardTitle>
                {message.readAt && (
                  <p className="text-xs text-muted-foreground mt-2">
                    既読: {new Date(message.readAt).toLocaleString("ja-JP")}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
