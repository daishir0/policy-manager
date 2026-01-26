import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  Edit,
  History,
  Network,
  Paperclip,
  Calendar,
  User,
  FolderTree,
  Building2,
  ArrowLeft,
  ExternalLink,
  FileText,
  Shield,
} from "lucide-react";

async function getDocument(id: string) {
  const document = await prisma.document.findUnique({
    where: { id },
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
      categories: { include: { category: true } },
      organizations: { include: { organization: true } },
      attachments: { orderBy: { createdAt: "desc" } },
      versions: {
        orderBy: { createdAt: "desc" },
        take: 10,
        include: { editedBy: { select: { name: true, email: true } } },
      },
      dependencies: {
        include: { dependencyDoc: { select: { id: true, title: true, status: true } } },
      },
      dependents: {
        include: { dependentDoc: { select: { id: true, title: true, status: true } } },
      },
    },
  });

  return document;
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

export default async function DocumentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const document = await getDocument(id);

  if (!document) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/admin/documents">
              <ArrowLeft className="mr-2 h-4 w-4" />
              一覧に戻る
            </Link>
          </Button>
        </div>
        <Button asChild>
          <Link href={`/admin/documents/${id}/edit`}>
            <Edit className="mr-2 h-4 w-4" />
            編集
          </Link>
        </Button>
      </div>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{document.title}</h1>
          <div className="flex items-center gap-4 mt-2 text-muted-foreground">
            <span className="flex items-center gap-1">
              <User className="h-4 w-4" />
              {document.createdBy.name || document.createdBy.email}
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              {new Date(document.updatedAt).toLocaleDateString("ja-JP")}
            </span>
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
              <TabsTrigger value="permissions">
                <Shield className="mr-2 h-4 w-4" />
                権限
              </TabsTrigger>
            </TabsList>

            <TabsContent value="content" className="mt-4">
              <Card>
                <CardContent className="p-6">
                  <div
                    className="prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: document.content }}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="versions" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>バージョン履歴</CardTitle>
                  <CardDescription>
                    この文書の変更履歴を表示します
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {document.versions.map((version) => (
                      <div
                        key={version.id}
                        className="flex items-start gap-4 p-4 border rounded-lg"
                      >
                        <div className="flex-shrink-0">
                          <Badge variant="outline">v{version.version}</Badge>
                        </div>
                        <div className="flex-1">
                          <p className="font-medium">{version.title}</p>
                          {version.changeNote && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {version.changeNote}
                            </p>
                          )}
                          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                            <span>
                              {version.editedBy.name || version.editedBy.email}
                            </span>
                            <span>
                              {new Date(version.createdAt).toLocaleString("ja-JP")}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                    {document.versions.length === 0 && (
                      <p className="text-center text-muted-foreground py-4">
                        履歴はありません
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="dependencies" className="mt-4">
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>この文書が参照している文書</CardTitle>
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
                              {dep.relationshipType && (
                                <Badge variant="outline" className="text-xs">
                                  {dep.relationshipType}
                                </Badge>
                              )}
                            </div>
                            {statusBadge(dep.dependencyDoc.status)}
                          </Link>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground">
                        参照している文書はありません
                      </p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>この文書を参照している文書</CardTitle>
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
                              {dep.relationshipType && (
                                <Badge variant="outline" className="text-xs">
                                  {dep.relationshipType}
                                </Badge>
                              )}
                            </div>
                            {statusBadge(dep.dependentDoc.status)}
                          </Link>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground">
                        参照している文書はありません
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="permissions" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>閲覧権限</CardTitle>
                  <CardDescription>
                    この文書の閲覧・編集権限を管理します
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    権限設定機能は管理画面から設定できます
                  </p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                施行情報
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">施行日</p>
                <p className="font-medium">
                  {document.effectiveDate
                    ? new Date(document.effectiveDate).toLocaleDateString("ja-JP")
                    : "未設定"}
                </p>
              </div>
              <Separator />
              <div>
                <p className="text-sm text-muted-foreground">廃止日</p>
                <p className="font-medium">
                  {document.expirationDate
                    ? new Date(document.expirationDate).toLocaleDateString("ja-JP")
                    : "未設定"}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FolderTree className="h-4 w-4" />
                カテゴリ
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {document.categories.map((dc) => (
                  <Badge key={dc.categoryId} variant="secondary">
                    {dc.category.name}
                  </Badge>
                ))}
                {document.categories.length === 0 && (
                  <p className="text-sm text-muted-foreground">未分類</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                対象組織
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {document.organizations.map((do_) => (
                  <Badge key={do_.organizationId} variant="outline">
                    {do_.organization.name}
                  </Badge>
                ))}
                {document.organizations.length === 0 && (
                  <p className="text-sm text-muted-foreground">全組織</p>
                )}
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
                <p className="text-sm text-muted-foreground">
                  添付ファイルはありません
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
