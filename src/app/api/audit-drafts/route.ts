import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canAccessProject } from "@/lib/permissions";

type AuditItemStatus = "pass" | "fix" | null;

type AuditItem = {
  id?: string;
  label?: string;
  desc?: string;
  status?: AuditItemStatus;
  note?: string;
};

type AuditZone = {
  id?: string;
  label: string;
  comment?: string;
  items?: AuditItem[];
};

type AuditDraftReturnRow = {
  draft_id: string;
  company_code: string;
  project_code: string;
  audit_date: Date;
  total_items: number;
  answered_items: number;
  passed_items: number;
  fixed_items: number;
  last_saved_at: Date;
};

function toDateOnly(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function getDraftStats(zones: AuditZone[]) {
  const allItems = zones.flatMap((zone) =>
    Array.isArray(zone.items) ? zone.items : []
  );

  const totalItems = allItems.length;
  const passedItems = allItems.filter((item) => item.status === "pass").length;
  const fixedItems = allItems.filter((item) => item.status === "fix").length;
  const answeredItems = passedItems + fixedItems;

  return {
    totalItems,
    answeredItems,
    passedItems,
    fixedItems,
  };
}

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

    const company = searchParams.get("company");
    const project = searchParams.get("project");
    const auditDate = searchParams.get("auditDate");

    if (!company || !project || !auditDate) {
      return NextResponse.json(
        {
          success: false,
          message: "Missing company, project, or auditDate",
        },
        { status: 400 }
      );
    }

    const hasPermission = await canAccessProject({
      userId: session.user.id,
      companyCode: company,
      projectCode: project,
    });

    if (!hasPermission) {
      return NextResponse.json(
        { success: false, message: "Forbidden" },
        { status: 403 }
      );
    }

    const draft = await prisma.audit_drafts.findFirst({
      where: {
        user_id: session.user.id,
        company_code: company,
        project_code: project,
        audit_date: toDateOnly(auditDate),
        submitted_at: null,
      },
      select: {
        draft_id: true,
        user_id: true,
        company_code: true,
        company_name: true,
        project_code: true,
        project_name: true,
        audit_date: true,
        auditor_name: true,
        raw_json: true,
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
      draft,
    });
  } catch (error) {
    console.error("Load audit draft error:", error);

    return NextResponse.json(
      { success: false, message: "Load audit draft failed" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await req.json();

    const company = String(body.company || "").trim();
    const companyName = String(body.companyName || "").trim();
    const project = String(body.project || "").trim();
    const projectName = String(body.projectName || "").trim();
    const auditDate = String(body.auditDate || body.date || "").trim();
    const auditorName = String(body.auditorName || body.auditor || "").trim();
    const zones: AuditZone[] = Array.isArray(body.zones) ? body.zones : [];
    const overallComment = String(body.overallComment || "").trim();

    if (!company || !project || !projectName || !auditDate) {
      return NextResponse.json(
        {
          success: false,
          message: "Missing company, project, projectName, or auditDate",
        },
        { status: 400 }
      );
    }

    const hasPermission = await canAccessProject({
      userId: session.user.id,
      companyCode: company,
      projectCode: project,
    });

    if (!hasPermission) {
      return NextResponse.json(
        { success: false, message: "Forbidden" },
        { status: 403 }
      );
    }

    const { totalItems, answeredItems, passedItems, fixedItems } =
      getDraftStats(zones);

    const rawJson = {
      company,
      companyName,
      project,
      projectName,
      auditDate,
      auditorName,
      zones,
      overallComment,
    };

    // Prisma model upsert cannot target this partial unique index reliably, so keep this as Prisma raw SQL.
    const rows = await prisma.$queryRaw<AuditDraftReturnRow[]>`
      INSERT INTO audit_drafts (
        user_id,
        company_code,
        company_name,
        project_code,
        project_name,
        audit_date,
        auditor_name,
        raw_json,
        total_items,
        answered_items,
        passed_items,
        fixed_items,
        last_saved_at,
        created_at,
        updated_at
      )
      VALUES (
        ${session.user.id}::uuid,
        ${company},
        ${companyName || null},
        ${project},
        ${projectName},
        ${auditDate}::date,
        ${auditorName || null},
        ${JSON.stringify(rawJson)}::jsonb,
        ${totalItems},
        ${answeredItems},
        ${passedItems},
        ${fixedItems},
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
      ON CONFLICT (user_id, company_code, project_code, audit_date)
      WHERE submitted_at IS NULL
      DO UPDATE SET
        company_name = EXCLUDED.company_name,
        project_name = EXCLUDED.project_name,
        auditor_name = EXCLUDED.auditor_name,
        raw_json = EXCLUDED.raw_json,
        total_items = EXCLUDED.total_items,
        answered_items = EXCLUDED.answered_items,
        passed_items = EXCLUDED.passed_items,
        fixed_items = EXCLUDED.fixed_items,
        last_saved_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      RETURNING
        draft_id,
        company_code,
        project_code,
        audit_date,
        total_items,
        answered_items,
        passed_items,
        fixed_items,
        last_saved_at
    `;

    return NextResponse.json({
      success: true,
      draft: rows[0],
    });
  } catch (error) {
    console.error("Save audit draft error:", error);

    return NextResponse.json(
      { success: false, message: "Save audit draft failed" },
      { status: 500 }
    );
  }
}
