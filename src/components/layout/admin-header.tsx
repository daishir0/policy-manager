"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { Bell, LogOut, User, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarTrigger } from "@/components/ui/sidebar";

interface UnreadMessage {
  id: string;
  content: string;
  createdAt: string;
  document: { id: string; title: string } | null;
}

export function AdminHeader() {
  const { data: session } = useSession();
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState<UnreadMessage[]>([]);

  const fetchUnread = useCallback(async () => {
    try {
      const res = await fetch("/api/messages/unread");
      if (!res.ok) return;
      const data = await res.json();
      setUnreadCount(data.count ?? 0);
      setUnreadMessages(data.messages ?? []);
    } catch {
      // サイレントに失敗
    }
  }, []);

  // 初回取得 + 30秒ポーリング
  useEffect(() => {
    if (!session?.user) return;
    fetchUnread();
    const interval = setInterval(fetchUnread, 30000);
    return () => clearInterval(interval);
  }, [session, fetchUnread]);

  const handleSignOut = async () => {
    await signOut({ callbackUrl: "/login" });
  };

  const getInitials = (name?: string | null) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const formatTimeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return "たった今";
    if (minutes < 60) return `${minutes}分前`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}時間前`;
    const days = Math.floor(hours / 24);
    return `${days}日前`;
  };

  return (
    <header className="sticky top-0 z-50 flex h-14 items-center gap-4 border-b bg-background px-4 lg:px-6">
      <SidebarTrigger className="lg:hidden" />

      <div className="flex-1" />

      <div className="flex items-center gap-4">
        {/* 通知ベル */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
              <span className="sr-only">通知</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-80" align="end" forceMount>
            <DropdownMenuLabel className="flex items-center justify-between">
              <span>通知</span>
              {unreadCount > 0 && (
                <span className="text-xs font-normal text-muted-foreground">
                  {unreadCount}件の未読
                </span>
              )}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {unreadMessages.length > 0 ? (
              <>
                {unreadMessages.map((msg) => (
                  <DropdownMenuItem key={msg.id} asChild className="cursor-pointer">
                    <Link
                      href={msg.document ? `/admin/documents/${msg.document.id}` : "/admin/messages"}
                      className="flex flex-col items-start gap-1 py-2"
                    >
                      <div className="flex items-start gap-2 w-full">
                        <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-blue-500" />
                        <div className="flex-1 min-w-0">
                          {msg.document && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground mb-0.5">
                              <FileText className="h-3 w-3" />
                              <span className="truncate">{msg.document.title}</span>
                            </div>
                          )}
                          <p className="text-sm line-clamp-2">{msg.content}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {formatTimeAgo(msg.createdAt)}
                          </p>
                        </div>
                      </div>
                    </Link>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild className="cursor-pointer justify-center">
                  <Link href="/admin/messages" className="text-sm text-center w-full text-blue-600">
                    すべてのメッセージを見る
                  </Link>
                </DropdownMenuItem>
              </>
            ) : (
              <div className="py-6 text-center text-sm text-muted-foreground">
                未読メッセージはありません
              </div>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* ユーザーメニュー */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-8 w-8 rounded-full" data-testid="user-menu">
              <Avatar className="h-8 w-8">
                <AvatarImage
                  src={session?.user?.image || ""}
                  alt={session?.user?.name || "User"}
                />
                <AvatarFallback>
                  {getInitials(session?.user?.name)}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end" forceMount>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">
                  {session?.user?.name || "ユーザー"}
                </p>
                <p className="text-xs leading-none text-muted-foreground">
                  {session?.user?.email}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <User className="mr-2 h-4 w-4" />
              <span>プロフィール</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              <span>ログアウト</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
