import { NextRequest, NextResponse } from "next/server";
import { pool } from "../../../lib/db";
import { sendAuditAlertEmail } from "../../../lib/mailer";

type AuditZone = {
  id?: string;
  label: string;
  fixItems?: {
    id?: string;
    label: string;
    note?: string;
  }[];
};

type AuditPayload = {
  project?: string;
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
    const body = (await req.json()) as AuditPayload;

    const project = body.project || "";
    const auditor = body.auditor || "";
    const date = body.date || new Date().toISOString().slice(0, 10);
    const total = body.total || 0;
    const answered = body.answered || 0;
    const passed = body.passed || 0;
    const fixed = body.fixed || 0;
    const overallComment = body.overallComment || "";

    const fixItems: string[] = [];

    if (Array.isArray(body.zones)) {
      for (const zone of body.zones) {
        if (Array.isArray(zone.fixItems)) {
          for (const item of zone.fixItems) {
            fixItems.push(
              `[${zone.label}] ${item.label}${item.note ? ` — ${item.note}` : ""}`
            );
          }
        }
      }
    }

    const fixItemsText = fixItems.join("\n");

    const result = await pool.query(
      `
      INSERT INTO audit_logs (
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
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING id, created_at
      `,
      [
        project,
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

    await sendAuditAlertEmail({
      project,
      auditor,
      date,
      total,
      answered,
      passed,
      fixed,
      fixItems: fixItemsText,
      overallComment,
    });

    return NextResponse.json({
      success: true,
      message: "Audit saved and email sent successfully",
      data: result.rows[0],
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