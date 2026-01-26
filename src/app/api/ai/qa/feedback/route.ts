import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const feedbackSchema = z.object({
  interactionId: z.string(),
  rating: z.number().min(1).max(5),
  comment: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const body = await request.json();
    const validated = feedbackSchema.parse(body);

    // 対象のQ&Aインタラクションを更新
    const interaction = await prisma.qAInteraction.findUnique({
      where: { id: validated.interactionId },
    });

    if (!interaction) {
      return NextResponse.json(
        { error: "Q&Aインタラクションが見つかりません" },
        { status: 404 }
      );
    }

    // フィードバックを保存
    const updated = await prisma.qAInteraction.update({
      where: { id: validated.interactionId },
      data: {
        feedbackRating: validated.rating,
        feedbackComment: validated.comment,
      },
    });

    return NextResponse.json({
      success: true,
      rating: updated.feedbackRating,
    });
  } catch (error) {
    console.error("Feedback error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "入力が不正です", details: error.issues }, { status: 400 });
    }
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "フィードバックの保存に失敗しました" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    // フィードバック統計を取得
    const [totalFeedback, positiveCount, negativeCount, avgRating] = await Promise.all([
      prisma.qAInteraction.count({
        where: {
          feedbackRating: { not: null },
          ...(startDate && endDate
            ? {
                createdAt: {
                  gte: new Date(startDate),
                  lte: new Date(endDate),
                },
              }
            : {}),
        },
      }),
      prisma.qAInteraction.count({
        where: {
          feedbackRating: { gte: 4 },
          ...(startDate && endDate
            ? {
                createdAt: {
                  gte: new Date(startDate),
                  lte: new Date(endDate),
                },
              }
            : {}),
        },
      }),
      prisma.qAInteraction.count({
        where: {
          feedbackRating: { lte: 2 },
          ...(startDate && endDate
            ? {
                createdAt: {
                  gte: new Date(startDate),
                  lte: new Date(endDate),
                },
              }
            : {}),
        },
      }),
      prisma.qAInteraction.aggregate({
        _avg: { feedbackRating: true },
        where: {
          feedbackRating: { not: null },
          ...(startDate && endDate
            ? {
                createdAt: {
                  gte: new Date(startDate),
                  lte: new Date(endDate),
                },
              }
            : {}),
        },
      }),
    ]);

    return NextResponse.json({
      totalFeedback,
      positiveCount,
      negativeCount,
      averageRating: avgRating._avg.feedbackRating || 0,
      satisfactionRate: totalFeedback > 0 ? (positiveCount / totalFeedback) * 100 : 0,
    });
  } catch (error) {
    console.error("Feedback stats error:", error);
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "統計の取得に失敗しました" }, { status: 500 });
  }
}
