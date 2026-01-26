import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Users, FolderTree, Building2, MessageSquare, TrendingUp } from "lucide-react";
import { prisma } from "@/lib/prisma";

async function getDashboardStats() {
  const [
    totalDocuments,
    publishedDocuments,
    draftDocuments,
    totalCategories,
    totalOrganizations,
    totalUsers,
    recentQACount,
    pendingProposals,
  ] = await Promise.all([
    prisma.document.count({ where: { deletedAt: null } }),
    prisma.document.count({ where: { status: "PUBLISHED", deletedAt: null } }),
    prisma.document.count({ where: { status: "DRAFT", deletedAt: null } }),
    prisma.category.count(),
    prisma.organization.count(),
    prisma.user.count(),
    prisma.qAInteraction.count({
      where: {
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
    }),
    prisma.proposal.count({ where: { status: "PENDING" } }),
  ]);

  return {
    totalDocuments,
    publishedDocuments,
    draftDocuments,
    totalCategories,
    totalOrganizations,
    totalUsers,
    recentQACount,
    pendingProposals,
  };
}

export default async function AdminDashboardPage() {
  const stats = await getDashboardStats();

  const statCards = [
    {
      title: "総文書数",
      value: stats.totalDocuments,
      description: `公開中: ${stats.publishedDocuments} / 下書き: ${stats.draftDocuments}`,
      icon: FileText,
    },
    {
      title: "カテゴリ数",
      value: stats.totalCategories,
      description: "文書の分類カテゴリ",
      icon: FolderTree,
    },
    {
      title: "組織数",
      value: stats.totalOrganizations,
      description: "登録されている組織",
      icon: Building2,
    },
    {
      title: "ユーザー数",
      value: stats.totalUsers,
      description: "登録ユーザー",
      icon: Users,
    },
    {
      title: "Q&A件数（週間）",
      value: stats.recentQACount,
      description: "直近7日間の質問数",
      icon: MessageSquare,
    },
    {
      title: "未対応提案",
      value: stats.pendingProposals,
      description: "改善提案の未対応件数",
      icon: TrendingUp,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">ダッシュボード</h1>
        <p className="text-muted-foreground">
          Policy Manager の概要を確認できます
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {statCards.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground">{stat.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>最近の活動</CardTitle>
            <CardDescription>システムの最近の活動を表示します</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              最近の文書更新やQ&Aのやり取りがここに表示されます
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>クイックアクション</CardTitle>
            <CardDescription>よく使う機能へのショートカット</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            <a
              href="/admin/documents/new"
              className="block rounded-lg border p-3 hover:bg-accent transition-colors"
            >
              <div className="font-medium">新規文書作成</div>
              <div className="text-sm text-muted-foreground">
                新しい文書を作成します
              </div>
            </a>
            <a
              href="/admin/qa"
              className="block rounded-lg border p-3 hover:bg-accent transition-colors"
            >
              <div className="font-medium">Q&A対話</div>
              <div className="text-sm text-muted-foreground">
                AIに質問できます
              </div>
            </a>
            <a
              href="/admin/proposals"
              className="block rounded-lg border p-3 hover:bg-accent transition-colors"
            >
              <div className="font-medium">改善提案を確認</div>
              <div className="text-sm text-muted-foreground">
                AIによる改善提案を確認します
              </div>
            </a>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
