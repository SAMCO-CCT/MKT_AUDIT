import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { prisma } from "@/lib/prisma";
import { sendAuditAlertEmail } from "@/lib/mailer";
import { hasProjectPermission } from "@/lib/permissions";

type AuditItem = {
  id?: string;
  label: string;
  desc?: string;
  note?: string;
  status?: "pass" | "fix" | null;
};

type AuditZone = {
  id?: string;
  label: string;
  comment?: string;
  items?: AuditItem[];
  fixItems?: {
    id?: string;
    label: string;
    desc?: string;
    note?: string;
  }[];
};

type AuditPayload = {
  company?: string;
  companyName?: string;
  project?: string;
  projectName?: string;
  auditor?: string;
  date?: string;
  total?: number;
  answered?: number;
  passed?: number;
  fixed?: number;
  zones?: AuditZone[];
  overallComment?: string;
};

function toDateOnly(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
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

    let body: AuditPayload;

    try {
      body = (await req.json()) as AuditPayload;
    } catch {
      return NextResponse.json(
        { success: false, message: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const requiredFields: (keyof AuditPayload)[] = ["project", "projectName", "auditor", "date", "zones"];

    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json(
          { success: false, message: `Missing field: ${field}` },
          { status: 400 }
        );
      }
    }

    if (!Array.isArray(body.zones)) {
      return NextResponse.json(
        { success: false, message: "zones must be an array" },
        { status: 400 }
      );
    }

    const company = session.user.company || "";
    const companyName = session.user.companyName || company;

    const project = body.project || "";
    const projectName = body.projectName || project;
    const auditor = body.auditor || session.user.displayName || session.user.username || "";
    const date = body.date || new Date().toISOString().slice(0, 10);
    const zones: AuditZone[] = Array.isArray(body.zones) ? body.zones : [];

    if (!company || !project) {
      return NextResponse.json(
        { success: false, message: "Missing company or project" },
        { status: 400 }
      );
    }

    const allowed = await hasProjectPermission(session.user.id, company, project);
    if (!allowed) {
      return NextResponse.json(
        { success: false, message: "Forbidden" },
        { status: 403 }
      );
    }

    const allItems = zones.flatMap((zone) =>
      Array.isArray(zone.items) ? zone.items : []
    );

    const total = allItems.length;
    const answered = allItems.filter(
      (item) => item.status === "pass" || item.status === "fix"
    ).length;
    const fixed = allItems.filter((item) => item.status === "fix").length;
    const passed = allItems.filter((item) => item.status === "pass").length;
    const overallComment = body.overallComment || "";

    const fixItems: string[] = [];

    for (const zone of zones) {
      const items = Array.isArray(zone.items) ? zone.items : [];

      for (const item of items) {
        if (item.status === "fix") {
          fixItems.push(
            `[${zone.label}] ${item.label}${item.note ? ` - ${item.note}` : ""}`
          );
        }
      }
    }

    const fixItemsText = fixItems.join("\n");

    const rawJson = {
      ...body,
      company,
      companyName,
      project,
      projectName,
      auditor,
      date,
      total,
      answered,
      passed,
      fixed,
    };

    const auditLog = await prisma.audit_logs.create({
      data: {
        company,
        company_name: companyName,
        project_code: project,
        project: projectName,
        auditor,
        audit_date: toDateOnly(date),
        total_items: total,
        answered,
        passed,
        fixed,
        fix_items: fixItemsText,
        overall_comment: overallComment,
        raw_json: rawJson as never,
        created_by_user_id: session.user.id,
      },
      select: {
        id: true,
        created_at: true,
      },
    });

    await prisma.audit_drafts.updateMany({
      where: {
        user_id: session.user.id,
        company_code: company,
        project_code: project,
        audit_date: toDateOnly(date),
        submitted_at: null,
      },
      data: {
        submitted_at: new Date(),
        updated_at: new Date(),
      },
    });

    let emailSent = false;
    let emailError: string | null = null;

    try {
      await sendAuditAlertEmail({
        company,
        companyName,
        project,
        projectName,
        auditor,
        date,
        total,
        answered,
        passed,
        fixed,
        zones,
        overallComment,
      });
      emailSent = true;
    } catch (error) {
      console.error("Send email error:", error);
      emailError = error instanceof Error ? error.message : "Unknown email error";
    }

    return NextResponse.json({
      success: true,
      message: emailSent
        ? "Audit saved and email sent successfully"
        : "Audit saved, but email failed",
      data: auditLog,
      emailSent,
      emailError,
    });
  } catch (error) {
    console.error("Create audit error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to save audit",
      },
      { status: 500 }
    );
  }
}
