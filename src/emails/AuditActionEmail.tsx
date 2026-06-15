import * as React from "react";
import {
  Body,
  Button,
  Column,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Row,
  Section,
  Text,
} from "@react-email/components";
export type AuditEmailItem = {
  id?: string;
  label: string;
  desc?: string;
  note?: string;
  status?: "pass" | "fix" | null;
};

export type AuditEmailZone = {
  id?: string;
  label: string;
  comment?: string;
  items?: AuditEmailItem[];
};

export type AuditActionEmailProps = {
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
  appUrl?: string;
  summaryExportUrl?: string;
  issueExportUrl?: string;
};

const fontFamily =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

function formatAuditDate(value: string) {
  if (!value) return "-";

  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function getProgress(answered: number, total: number) {
  if (!total) return 0;
  return Math.round((answered / total) * 100);
}

function flattenRows(zones: AuditEmailZone[]) {
  return zones.flatMap((zone) =>
    (zone.items || []).map((item) => ({
      zoneLabel: zone.label,
      item,
    }))
  );
}

function groupRowsByZone(zones: AuditEmailZone[]) {
  return zones.map((zone) => {
    const items = zone.items || [];
    const total = items.length;
    const passed = items.filter((item) => item.status === "pass").length;
    const fixed = items.filter((item) => item.status === "fix").length;
    const pending = items.filter((item) => item.status !== "pass" && item.status !== "fix").length;
    const notes = items
      .map((item) => item.note?.trim())
      .filter((note): note is string => Boolean(note));

    return {
      zoneLabel: zone.label,
      zoneComment: zone.comment?.trim() || "",
      items,
      total,
      passed,
      fixed,
      pending,
      notes,
    };
  });
}

function zoneStatusLabel({
  total,
  fixed,
  pending,
}: {
  total: number;
  fixed: number;
  pending: number;
}) {
  if (total === 0) return "ไม่มีรายการ";
  if (fixed > 0) return `ต้องแก้ ${fixed} รายการ`;
  if (pending > 0) return `รอตรวจ ${pending} รายการ`;
  return "ผ่านทั้งหมด";
}

function getZoneStatusTone({
  total,
  fixed,
  pending,
}: {
  total: number;
  fixed: number;
  pending: number;
}): React.CSSProperties {
  if (total === 0 || pending > 0) {
    return {
      color: "#64748B",
      backgroundColor: "#F8FAFC",
      border: "1px solid #E2E8F0",
    };
  }

  if (fixed > 0) {
    return {
      color: "#E05A47",
      backgroundColor: "#FFF0F0",
      border: "1px solid #FDE8E8",
    };
  }

  return {
    color: "#047857",
    backgroundColor: "#ECFDF5",
    border: "1px solid #A7F3D0",
  };
}

function ZoneStatusBadge({
  total,
  fixed,
  pending,
}: {
  total: number;
  fixed: number;
  pending: number;
}) {
  return (
    <span
      style={{
        ...getZoneStatusTone({ total, fixed, pending }),
        display: "inline-block",
        borderRadius: "999px",
        padding: "4px 8px",
        fontSize: "11px",
        fontWeight: 800,
        whiteSpace: "nowrap",
      }}
    >
      {zoneStatusLabel({ total, fixed, pending })}
    </span>
  );
}

function zoneNoteSummary({
  zoneComment,
  notes,
}: {
  zoneComment: string;
  notes: string[];
}) {
  if (zoneComment) return zoneComment;
  if (notes.length > 0) return `มีหมายเหตุ ${notes.length} รายการ`;
  return "-";
}

function SummaryCard({
  label,
  value,
  tone = "blue",
}: {
  label: string;
  value: string;
  tone?: "blue" | "green" | "red" | "slate";
}) {
  const colorMap = {
    blue: "#0B3D91",
    green: "#047857",
    red: "#E05A47",
    slate: "#475569",
  } as const;

  return (
    <Column style={summaryColumnStyle}>
      <Text style={summaryLabelStyle}>{label}</Text>
      <Text style={{ ...summaryValueStyle, color: colorMap[tone] }}>{value}</Text>
    </Column>
  );
}

export function AuditActionEmail({
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
  appUrl,
  summaryExportUrl,
  issueExportUrl,
}: AuditActionEmailProps) {
  const displayProject = projectName || project || "-";
  const displayCompany = companyName || company || "-";
  const progress = getProgress(answered, total);
  const rows = flattenRows(zones);
  const groupedRows = groupRowsByZone(zones);
  const fixRows = rows.filter(({ item }) => item.status === "fix");
  const pendingRows = rows.filter(({ item }) => item.status !== "pass" && item.status !== "fix");
  const summaryButtonStyle = appUrl ? secondaryButtonStyle : buttonStyle;
  const issueButtonStyle =
    appUrl || summaryExportUrl ? secondaryButtonStyle : buttonStyle;

  const preview =
    fixed > 0
      ? `[Site Audit] ${displayProject} พบรายการต้องแก้ ${fixed} รายการ`
      : `[Site Audit] ${displayProject} ไม่พบรายการต้องแก้ไข`;

  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          <Section style={headerStyle}>
            <Text style={eyebrowStyle}>SAMMAKORN AUDIT SYSTEM</Text>
            <Heading style={headingStyle}>Daily Site Audit Summary</Heading>
            <Text style={metaStrongStyle}>บริษัท: {displayCompany}</Text>
            <Text style={metaStrongStyle}>โครงการ: {displayProject}</Text>
            <Text style={metaStyle}>
              วันที่ตรวจ: {formatAuditDate(date)} | ผู้ส่งรายงาน: {auditor || "-"}
            </Text>
          </Section>

          <Section style={fixed > 0 ? alertBannerStyle : successBannerStyle}>
            <Text style={bannerTitleStyle}>
              {fixed > 0
                ? `พบรายการที่ต้องแก้ไข ${fixed} รายการ`
                : "ไม่พบรายการที่ต้องแก้ไข"}
            </Text>
            <Text style={bannerTextStyle}>
              {fixed > 0
                ? "กรุณาตรวจสอบรายการที่ต้องแก้ไขด้านล่าง และอัปเดตความคืบหน้าในระบบ"
                : "ผลการตรวจสอบผ่านเกณฑ์ทั้งหมด สามารถเปิดระบบเพื่อดูรายละเอียดเพิ่มเติมได้"}
            </Text>
          </Section>

          <Section style={summaryGridStyle}>
            <Row>
              <SummaryCard label="ทั้งหมด" value={`${total} รายการ`} />
              <SummaryCard label="ผ่านเกณฑ์" value={`${passed} รายการ`} tone="green" />
            </Row>
            <Row>
              <SummaryCard label="ต้องแก้ไข" value={`${fixed} รายการ`} tone={fixed > 0 ? "red" : "green"} />
              <SummaryCard label="ความคืบหน้า" value={`${progress}%`} tone="slate" />
            </Row>
          </Section>

          {fixRows.length > 0 ? (
            <Section style={sectionStyle}>
              <Text style={sectionTitleStyle}>Issue Tracking</Text>
              <table width="100%" cellPadding="0" cellSpacing="0" style={tableStyle}>
                <thead>
                  <tr style={tableHeadRowStyle}>
                    <th align="left" style={{ ...thStyle, width: "14%" }}>Issue</th>
                    <th align="left" style={{ ...thStyle, width: "24%" }}>หมวดหมู่</th>
                    <th align="left" style={{ ...thStyle, width: "38%" }}>ประเด็น</th>
                    <th align="left" style={{ ...thStyle, width: "24%" }}>หมายเหตุ</th>
                  </tr>
                </thead>
                <tbody>
                  {fixRows.map(({ zoneLabel, item }, index) => (
                    <tr key={`fix-${zoneLabel}-${item.id || item.label}-${index}`} style={{ backgroundColor: index % 2 === 0 ? "#ffffff" : "#FFF7F7" }}>
                      <td style={tdStrongStyle}>ISS-{String(index + 1).padStart(3, "0")}</td>
                      <td style={tdStrongStyle}>{zoneLabel}</td>
                      <td style={tdStyle}>
                        <div style={{ fontWeight: 700, color: "#111827" }}>{item.label}</div>
                        {item.desc ? <div style={itemDescriptionStyle}>{item.desc}</div> : null}
                        <div style={openStatusStyle}>Open</div>
                      </td>
                      <td style={tdNoteStyle}>{item.note || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>
          ) : null}

          {pendingRows.length > 0 ? (
            <Section style={pendingBoxStyle}>
              <Text style={pendingTitleStyle}>ยังมีรายการรอตรวจ {pendingRows.length} รายการ</Text>
              <Text style={pendingTextStyle}>กรุณาตรวจสอบรายการที่ยังไม่ได้บันทึกสถานะให้ครบถ้วน</Text>
            </Section>
          ) : null}

          <Section style={sectionStyle}>
            <Text style={sectionTitleStyle}>สรุปผลการตรวจสอบ</Text>
            <table width="100%" cellPadding="0" cellSpacing="0" style={tableStyle}>
              <thead>
                <tr style={tableHeadRowStyle}>
                  <th align="left" style={{ ...thStyle, width: "24%" }}>หมวดหมู่</th>
                  <th align="left" style={{ ...thStyle, width: "42%" }}>ประเด็นที่ตรวจสอบ</th>
                  <th align="center" style={{ ...thStyle, width: "16%", textAlign: "center" }}>สถานะ</th>
                  <th align="left" style={{ ...thStyle, width: "18%" }}>หมายเหตุ</th>
                </tr>
              </thead>
              <tbody>
                {groupedRows.length > 0 ? (
                  groupedRows.map(({ zoneLabel, zoneComment, items, total, fixed, pending, notes }, index) => (
                    <tr key={`zone-summary-${zoneLabel}-${index}`} style={{ backgroundColor: index % 2 === 0 ? "#ffffff" : "#F8FAFC" }}>
                      <td style={tdStrongStyle}>{zoneLabel}</td>
                      <td style={tdStyle}>
                        {items.length > 0 ? (
                          <ul style={itemListStyle}>
                            {items.map((item, itemIndex) => (
                              <li key={`item-${item.id || item.label}-${itemIndex}`} style={itemListItemStyle}>
                                {item.label || "-"}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td align="center" style={{ ...tdStyle, textAlign: "center" }}>
                        <ZoneStatusBadge total={total} fixed={fixed} pending={pending} />
                      </td>
                      <td style={tdNoteStyle}>{zoneNoteSummary({ zoneComment, notes })}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} style={{ ...tdStyle, textAlign: "center", color: "#64748B" }}>
                      ไม่มีข้อมูลรายการตรวจสอบ
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </Section>

          {overallComment ? (
            <Section style={commentBoxStyle}>
              <Text style={commentTitleStyle}>หมายเหตุภาพรวม</Text>
              <Text style={commentTextStyle}>{overallComment}</Text>
            </Section>
          ) : null}

          <Section style={ctaBoxStyle}>
            <Text style={ctaTextStyle}>
              {fixed > 0
                ? "พบรายการที่ต้องดำเนินการแก้ไข กรุณาตรวจสอบรายละเอียดและอัปเดตความคืบหน้าในระบบ"
                : "ตรวจสอบเรียบร้อยแล้ว สามารถเปิดระบบเพื่อดูรายละเอียดหรือ Export CSV ได้"}
            </Text>
            {appUrl ? (
              <Button href={appUrl} style={buttonStyle}>
                เปิดระบบติดตามงาน
              </Button>
            ) : null}
            {summaryExportUrl ? (
              <Button href={summaryExportUrl} style={summaryButtonStyle}>
                Export ตารางสรุป CSV
              </Button>
            ) : null}
            {issueExportUrl ? (
              <Button href={issueExportUrl} style={issueButtonStyle}>
                Export Issue Tracking CSV
              </Button>
            ) : null}
          </Section>

          <Hr style={hrStyle} />
          <Text style={footerStyle}>
            อีเมลฉบับนี้ส่งจากระบบจัดการงานตรวจสอบของบริษัท สัมมากร จำกัด (มหาชน) โดยอัตโนมัติ
          </Text>
          <Text style={copyrightStyle}>© 2026 Sammakorn Public Company Limited. All rights reserved.</Text>
        </Container>
      </Body>
    </Html>
  );
}

const bodyStyle: React.CSSProperties = {
  margin: 0,
  padding: "24px 0",
  backgroundColor: "#0B3D91",
  fontFamily,
};

const containerStyle: React.CSSProperties = {
  maxWidth: "580px",
  margin: "0 auto",
  backgroundColor: "#F6F9FC",
  borderRadius: "18px",
  padding: "24px 18px",
  color: "#111827",
};

const headerStyle: React.CSSProperties = { padding: "0 10px 14px" };

const eyebrowStyle: React.CSSProperties = {
  borderLeft: "4px solid #E05A47",
  paddingLeft: "12px",
  fontSize: "11px",
  fontWeight: 800,
  color: "#E05A47",
  textTransform: "uppercase",
  letterSpacing: "1px",
  margin: "0 0 8px",
};

const headingStyle: React.CSSProperties = {
  fontSize: "24px",
  lineHeight: 1.2,
  fontWeight: 800,
  color: "#0B3D91",
  margin: "0 0 8px",
};

const metaStrongStyle: React.CSSProperties = {
  fontSize: "14px",
  color: "#444444",
  margin: "0 0 3px",
  fontWeight: 700,
};

const metaStyle: React.CSSProperties = { fontSize: "12px", color: "#666666", margin: 0 };

const alertBannerStyle: React.CSSProperties = {
  backgroundColor: "#FFF0F0",
  border: "1px solid #FDE8E8",
  borderLeft: "5px solid #E05A47",
  borderRadius: "12px",
  padding: "14px 16px",
  margin: "10px 0 18px",
};

const successBannerStyle: React.CSSProperties = {
  backgroundColor: "#ECFDF5",
  border: "1px solid #A7F3D0",
  borderLeft: "5px solid #047857",
  borderRadius: "12px",
  padding: "14px 16px",
  margin: "10px 0 18px",
};

const bannerTitleStyle: React.CSSProperties = {
  fontSize: "15px",
  fontWeight: 800,
  color: "#0B3D91",
  margin: "0 0 4px",
};

const bannerTextStyle: React.CSSProperties = {
  fontSize: "13px",
  color: "#475569",
  lineHeight: 1.55,
  margin: 0,
};

const summaryGridStyle: React.CSSProperties = { marginBottom: "18px" };
const summaryColumnStyle: React.CSSProperties = {
  width: "50%",
  backgroundColor: "#ffffff",
  border: "1px solid #E6EBF1",
  borderRadius: "8px",
  padding: "13px 12px",
  textAlign: "center",
};
const summaryLabelStyle: React.CSSProperties = {
  fontSize: "10px",
  color: "#666666",
  margin: "0 0 4px",
  fontWeight: 700,
  textTransform: "uppercase",
};
const summaryValueStyle: React.CSSProperties = {
  fontSize: "18px",
  fontWeight: 800,
  margin: 0,
};

const sectionStyle: React.CSSProperties = { marginTop: "18px" };
const sectionTitleStyle: React.CSSProperties = {
  fontSize: "14px",
  fontWeight: 800,
  color: "#0B3D91",
  margin: "0 0 10px 5px",
};
const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  backgroundColor: "#ffffff",
  borderRadius: "8px",
  overflow: "hidden",
  border: "1px solid #E6EBF1",
  boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
};
const tableHeadRowStyle: React.CSSProperties = { backgroundColor: "#0B3D91" };
const thStyle: React.CSSProperties = {
  color: "#ffffff",
  fontSize: "12px",
  fontWeight: 700,
  padding: "12px 10px",
  borderBottom: "2px solid #082d6b",
};
const tdStyle: React.CSSProperties = {
  color: "#111827",
  fontSize: "12px",
  fontWeight: 600,
  padding: "10px",
  borderBottom: "1px solid #E6EBF1",
  verticalAlign: "top",
};
const tdStrongStyle: React.CSSProperties = {
  ...tdStyle,
  color: "#334155",
  fontWeight: 800,
};
const tdNoteStyle: React.CSSProperties = {
  ...tdStyle,
  color: "#334155",
  fontWeight: 500,
};
const itemDescriptionStyle: React.CSSProperties = {
  color: "#64748B",
  fontSize: "11px",
  fontWeight: 500,
  marginTop: "3px",
};
const openStatusStyle: React.CSSProperties = {
  color: "#E05A47",
  fontSize: "10px",
  fontWeight: 800,
  marginTop: "5px",
  textTransform: "uppercase",
};
const itemListStyle: React.CSSProperties = {
  margin: 0,
  paddingLeft: "16px",
};
const itemListItemStyle: React.CSSProperties = {
  margin: "0 0 8px",
  paddingLeft: "2px",
  lineHeight: 1.35,
};
const pendingBoxStyle: React.CSSProperties = {
  backgroundColor: "#FFFBEB",
  border: "1px solid #FDE68A",
  borderRadius: "10px",
  padding: "13px 15px",
  marginTop: "16px",
};
const pendingTitleStyle: React.CSSProperties = { fontSize: "13px", color: "#92400E", fontWeight: 800, margin: "0 0 4px" };
const pendingTextStyle: React.CSSProperties = { fontSize: "12px", color: "#92400E", margin: 0 };
const commentBoxStyle: React.CSSProperties = {
  backgroundColor: "#ffffff",
  border: "1px solid #E6EBF1",
  borderRadius: "8px",
  padding: "14px",
  marginTop: "18px",
};
const commentTitleStyle: React.CSSProperties = { fontSize: "13px", color: "#0B3D91", margin: "0 0 6px", fontWeight: 800 };
const commentTextStyle: React.CSSProperties = { fontSize: "13px", color: "#334155", margin: 0, lineHeight: 1.6 };
const ctaBoxStyle: React.CSSProperties = {
  backgroundColor: "#EBF3FF",
  border: "1px dashed #BFDBFE",
  borderRadius: "8px",
  padding: "16px",
  marginTop: "28px",
  textAlign: "center",
};
const ctaTextStyle: React.CSSProperties = { fontSize: "13px", color: "#1E40AF", margin: "0 0 12px", fontWeight: 700, lineHeight: 1.55 };
const buttonStyle: React.CSSProperties = {
  backgroundColor: "#E05A47",
  color: "#ffffff",
  fontSize: "13px",
  fontWeight: 800,
  textDecoration: "none",
  display: "inline-block",
  padding: "10px 20px",
  borderRadius: "6px",
  boxShadow: "0 2px 4px rgba(224,90,71,0.2)",
};
const secondaryButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  backgroundColor: "#0B3D91",
  marginLeft: "8px",
};
const hrStyle: React.CSSProperties = { borderColor: "#E6EBF1", margin: "25px 0" };
const footerStyle: React.CSSProperties = { fontSize: "11px", color: "#9CA3AF", margin: "0 0 5px", textAlign: "center", lineHeight: 1.5 };
const copyrightStyle: React.CSSProperties = { fontSize: "11px", color: "#D1D5DB", margin: 0, textAlign: "center" };
