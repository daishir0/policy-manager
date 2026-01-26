import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { proposalService } from "@/lib/services/proposal.service";
import { hasPermission, PERMISSIONS, type Role } from "@/lib/auth/permissions";
import { ProposalStatus, ProposalType } from "@prisma/client";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  if (!hasPermission(session.user.role as Role, PERMISSIONS.PROPOSAL_MANAGE)) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const searchParams = request.nextUrl.searchParams;
  const filter = {
    type: searchParams.get("type") as ProposalType | undefined,
    status: searchParams.get("status") as ProposalStatus | undefined,
    page: parseInt(searchParams.get("page") || "1"),
    limit: parseInt(searchParams.get("limit") || "20"),
  };

  try {
    const result = await proposalService.listProposals(filter);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to list proposals:", error);
    return NextResponse.json({ error: "提案一覧の取得に失敗しました" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  if (!hasPermission(session.user.role as Role, PERMISSIONS.PROPOSAL_MANAGE)) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { type, title, description, reasoning, relatedDocumentIds } = body;

    if (!type || !title || !description || !reasoning) {
      return NextResponse.json(
        { error: "type, title, description, reasoning は必須です" },
        { status: 400 }
      );
    }

    const proposal = await proposalService.createProposal(
      type,
      title,
      description,
      reasoning,
      relatedDocumentIds
    );

    return NextResponse.json(proposal, { status: 201 });
  } catch (error) {
    console.error("Failed to create proposal:", error);
    return NextResponse.json({ error: "提案の作成に失敗しました" }, { status: 500 });
  }
}
