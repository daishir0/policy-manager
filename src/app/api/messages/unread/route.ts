import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  try {
    const [count, messages] = await Promise.all([
      prisma.message.count({
        where: { userId: session.user.id, readAt: null },
      }),
      prisma.message.findMany({
        where: { userId: session.user.id, readAt: null },
        include: {
          document: { select: { id: true, title: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
    ]);

    return NextResponse.json({ count, messages });
  } catch (error) {
    console.error("Failed to get unread messages:", error);
    return NextResponse.json({ error: "取得に失敗しました" }, { status: 500 });
  }
}
