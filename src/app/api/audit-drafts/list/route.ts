import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const drafts = await prisma.audit_drafts.findMany({
      where: {
        user_id: session.user.id,
        submitted_at: null,
      },
      orderBy: { last_saved_at: "desc" },
      take: 10,
      select: {
        draft_id: true,
        company_code: true,
        company_name: true,
        project_code: true,
        project_name: true,
        audit_date: true,
        auditor_name: true,
        total_items: true,
        answered_items: true,
        passed_items: true,
        fixed_items: true,
        last_saved_at: true,
        created_at: true,
        updated_at: true,
      },
    });

    return NextResponse.json({
      success: true,
      drafts,
    });
  } catch (error) {
    console.error("List audit drafts error:", error);

    return NextResponse.json(
      { success: false, message: "List audit drafts failed" },
      { status: 500 }
    );
  }
}
