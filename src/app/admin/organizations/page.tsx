import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, ChevronRight, FileText } from "lucide-react";
import Link from "next/link";

async function getOrganizations() {
  const organizations = await prisma.organization.findMany({
    include: {
      children: true,
      documents: {
        include: {
          document: {
            select: {
              id: true,
              title: true,
              status: true,
            },
          },
        },
      },
    },
    orderBy: { sortOrder: "asc" },
  });

  // ルート組織のみをフィルタ
  const rootOrgs = organizations.filter((org) => !org.parentId);

  // 子組織のマップを作成
  const childrenMap = new Map<string, typeof organizations>();
  organizations.forEach((org) => {
    if (org.parentId) {
      const existing = childrenMap.get(org.parentId) || [];
      existing.push(org);
      childrenMap.set(org.parentId, existing);
    }
  });

  return { rootOrgs, childrenMap, organizations };
}

export default async function OrganizationsPage() {
  const { rootOrgs, childrenMap, organizations } = await getOrganizations();

  const renderOrganization = (org: (typeof organizations)[0], level = 0) => {
    const children = childrenMap.get(org.id) || [];
    const documentCount = org.documents.length;

    return (
      <div key={org.id} className={level > 0 ? "ml-6 border-l pl-4" : ""}>
        <Card className="mb-4">
          <CardHeader className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Building2 className="h-5 w-5 text-muted-foreground" />
                <div>
                  <CardTitle className="text-base">{org.name}</CardTitle>
                  <CardDescription className="text-xs">
                    コード: {org.code}
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <FileText className="h-4 w-4" />
                  {documentCount}件の文書
                </span>
                {children.length > 0 && (
                  <span>{children.length}件の下位組織</span>
                )}
              </div>
            </div>
          </CardHeader>
          {documentCount > 0 && (
            <CardContent className="pt-0">
              <div className="space-y-2">
                {org.documents.slice(0, 3).map(({ document }) => (
                  <Link
                    key={document.id}
                    href={`/admin/documents/${document.id}`}
                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ChevronRight className="h-3 w-3" />
                    {document.title}
                  </Link>
                ))}
                {documentCount > 3 && (
                  <p className="text-xs text-muted-foreground pl-5">
                    他{documentCount - 3}件の文書
                  </p>
                )}
              </div>
            </CardContent>
          )}
        </Card>
        {children.map((child) => renderOrganization(child, level + 1))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">組織一覧</h1>
        <p className="text-muted-foreground">
          組織階層と関連文書を確認できます
        </p>
      </div>

      {rootOrgs.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>組織が登録されていません</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {rootOrgs.map((org) => renderOrganization(org))}
        </div>
      )}
    </div>
  );
}
