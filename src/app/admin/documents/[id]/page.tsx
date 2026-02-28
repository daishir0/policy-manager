"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import Script from "next/script";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Edit,
  History,
  Network,
  Paperclip,
  User,
  ArrowLeft,
  ExternalLink,
  FileText,
  AlertTriangle,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

interface DocumentData {
  id: string;
  title: string;
  content: string;
  status: string;
  currentVersion: string;
  createdBy: { id: string; name: string | null; email: string };
  assignee: { id: string; name: string | null; email: string } | null;
  updatedAt: string;
  createdAt: string;
  attachments: Array<{ id: string; fileName: string; mimeType: string }>;
  versions: Array<{
    id: string;
    version: string;
    title: string;
    changeNote: string | null;
    editedBy: { name: string | null; email: string };
    createdAt: string;
  }>;
  dependencies: Array<{
    id: string;
    dependencyDoc: { id: string; title: string; status: string };
  }>;
  dependents: Array<{
    id: string;
    dependentDoc: { id: string; title: string; status: string };
  }>;
}

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    marked?: { parse: (text: string) => string; setOptions?: (opts: Record<string, unknown>) => void };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    hljs?: { highlightAll: () => void; highlightElement: (el: HTMLElement) => void };
  }
}

const statusBadge = (status: string) => {
  switch (status) {
    case "PUBLISHED":
      return <Badge className="bg-green-500">公開中</Badge>;
    case "DRAFT":
      return <Badge variant="secondary">下書き</Badge>;
    case "RETIRED":
      return <Badge variant="outline">廃止</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
};

export default function DocumentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [document, setDocument] = useState<DocumentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkingContradiction, setCheckingContradiction] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [markedLoaded, setMarkedLoaded] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const [hljsLoaded, setHljsLoaded] = useState(false);

  // highlight.js CSS + Noto Serif JP (明朝体) を動的にロード
  useEffect(() => {
    const loadStylesheet = (id: string, href: string) => {
      if (!globalThis.document.getElementById(id)) {
        const link = globalThis.document.createElement("link");
        link.id = id;
        link.rel = "stylesheet";
        link.href = href;
        globalThis.document.head.appendChild(link);
      }
    };
    loadStylesheet("hljs-css", "https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/styles/github.min.css");
    loadStylesheet("noto-serif-jp", "https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@400;700;900&display=swap");
  }, []);

  useEffect(() => {
    const fetchDocument = async () => {
      try {
        const res = await fetch(`/api/documents/${id}`);
        if (!res.ok) throw new Error("取得失敗");
        const data = await res.json();
        setDocument(data);
      } catch {
        toast.error("文書の取得に失敗しました");
      } finally {
        setLoading(false);
      }
    };
    fetchDocument();
  }, [id]);

  // Markdownレンダリング
  useEffect(() => {
    if (!markedLoaded || !document || !contentRef.current) return;
    if (window.marked) {
      if (window.marked.setOptions) {
        window.marked.setOptions({
          gfm: true,
          breaks: true,
        });
      }
      contentRef.current.innerHTML = window.marked.parse(document.content);
      // highlight.jsでコードブロックをハイライト
      if (hljsLoaded && window.hljs) {
        contentRef.current.querySelectorAll("pre code").forEach((block) => {
          window.hljs!.highlightElement(block as HTMLElement);
        });
      }
    }
  }, [markedLoaded, hljsLoaded, document]);

  const handleDelete = async () => {
    if (!document) return;
    if (!window.confirm(`「${document.title}」を削除してよろしいですか？この操作は取り消せません。`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/documents/${id}?hard=true`, { method: "DELETE" });
      if (!res.ok) throw new Error("削除失敗");
      toast.success("文書を削除しました");
      router.push("/admin/policies");
    } catch {
      toast.error("文書の削除に失敗しました");
      setDeleting(false);
    }
  };

  const handleContradictionCheck = async () => {
    if (!document) return;
    setCheckingContradiction(true);
    try {
      const res = await fetch("/api/ai/contradiction-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: document.content, title: document.title }),
      });
      const result = await res.json();
      if (result.hasContradictions) {
        toast.warning(`矛盾が${result.contradictions.length}件検出されました。担当者にメッセージが送信されます。`);
      } else {
        toast.success("矛盾は検出されませんでした");
      }
    } catch {
      toast.error("矛盾チェックに失敗しました");
    } finally {
      setCheckingContradiction(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!document) {
    return <div className="p-8 text-center text-muted-foreground">文書が見つかりません</div>;
  }

  return (
    <>
      <Script
        src="https://cdn.jsdelivr.net/npm/marked@11.1.1/marked.min.js"
        onLoad={() => setMarkedLoaded(true)}
      />
      <Script
        src="https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/highlight.min.js"
        onLoad={() => setHljsLoaded(true)}
      />
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/admin/policies">
              <ArrowLeft className="mr-2 h-4 w-4" />
              一覧に戻る
            </Link>
          </Button>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleContradictionCheck}
              disabled={checkingContradiction}
            >
              {checkingContradiction ? (
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <AlertTriangle className="mr-2 h-4 w-4" />
              )}
              矛盾チェック
            </Button>
            <Button asChild>
              <Link href={`/admin/documents/${id}/edit`}>
                <Edit className="mr-2 h-4 w-4" />
                編集
              </Link>
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? (
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              削除
            </Button>
          </div>
        </div>

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{document.title}</h1>
            <div className="flex items-center gap-4 mt-2 text-muted-foreground text-sm">
              <span className="flex items-center gap-1">
                <User className="h-4 w-4" />
                担当: {document.assignee?.name || document.assignee?.email || document.createdBy.name || document.createdBy.email}
              </span>
              <span>作成者: {document.createdBy.name || document.createdBy.email}</span>
              <span>{new Date(document.updatedAt).toLocaleDateString("ja-JP")} 更新</span>
              <span>v{document.currentVersion}</span>
            </div>
          </div>
          {statusBadge(document.status)}
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <div className="md:col-span-2">
            <Tabs defaultValue="content">
              <TabsList>
                <TabsTrigger value="content">
                  <FileText className="mr-2 h-4 w-4" />
                  本文
                </TabsTrigger>
                <TabsTrigger value="versions">
                  <History className="mr-2 h-4 w-4" />
                  履歴
                </TabsTrigger>
                <TabsTrigger value="dependencies">
                  <Network className="mr-2 h-4 w-4" />
                  依存関係
                </TabsTrigger>
              </TabsList>

              <TabsContent value="content" className="mt-4">
                <Card>
                  <CardContent className="p-6">
                    <div
                      ref={contentRef}
                      className="official-document"
                    >
                      {/* marked.jsがロードされるまでプレーンテキスト表示 */}
                      {!markedLoaded && (
                        <pre className="whitespace-pre-wrap text-sm">{document.content}</pre>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="versions" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>バージョン履歴</CardTitle>
                    <CardDescription>この文書の変更履歴を表示します</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {document.versions.map((version) => (
                        <div key={version.id} className="flex items-start gap-4 p-4 border rounded-lg">
                          <Badge variant="outline">v{version.version}</Badge>
                          <div className="flex-1">
                            <p className="font-medium">{version.title}</p>
                            {version.changeNote && (
                              <p className="text-sm text-muted-foreground mt-1">{version.changeNote}</p>
                            )}
                            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                              <span>{version.editedBy.name || version.editedBy.email}</span>
                              <span>{new Date(version.createdAt).toLocaleString("ja-JP")}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                      {document.versions.length === 0 && (
                        <p className="text-center text-muted-foreground py-4">履歴はありません</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="dependencies" className="mt-4">
                <div className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>この文書が参照している文書（依存先）</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {document.dependencies.length > 0 ? (
                        <div className="space-y-2">
                          {document.dependencies.map((dep) => (
                            <Link
                              key={dep.id}
                              href={`/admin/documents/${dep.dependencyDoc.id}`}
                              className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent"
                            >
                              <div className="flex items-center gap-2">
                                <FileText className="h-4 w-4" />
                                <span>{dep.dependencyDoc.title}</span>
                              </div>
                              {statusBadge(dep.dependencyDoc.status)}
                            </Link>
                          ))}
                        </div>
                      ) : (
                        <p className="text-muted-foreground">参照している文書はありません</p>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>この文書を参照している文書（依存元）</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {document.dependents.length > 0 ? (
                        <div className="space-y-2">
                          {document.dependents.map((dep) => (
                            <Link
                              key={dep.id}
                              href={`/admin/documents/${dep.dependentDoc.id}`}
                              className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent"
                            >
                              <div className="flex items-center gap-2">
                                <FileText className="h-4 w-4" />
                                <span>{dep.dependentDoc.title}</span>
                              </div>
                              {statusBadge(dep.dependentDoc.status)}
                            </Link>
                          ))}
                        </div>
                      ) : (
                        <p className="text-muted-foreground">参照している文書はありません</p>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <User className="h-4 w-4" />
                  担当者情報
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div>
                  <p className="text-muted-foreground">担当者</p>
                  <p className="font-medium">
                    {document.assignee?.name || document.assignee?.email || "未割り当て"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">作成者</p>
                  <p className="font-medium">
                    {document.createdBy.name || document.createdBy.email}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">作成日</p>
                  <p className="font-medium">
                    {new Date(document.createdAt).toLocaleDateString("ja-JP")}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Paperclip className="h-4 w-4" />
                  添付ファイル
                </CardTitle>
              </CardHeader>
              <CardContent>
                {document.attachments.length > 0 ? (
                  <div className="space-y-2">
                    {document.attachments.map((attachment) => (
                      <a
                        key={attachment.id}
                        href={`/api/attachments/${attachment.id}`}
                        className="flex items-center gap-2 p-2 border rounded hover:bg-accent text-sm"
                      >
                        <Paperclip className="h-4 w-4 flex-shrink-0" />
                        <span className="truncate">{attachment.fileName}</span>
                        <ExternalLink className="h-3 w-3 flex-shrink-0 ml-auto" />
                      </a>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">添付ファイルはありません</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
