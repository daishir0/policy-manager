"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Settings, Cpu, Globe, CheckCircle, RefreshCw, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

const MODEL_OPTIONS = [
  { value: "haiku", label: "Claude 3.5 Haiku", description: "高速・低コスト" },
  { value: "sonnet", label: "Claude 3.5 Sonnet", description: "バランス型" },
  { value: "sonnet4", label: "Claude Sonnet 4", description: "高性能" },
  { value: "opus", label: "Claude 3 Opus", description: "最高性能" },
];

export default function SettingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // 設定値
  const [apiKeyDisplay, setApiKeyDisplay] = useState("");
  const [apiKeySet, setApiKeySet] = useState(false);
  const [newApiKey, setNewApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [selectedModel, setSelectedModel] = useState("haiku");

  useEffect(() => {
    if (status === "loading") return;
    if (!session || session.user.role !== "ADMIN") {
      router.replace("/admin");
    }
  }, [session, status, router]);

  useEffect(() => {
    if (!session || session.user.role !== "ADMIN") return;
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        setApiKeyDisplay(data.ANTHROPIC_API_KEY || "");
        setApiKeySet(data.ANTHROPIC_API_KEY_SET || false);
        setSelectedModel(data.CLAUDE_MODEL || "haiku");
      })
      .catch(() => toast.error("設定の取得に失敗しました"))
      .finally(() => setLoading(false));
  }, [session]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const body: Record<string, string> = {
        CLAUDE_MODEL: selectedModel,
      };
      // APIキーが入力された場合のみ更新
      if (newApiKey.trim()) {
        body.ANTHROPIC_API_KEY = newApiKey.trim();
      }

      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error("保存失敗");

      toast.success("設定を保存しました");

      // 再取得して表示を更新
      const updated = await fetch("/api/settings").then((r) => r.json());
      setApiKeyDisplay(updated.ANTHROPIC_API_KEY || "");
      setApiKeySet(updated.ANTHROPIC_API_KEY_SET || false);
      setSelectedModel(updated.CLAUDE_MODEL || "haiku");
      setNewApiKey("");
    } catch {
      toast.error("設定の保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Settings className="h-8 w-8" />
          設定
        </h1>
        <p className="text-muted-foreground">システム設定を管理します</p>
      </div>

      <div className="grid gap-6">
        {/* システム情報 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Cpu className="h-5 w-5" />
              システム情報
            </CardTitle>
            <CardDescription>現在のシステム構成</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-muted-foreground">アプリケーション</Label>
                <div className="flex items-center gap-2">
                  <span className="font-medium">Policy Manager v2.0</span>
                  <Badge variant="default">本番</Badge>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-muted-foreground">フレームワーク</Label>
                <span className="font-medium">Next.js 16 / React 19</span>
              </div>
              <div className="space-y-1">
                <Label className="text-muted-foreground">データベース</Label>
                <span className="font-medium">PostgreSQL + pgvector</span>
              </div>
              <div className="space-y-1">
                <Label className="text-muted-foreground">認証</Label>
                <span className="font-medium">NextAuth.js (JWT)</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Claude API連携 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Claude API 連携
            </CardTitle>
            <CardDescription>
              AIによるQ&A対話、文案生成、矛盾チェックに使用するAPIの設定
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* 接続状態 */}
            <div className="flex items-center gap-2">
              <Label className="text-muted-foreground">接続状態:</Label>
              {apiKeySet ? (
                <Badge variant="default" className="bg-green-600">接続済み</Badge>
              ) : (
                <Badge variant="destructive">未設定</Badge>
              )}
            </div>

            {/* APIキー */}
            <div className="space-y-2">
              <Label htmlFor="api-key">API Key</Label>
              {apiKeySet && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>現在の設定値: {apiKeyDisplay}</span>
                </div>
              )}
              <div className="relative">
                <Input
                  id="api-key"
                  type={showApiKey ? "text" : "password"}
                  value={newApiKey}
                  onChange={(e) => setNewApiKey(e.target.value)}
                  placeholder={apiKeySet ? "変更する場合のみ入力..." : "sk-ant-api03-..."}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Anthropic Console から取得したAPIキーを入力してください
              </p>
            </div>

            {/* モデル選択 */}
            <div className="space-y-2">
              <Label>使用モデル</Label>
              <Select value={selectedModel} onValueChange={setSelectedModel}>
                <SelectTrigger className="w-72">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MODEL_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <span>{opt.label}</span>
                      <span className="ml-2 text-muted-foreground text-xs">({opt.description})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Q&A・文案生成・矛盾チェック等で使用するモデルを選択
              </p>
            </div>
          </CardContent>
        </Card>

        {/* 保存ボタン */}
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle className="mr-2 h-4 w-4" />
            )}
            設定を保存
          </Button>
        </div>
      </div>
    </div>
  );
}
