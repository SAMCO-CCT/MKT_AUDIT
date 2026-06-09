import { NextRequest, NextResponse } from "next/server";
import { pool } from "../../../lib/db";
import { sendAuditAlertEmail } from "../../../lib/mailer";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";


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

export async function POST(req: NextRequest) {
  try {
    // const body = (await req.json()) as AuditPayload;
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    let body: any;

    try {
      body = await req.json() as AuditPayload;
    } catch {
      return NextResponse.json(
        { success: false, message: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const requiredFields = ["project", "projectName", "auditor", "date", "zones"];

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

    // ใช้ company จาก session เท่านั้น ไม่เชื่อค่าที่ client ส่งมา
    const company = session.user.company;
    const companyName = session.user.companyName;

    const project = body.project || "";
    const projectName = body.projectName || project;
    const auditor = body.auditor || "";
    const date = body.date || new Date().toISOString().slice(0, 10);
    const zones: AuditZone[] = Array.isArray(body.zones) ? body.zones : [];

    const allItems = zones.flatMap((zone) =>
      Array.isArray(zone.items) ? zone.items : []
    );

    const total = allItems.length;

    const answered = allItems.filter(
      (item) => item.status === "pass" || item.status === "fix"
    ).length;

    const fixed = allItems.filter(
      (item) => item.status === "fix"
    ).length;

    const passed = allItems.filter(
      (item) => item.status === "pass"
    ).length;
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

    const result = await pool.query(
      `
      INSERT INTO audit_logs (
        company,
        company_name,
        project_code,
        project,
        auditor,
        audit_date,
        total_items,
        answered,
        passed,
        fixed,
        fix_items,
        overall_comment,
        raw_json
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      RETURNING id, created_at
      `,
      [
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
        fixItemsText,
        overallComment,
        body,
      ]
    );

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
        fixItems: fixItemsText,
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
      data: result.rows[0],
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
