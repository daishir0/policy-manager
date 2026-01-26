import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// テスト環境でのみ有効なAPI
export async function POST(request: NextRequest) {
  // テストAPI許可フラグが設定されていない場合は無効化
  // ALLOW_TEST_API=true か、NODE_ENVがproduction以外の場合のみ有効
  const isTestEnabled =
    process.env.ALLOW_TEST_API === "true" ||
    process.env.NODE_ENV !== "production" ||
    process.env.VERCEL_ENV === "preview";

  if (!isTestEnabled) {
    return NextResponse.json(
      { error: "This API is not available in production" },
      { status: 403 }
    );
  }

  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    // ユーザーのロック状態をリセット
    const user = await prisma.user.update({
      where: { email },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });

    return NextResponse.json({
      success: true,
      message: `User ${email} lock status reset`,
      userId: user.id,
    });
  } catch (error) {
    console.error("Reset user lock error:", error);
    return NextResponse.json(
      { error: "Failed to reset user lock status" },
      { status: 500 }
    );
  }
}
