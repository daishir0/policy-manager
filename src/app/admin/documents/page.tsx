import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, FileText, Edit, Eye } from "lucide-react";

async function getDocuments() {
  return prisma.document.findMany({
    where: { deletedAt: null },
    include: {
      createdBy: { select: { name: true, email: true } },
      categories: { include: { category: { select: { name: true } } } },
      organizations: { include: { organization: { select: { name: true } } } },
    },
    orderBy: { updatedAt: "desc" },
  });
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

export default async function DocumentsPage() {
  const documents = await getDocuments();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">文書一覧</h1>
          <p className="text-muted-foreground">
            登録されている文書を管理します
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/documents/new">
            <Plus className="mr-2 h-4 w-4" />
            新規作成
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            文書 ({documents.length}件)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>タイトル</TableHead>
                <TableHead>ステータス</TableHead>
                <TableHead>バージョン</TableHead>
                <TableHead>カテゴリ</TableHead>
                <TableHead>作成者</TableHead>
                <TableHead>更新日</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {documents.map((doc) => (
                <TableRow key={doc.id}>
                  <TableCell className="font-medium">
                    <Link
                      href={`/admin/documents/${doc.id}`}
                      className="hover:underline"
                    >
                      {doc.title}
                    </Link>
                  </TableCell>
                  <TableCell>{statusBadge(doc.status)}</TableCell>
                  <TableCell>v{doc.currentVersion}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {doc.categories.slice(0, 2).map((dc) => (
                        <Badge key={dc.categoryId} variant="outline" className="text-xs">
                          {dc.category.name}
                        </Badge>
                      ))}
                      {doc.categories.length > 2 && (
                        <Badge variant="outline" className="text-xs">
                          +{doc.categories.length - 2}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{doc.createdBy.name || doc.createdBy.email}</TableCell>
                  <TableCell>
                    {new Date(doc.updatedAt).toLocaleDateString("ja-JP")}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/admin/documents/${doc.id}`}>
                          <Eye className="h-4 w-4" />
                        </Link>
                      </Button>
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/admin/documents/${doc.id}/edit`}>
                          <Edit className="h-4 w-4" />
                        </Link>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {documents.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    文書がまだ登録されていません
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
