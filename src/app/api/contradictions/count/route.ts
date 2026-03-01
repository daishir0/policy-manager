import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { contradictionService } from "@/lib/services/contradiction.service";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const count = await contradictionService.getActiveCount();

    return NextResponse.json({ count });
  } catch (error) {
    console.error("Get contradiction count error:", error);
    return NextResponse.json({ count: 0 }, { status: 200 });
  }
}
