"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Settings, Shield, Database, Cpu, Globe, Bell, CheckCircle } from "lucide-react";

export default function SettingsPage() {
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">設定</h1>
        <p className="text-muted-foreground">
          システム設定を管理します
        </p>
      </div>

      {saved && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded flex items-center gap-2">
          <CheckCircle className="h-4 w-4" />
          設定を保存しました
        </div>
      )}

      <div className="grid gap-6">
        {/* システム情報 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Cpu className="h-5 w-5" />
              システム情報
            </CardTitle>
            <CardDescription>
              現在のシステム構成を確認できます
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-muted-foreground">バージョン</Label>
                <div className="flex items-center gap-2">
                  <span className="font-medium">Policy Manager v1.0.0</span>
                  <Badge variant="secondary">Stable</Badge>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-muted-foreground">環境</Label>
                <div className="flex items-center gap-2">
                  <span className="font-medium">Production</span>
                  <Badge variant="default">本番</Badge>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-muted-foreground">データベース</Label>
                <span className="font-medium">PostgreSQL + pgvector</span>
              </div>
              <div className="space-y-1">
                <Label className="text-muted-foreground">AI モデル</Label>
                <span className="font-medium">Claude API</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* セキュリティ設定 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              セキュリティ設定
            </CardTitle>
            <CardDescription>
              認証とセキュリティの設定を管理します
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="session-timeout">セッションタイムアウト（分）</Label>
                <Input
                  id="session-timeout"
                  type="number"
                  defaultValue="60"
                  min="5"
                  max="1440"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="max-login-attempts">最大ログイン試行回数</Label>
                <Input
                  id="max-login-attempts"
                  type="number"
                  defaultValue="5"
                  min="3"
                  max="10"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lockout-duration">アカウントロック時間（分）</Label>
                <Input
                  id="lockout-duration"
                  type="number"
                  defaultValue="30"
                  min="5"
                  max="1440"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="min-password-length">最小パスワード長</Label>
                <Input
                  id="min-password-length"
                  type="number"
                  defaultValue="8"
                  min="6"
                  max="32"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 通知設定 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              通知設定
            </CardTitle>
            <CardDescription>
              メール通知の設定を管理します
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="smtp-host">SMTPサーバー</Label>
                <Input
                  id="smtp-host"
                  type="text"
                  placeholder="smtp.example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="smtp-port">ポート</Label>
                <Input
                  id="smtp-port"
                  type="number"
                  defaultValue="587"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="smtp-user">ユーザー名</Label>
                <Input
                  id="smtp-user"
                  type="text"
                  placeholder="user@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="from-email">送信元メールアドレス</Label>
                <Input
                  id="from-email"
                  type="email"
                  placeholder="noreply@example.com"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 外部連携 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              外部連携
            </CardTitle>
            <CardDescription>
              外部サービスとの連携を設定します
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Claude API</Label>
                <div className="flex items-center gap-2">
                  <Badge variant="default" className="bg-green-500">接続済み</Badge>
                  <span className="text-sm text-muted-foreground">claude-3-5-sonnet</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label>OpenAI API</Label>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">未設定</Badge>
                  <span className="text-sm text-muted-foreground">オプション</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label>SSO (SAML)</Label>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">未設定</Badge>
                  <span className="text-sm text-muted-foreground">オプション</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Slack通知</Label>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">未設定</Badge>
                  <span className="text-sm text-muted-foreground">オプション</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* データ管理 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              データ管理
            </CardTitle>
            <CardDescription>
              データのバックアップとメンテナンス
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-4">
              <Button variant="outline">
                データをエクスポート
              </Button>
              <Button variant="outline">
                埋め込みを再生成
              </Button>
              <Button variant="outline">
                キャッシュをクリア
              </Button>
              <Button variant="outline" className="text-destructive">
                監査ログを削除
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 保存ボタン */}
        <div className="flex justify-end">
          <Button onClick={handleSave}>
            <Settings className="mr-2 h-4 w-4" />
            設定を保存
          </Button>
        </div>
      </div>
    </div>
  );
}
