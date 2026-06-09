import { NextRequest, NextResponse } from "next/server";
import { pool } from "../../../lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";


type DbAuditRow = {
  zone_key: string;
  emoji: string | null;
  zone_label: string;
  color: string | null;
  bg: string | null;
  item_key: string | null;
  item_label: string | null;
  description: string | null;
};

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.company) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const company = session.user.company;
    const projectCode = searchParams.get("project");

    if (!company || !projectCode) {
      return NextResponse.json(
        {
          success: false,
          message: "Missing company or project parameter",
        },
        { status: 400 }
      );
    }

    const result = await pool.query<DbAuditRow>(
      `
      SELECT
        z.zone_key,
        z.emoji,
        z.label AS zone_label,
        z.color,
        z.bg,
        i.item_key,
        i.label AS item_label,
        i.description
      FROM audit_zones z
      LEFT JOIN audit_items i
        ON i.company = z.company
        AND i.project_code = z.project_code
        AND i.zone_key = z.zone_key
        AND i.is_active = TRUE
      WHERE z.company = $1
        AND z.project_code = $2
        AND z.is_active = TRUE
      ORDER BY
        z.sort_order ASC,
        i.sort_order ASC
      `,
      [company, projectCode]
    );

    const zoneMap = new Map<string, {
      id: string;
      emoji: string;
      label: string;
      color: string;
      bg: string;
      items: { id: string; label: string; desc: string }[];
    }>();

    for (const row of result.rows) {
      if (!zoneMap.has(row.zone_key)) {
        zoneMap.set(row.zone_key, {
          id: row.zone_key,
          emoji: row.emoji || "",
          label: row.zone_label,
          color: row.color || "#1D4ED8",
          bg: row.bg || "#EFF6FF",
          items: [],
        });
      }

      if (row.item_key && row.item_label) {
        zoneMap.get(row.zone_key)?.items.push({
          id: row.item_key,
          label: row.item_label,
          desc: row.description || "",
        });
      }
    }

    return NextResponse.json({
      success: true,
      company,
      project: projectCode,
      zones: Array.from(zoneMap.values()),
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
