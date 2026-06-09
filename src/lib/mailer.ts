import nodemailer from "nodemailer";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

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
  fixItems: string;
  overallComment?: string;
}) {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    throw new Error("Missing SMTP configuration");
  }
  const auditor = escapeHtml(params.auditor || "-");
  const overallComment = escapeHtml(params.overallComment || "");

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

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #102033;">
      <h2 style="color:#1D4ED8;">SAMCO Weekly Site Audit</h2>
      <p><strong>บริษัท:</strong> ${params.companyName || params.company || "-"}</p>
      <p><strong>โครงการ:</strong> ${displayProject || "-"}</p>
      <p><strong>ผู้ตรวจ:</strong> ${auditor || "-"}</p>
      <p><strong>วันที่:</strong> ${params.date || "-"}</p>
      <hr />
      <p><strong>ตรวจทั้งหมด:</strong> ${params.total}</p>
      <p><strong>ตอบแล้ว:</strong> ${params.answered}</p>
      <p><strong>ผ่าน:</strong> ${params.passed}</p>
      <p><strong>ต้องแก้:</strong> ${params.fixed}</p>
      ${
        params.fixed > 0
          ? `<h3 style="color:#d93025;">รายการที่ต้องแก้</h3><pre style="background:#fff3f3;padding:12px;border-radius:8px;white-space:pre-wrap;">${params.fixItems}</pre>`
          : `<p style="color:#188038;"><strong>ไม่พบรายการที่ต้องแก้</strong></p>`
      }
      ${overallComment  ? `<h3>Overall Comment</h3><p>${overallComment }</p>` : ""}
    </div>
  `;

  await transporter.sendMail({
    from: process.env.ALERT_EMAIL_FROM || process.env.SMTP_USER,
    to: process.env.ALERT_EMAIL_TO,
    subject,
    html,
  });
}
