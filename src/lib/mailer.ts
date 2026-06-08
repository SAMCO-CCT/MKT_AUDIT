import nodemailer from "nodemailer";

export async function sendAuditAlertEmail(params: {
  project: string;
  auditor: string;
  date: string;
  total: number;
  answered: number;
  passed: number;
  fixed: number;
  fixItems: string;
  overallComment?: string;
}) {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const subject =
    params.fixed > 0
      ? `⚠️ Audit Alert: ${params.project} มี ${params.fixed} รายการต้องแก้`
      : `✅ Audit Completed: ${params.project}`;

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6;">
      <h2>🏡 SAMCO Weekly Audit</h2>

      <p><strong>โครงการ:</strong> ${params.project || "-"}</p>
      <p><strong>ผู้ตรวจ:</strong> ${params.auditor || "-"}</p>
      <p><strong>วันที่:</strong> ${params.date || "-"}</p>

      <hr />

      <p><strong>ตรวจทั้งหมด:</strong> ${params.total}</p>
      <p><strong>ตอบแล้ว:</strong> ${params.answered}</p>
      <p><strong>ผ่าน:</strong> ${params.passed}</p>
      <p><strong>ต้องแก้:</strong> ${params.fixed}</p>

      ${
        params.fixed > 0
          ? `
            <h3 style="color:#d93025;">รายการที่ต้องแก้</h3>
            <pre style="background:#fff3f3;padding:12px;border-radius:8px;">${params.fixItems}</pre>
          `
          : `<p style="color:#188038;"><strong>ไม่พบรายการที่ต้องแก้</strong></p>`
      }

      ${
        params.overallComment
          ? `
            <h3>Overall Comment</h3>
            <p>${params.overallComment}</p>
          `
          : ""
      }
    </div>
  `;

  await transporter.sendMail({
    from: process.env.ALERT_EMAIL_FROM,
    to: process.env.ALERT_EMAIL_TO,
    subject,
    html,
  });
}