"use client";

import { ChatInterface } from "@/components/chat/chat-interface";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquare, Info } from "lucide-react";

export default function QAPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Q&A対話</h1>
        <p className="text-muted-foreground">
          AIアシスタントに文書に関する質問ができます
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ChatInterface />
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Info className="h-4 w-4" />
                使い方
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              <p>文書に関する質問を入力すると、AIが関連する文書を参照して回答します。</p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>質問は具体的にすると正確な回答が得られます</li>
                <li>回答の下に参照文書へのリンクが表示されます</li>
                <li>AIの回答は参考程度に、必ず原文書をご確認ください</li>
                <li>Enterキーで送信、Shift+Enterで改行です</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                質問例
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              <ul className="space-y-2 text-muted-foreground">
                <li className="p-2 bg-muted rounded cursor-pointer hover:bg-muted/80">
                  「休暇申請の手続きを教えてください」
                </li>
                <li className="p-2 bg-muted rounded cursor-pointer hover:bg-muted/80">
                  「経費精算のルールについて」
                </li>
                <li className="p-2 bg-muted rounded cursor-pointer hover:bg-muted/80">
                  「新入社員の研修プログラムは？」
                </li>
                <li className="p-2 bg-muted rounded cursor-pointer hover:bg-muted/80">
                  「セキュリティポリシーを確認したい」
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
