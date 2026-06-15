import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hasProjectPermission } from "@/lib/permissions";
import { verifyAuditLinkToken } from "@/lib/auditLinkToken";
import {
  buildAuditIssueRows,
  normalizeAuditRawJson,
  rowsToCsv,
} from "@/lib/auditReport";

function formatDate(value?: Date | string | null) {
  if (!value) return "unknown-date";

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "unknown-date";

  return date.toISOString().slice(0, 10);
}

async function canReadAuditLog(req: NextRequest, auditLog: {
  id: string;
  company: string | null;
  project_code: string | null;
}) {
  const token = req.nextUrl.searchParams.get("token");

  if (verifyAuditLinkToken(auditLog.id, token)) return true;

  const session = await getServerSession(authOptions);

  if (!session?.user?.id || !auditLog.company || !auditLog.project_code) {
    return false;
  }

  return hasProjectPermission(
    session.user.id,
    auditLog.company,
    auditLog.project_code
  );
}

export async function GET(req: NextRequest) {
  const auditLogId = req.nextUrl.searchParams.get("auditLogId") || req.nextUrl.searchParams.get("id");
  const format = req.nextUrl.searchParams.get("format") || "json";

  if (!auditLogId) {
    return NextResponse.json(
      { success: false, message: "Missing auditLogId" },
      { status: 400 }
    );
  }

  const auditLog = await prisma.audit_logs.findUnique({
    where: { id: auditLogId },
    select: {
      id: true,
      company: true,
      company_name: true,
      project_code: true,
      project: true,
      auditor: true,
      audit_date: true,
      raw_json: true,
      fixed: true,
      created_at: true,
    },
  });

  if (!auditLog) {
    return NextResponse.json(
      { success: false, message: "Audit log not found" },
      { status: 404 }
    );
  }

  const allowed = await canReadAuditLog(req, auditLog);

  if (!allowed) {
    return NextResponse.json(
      { success: false, message: "Forbidden" },
      { status: 403 }
    );
  }

  const rawJson = normalizeAuditRawJson(auditLog.raw_json);
  const issues = buildAuditIssueRows(rawJson.zones || []);

  const payload = {
    success: true,
    audit: {
      id: auditLog.id,
      company: auditLog.company,
      companyName: auditLog.company_name,
      project: auditLog.project_code,
      projectName: auditLog.project,
      auditor: auditLog.auditor,
      auditDate: formatDate(auditLog.audit_date),
      fixed: auditLog.fixed || 0,
      createdAt: auditLog.created_at,
    },
    issues,
  };

  if (format === "csv") {
    const csv = rowsToCsv([
      [
        "Issue No",
        "Company",
        "Project Code",
        "Project Name",
        "Audit Date",
        "Zone",
        "Issue",
        "Description",
        "Note",
        "Status",
      ],
      ...issues.map((issue) => [
        issue.issueNo,
        auditLog.company || "",
        auditLog.project_code || "",
        auditLog.project || "",
        formatDate(auditLog.audit_date),
        issue.zoneLabel,
        issue.itemLabel,
        issue.itemDesc,
        issue.note,
        issue.status,
      ]),
    ]);

    const fileName = `audit-issues-${auditLog.project_code || "project"}-${formatDate(auditLog.audit_date)}.csv`;

    return new NextResponse(`\uFEFF${csv}`, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  }

  return NextResponse.json(payload);
}
