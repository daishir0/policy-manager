"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  FileText,
  Network,
  Users,
  MessageSquare,
  BarChart3,
  Settings,
  Home,
  Inbox,
  ClipboardList,
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
  { title: "ダッシュボード", url: "/admin", icon: Home },
  { title: "文書一覧", url: "/admin/documents", icon: FileText },
  { title: "依存関係", url: "/admin/dependencies", icon: Network },
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

  const isActive = (url: string) => {
    if (url === "/admin") {
      return pathname === "/admin";
    }
    return pathname.startsWith(url);
  };

  return (
    <Sidebar>
      <SidebarHeader className="border-b px-4 py-3">
        <Link href="/admin" className="flex items-center gap-2">
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
