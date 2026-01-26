import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { proposalService } from "@/lib/services/proposal.service";
import { hasPermission, PERMISSIONS, type Role } from "@/lib/auth/permissions";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  if (!hasPermission(session.user.role as Role, PERMISSIONS.PROPOSAL_MANAGE)) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  try {
    const { id } = await params;
    const proposal = await proposalService.getProposal(id);
    return NextResponse.json(proposal);
  } catch (error) {
    console.error("Failed to get proposal:", error);
    const message = error instanceof Error ? error.message : "提案の取得に失敗しました";
    return NextResponse.json({ error: message }, { status: 404 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  if (!hasPermission(session.user.role as Role, PERMISSIONS.PROPOSAL_MANAGE)) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const { action } = body;

    if (action === "accept") {
      const proposal = await proposalService.acceptProposal(id);
      return NextResponse.json(proposal);
    } else if (action === "reject") {
      const proposal = await proposalService.rejectProposal(id);
      return NextResponse.json(proposal);
    } else {
      return NextResponse.json({ error: "無効なアクションです" }, { status: 400 });
    }
  } catch (error) {
    console.error("Failed to update proposal:", error);
    const message = error instanceof Error ? error.message : "提案の更新に失敗しました";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
