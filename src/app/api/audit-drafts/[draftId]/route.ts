import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/auth";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{
    draftId: string;
  }>;
};

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const { draftId } = await context.params;

    if (!draftId || !isUuid(draftId)) {
      return NextResponse.json(
        { success: false, message: "Invalid draftId" },
        { status: 400 }
      );
    }

    const result = await prisma.audit_drafts.deleteMany({
      where: {
        draft_id: draftId,
        user_id: session.user.id,
        submitted_at: null,
      },
    });

    if (result.count === 0) {
      return NextResponse.json(
        { success: false, message: "Draft not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      deletedDraftId: draftId,
    });
  } catch (error) {
    console.error("Delete audit draft error:", error);

    return NextResponse.json(
      { success: false, message: "Delete audit draft failed" },
      { status: 500 }
    );
  }
}
