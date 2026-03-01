"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  FileText,
  Users,
  MessageSquare,
  BarChart3,
  Settings,
  Inbox,
  ClipboardList,
  AlertTriangle,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const documentItems = [
  { title: "ポリシー一覧", url: "/admin/policies", icon: FileText },
];

const aiItems = [
  { title: "Q&A対話", url: "/admin/qa", icon: MessageSquare },
];

const adminAnalyticsItems = [
  { title: "アクセス統計", url: "/admin/analytics", icon: BarChart3 },
  { title: "ログ管理", url: "/admin/logs", icon: ClipboardList },
];

const settingsPublicItems = [
  { title: "メッセージ", url: "/admin/messages", icon: Inbox },
];

const settingsAdminItems = [
  { title: "ユーザー管理", url: "/admin/users", icon: Users },
  { title: "設定", url: "/admin/settings", icon: Settings },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";
  const [contradictionCount, setContradictionCount] = useState(0);

  // 矛盾検出数を取得
  useEffect(() => {
    const fetchCount = async () => {
      try {
        const res = await fetch("/api/contradictions/count");
        if (res.ok) {
          const data = await res.json();
          setContradictionCount(data.count || 0);
        }
      } catch {
        // エラー時は0のまま
      }
    };

    fetchCount();
    // 30秒ごとに更新
    const interval = setInterval(fetchCount, 30000);
    return () => clearInterval(interval);
  }, []);

  const isActive = (url: string) => {
    return pathname.startsWith(url);
  };

  return (
    <Sidebar>
      <SidebarHeader className="border-b px-4 py-3">
        <Link href="/admin/policies" className="flex items-center gap-2">
          <FileText className="h-6 w-6" />
          <span className="font-bold text-lg">Policy Manager</span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        {/* 文書管理 */}
        <SidebarGroup>
          <SidebarGroupLabel>文書管理</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {documentItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <Link href={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              {/* 矛盾検出アラート */}
              {contradictionCount > 0 && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive("/admin/contradictions")}>
                    <Link href="/admin/contradictions" className="text-yellow-600 dark:text-yellow-400">
                      <AlertTriangle className="h-4 w-4" />
                      <span>矛盾検出 ({contradictionCount}件)</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* AI機能 */}
        <SidebarGroup>
          <SidebarGroupLabel>AI機能</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {aiItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <Link href={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* 分析・管理（ADMINのみ） */}
        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>分析・管理</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminAnalyticsItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive(item.url)}>
                      <Link href={item.url}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* 設定 */}
        <SidebarGroup>
          <SidebarGroupLabel>設定</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {settingsPublicItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <Link href={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              {isAdmin && settingsAdminItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <Link href={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t p-4">
        <div className="text-xs text-muted-foreground">
          Policy Manager v2.0
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
