import * as React from "react";
import nodemailer from "nodemailer";
import { render } from "@react-email/render";
import { AuditActionEmail, type AuditEmailZone } from "@/emails/AuditActionEmail";

export async function sendAuditAlertEmail(params: {
  company?: string;
  companyName?: string;
  project: string;
  projectName?: string;
  auditor: string;
  date: string;
  total: number;
  answered: number;
  passed: number;
  fixed: number;
  zones: AuditEmailZone[];
  overallComment?: string;
}) {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    throw new Error("Missing SMTP configuration");
  }

  if (!process.env.ALERT_EMAIL_TO) {
    throw new Error("Missing ALERT_EMAIL_TO configuration");
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT || 587) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const displayProject = params.projectName || params.project;
  const subject =
    params.fixed > 0
      ? `Audit Alert: ${displayProject} มี ${params.fixed} รายการต้องแก้`
      : `Audit Completed: ${displayProject}`;

  const html = await render(
    React.createElement(AuditActionEmail, {
      ...params,
      appUrl: process.env.NEXT_PUBLIC_APP_URL,
    })
  );

  const text = [
    "SAMMAKORN AUDIT SYSTEM",
    `โครงการ: ${displayProject || "-"}`,
    `วันที่ตรวจ: ${params.date || "-"}`,
    `ผู้ส่งรายงาน: ${params.auditor || "-"}`,
    `รายการตรวจทั้งหมด: ${params.total}`,
    `ตอบแล้ว: ${params.answered}`,
    `ผ่าน: ${params.passed}`,
    `ต้องแก้: ${params.fixed}`,
    params.overallComment ? `หมายเหตุภาพรวม: ${params.overallComment}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  await transporter.sendMail({
    from: process.env.ALERT_EMAIL_FROM || process.env.SMTP_USER,
    to: process.env.ALERT_EMAIL_TO,
    subject,
    html,
    text,
  });
}
