import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { organizationService } from "@/lib/services/organization.service";
import { auditService } from "@/lib/services/audit.service";
import { hasPermission, PERMISSIONS, type Role } from "@/lib/auth/permissions";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const organization = await organizationService.getOrganization(id);
    return NextResponse.json(organization);
  } catch (error) {
    console.error("Failed to get organization:", error);
    const message = error instanceof Error ? error.message : "組織の取得に失敗しました";
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

  if (!hasPermission(session.user.role as Role, PERMISSIONS.ORGANIZATION_MANAGE)) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const organization = await organizationService.updateOrganization(id, body);

    await auditService.log({
      userId: session.user.id,
      action: "organization_update",
      entityType: "organization",
      entityId: id,
      details: { name: organization.name },
      ipAddress: request.headers.get("x-forwarded-for") || undefined,
    });

    return NextResponse.json(organization);
  } catch (error) {
    console.error("Failed to update organization:", error);
    const message = error instanceof Error ? error.message : "組織の更新に失敗しました";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  if (!hasPermission(session.user.role as Role, PERMISSIONS.ORGANIZATION_MANAGE)) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  try {
    const { id } = await params;
    await organizationService.deleteOrganization(id);

    await auditService.log({
      userId: session.user.id,
      action: "organization_delete",
      entityType: "organization",
      entityId: id,
      ipAddress: request.headers.get("x-forwarded-for") || undefined,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete organization:", error);
    const message = error instanceof Error ? error.message : "組織の削除に失敗しました";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
