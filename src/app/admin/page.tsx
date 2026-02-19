import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Users, Network, MessageSquare, TrendingUp, Mail } from "lucide-react";
import { prisma } from "@/lib/prisma";

async function getDashboardStats() {
  const [
    totalDocuments,
    publishedDocuments,
    draftDocuments,
    retiredDocuments,
    totalUsers,
    recentQACount,
    unreadMessages,
    totalDependencies,
  ] = await Promise.all([
    prisma.document.count({ where: { deletedAt: null } }),
    prisma.document.count({ where: { status: "PUBLISHED", deletedAt: null } }),
    prisma.document.count({ where: { status: "DRAFT", deletedAt: null } }),
    prisma.document.count({ where: { status: "RETIRED", deletedAt: null } }),
    prisma.user.count(),
    prisma.qAInteraction.count({
      where: {
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
    }),
    prisma.message.count({ where: { readAt: null } }),
    prisma.documentDependency.count(),
  ]);

  return {
    totalDocuments,
    publishedDocuments,
    draftDocuments,
    retiredDocuments,
    totalUsers,
    recentQACount,
    unreadMessages,
    totalDependencies,
  };
}

export default async function AdminDashboardPage() {
  const stats = await getDashboardStats();

  const statCards = [
    {
      title: "総文書数",
      value: stats.totalDocuments,
      description: `公開中: ${stats.publishedDocuments} / 下書き: ${stats.draftDocuments} / 廃止: ${stats.retiredDocuments}`,
      icon: FileText,
    },
    {
      title: "依存関係数",
      value: stats.totalDependencies,
      description: "文書間の依存関係",
      icon: Network,
    },
    {
      title: "ユーザー数",
      value: stats.totalUsers,
      description: "登録ユーザー数",
      icon: Users,
    },
    {
      title: "Q&A件数（週間）",
      value: stats.recentQACount,
      description: "直近7日間の質問数",
      icon: MessageSquare,
    },
    {
      title: "未読メッセージ",
      value: stats.unreadMessages,
      description: "矛盾チェック通知など",
      icon: Mail,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">ダッシュボード</h1>
        <p className="text-muted-foreground">Policy Manager の概要を確認できます</p>
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
              <div className="text-sm text-muted-foreground">新しい文書を作成します</div>
            </a>
            <a
              href="/admin/qa"
              className="block rounded-lg border p-3 hover:bg-accent transition-colors"
            >
              <div className="font-medium">Q&A対話</div>
              <div className="text-sm text-muted-foreground">AIに質問できます</div>
            </a>
            <a
              href="/admin/dependencies"
              className="block rounded-lg border p-3 hover:bg-accent transition-colors"
            >
              <div className="font-medium">依存関係ツリー</div>
              <div className="text-sm text-muted-foreground">文書間の依存関係を確認します</div>
            </a>
            <a
              href="/admin/messages"
              className="block rounded-lg border p-3 hover:bg-accent transition-colors"
            >
              <div className="font-medium">メッセージ受信箱</div>
              <div className="text-sm text-muted-foreground">矛盾チェック結果などの通知</div>
            </a>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
