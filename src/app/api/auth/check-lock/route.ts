import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * アカウントのロック状態を確認するAPI
 * ログイン失敗後にクライアントから呼び出される
 */
export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ locked: false });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { lockedUntil: true },
    });

    if (!user) {
      return NextResponse.json({ locked: false });
    }

    const isLocked = user.lockedUntil && user.lockedUntil > new Date();

    return NextResponse.json({ locked: isLocked });
  } catch (error) {
    console.error("Check lock status error:", error);
    return NextResponse.json({ locked: false });
  }
}
