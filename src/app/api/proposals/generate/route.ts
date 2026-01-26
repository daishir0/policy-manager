import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { proposalService } from "@/lib/services/proposal.service";
import { hasPermission, PERMISSIONS, type Role } from "@/lib/auth/permissions";

export async function POST() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  if (!hasPermission(session.user.role as Role, PERMISSIONS.PROPOSAL_MANAGE)) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  try {
    const proposals = await proposalService.generateProposalsFromAnalytics();
    return NextResponse.json({
      message: `${proposals.length}件の提案を生成しました`,
      proposals,
    });
  } catch (error) {
    console.error("Failed to generate proposals:", error);
    return NextResponse.json({ error: "提案の自動生成に失敗しました" }, { status: 500 });
  }
}
