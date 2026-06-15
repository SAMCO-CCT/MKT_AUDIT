import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hasProjectPermission } from "@/lib/permissions";

type AuditConfigItemRow = {
  item_key: string;
  label: string;
  description: string | null;
};

type AuditConfigZoneRow = {
  zone_key: string;
  emoji: string | null;
  label: string;
  color: string | null;
  bg: string | null;
  audit_items: AuditConfigItemRow[];
};

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const company = searchParams.get("company") || session.user.company || "";
    const projectCode = searchParams.get("project") || "";

    if (!company || !projectCode) {
      return NextResponse.json(
        {
          success: false,
          message: "Missing company or project parameter",
        },
        { status: 400 }
      );
    }

    const allowed = await hasProjectPermission(session.user.id, company, projectCode);
    if (!allowed) {
      return NextResponse.json(
        { success: false, message: "Forbidden" },
        { status: 403 }
      );
    }

    const auditZones = (await prisma.audit_zones.findMany({
      where: {
        company,
        project_code: projectCode,
        is_active: true,
      },
      orderBy: [{ sort_order: "asc" }, { zone_key: "asc" }],
      include: {
        audit_items: {
          where: { is_active: true },
          orderBy: [{ sort_order: "asc" }, { item_key: "asc" }],
        },
      },
    })) as AuditConfigZoneRow[];

    const zones = auditZones.map((zone) => ({
      id: zone.zone_key,
      emoji: zone.emoji || "",
      label: zone.label,
      color: zone.color || "#1D4ED8",
      bg: zone.bg || "#EFF6FF",
      items: zone.audit_items.map((item) => ({
        id: item.item_key,
        label: item.label,
        desc: item.description || "",
      })),
    }));

    return NextResponse.json({
      success: true,
      company,
      project: projectCode,
      zones,
    });
  } catch (error) {
    console.error("Get audit config error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to get audit config",
      },
      { status: 500 }
    );
  }
}
