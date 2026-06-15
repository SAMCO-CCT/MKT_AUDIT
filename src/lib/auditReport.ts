export type AuditReportItemStatus = "pass" | "fix" | null;

export type AuditReportItem = {
  id?: string;
  label: string;
  desc?: string;
  status?: AuditReportItemStatus;
  note?: string;
};

export type AuditReportZone = {
  id?: string;
  label: string;
  comment?: string;
  items?: AuditReportItem[];
};

export type AuditReportRawJson = {
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
  zones?: AuditReportZone[];
  overallComment?: string;
};

export type AuditIssueRow = {
  issueNo: string;
  zoneId: string;
  zoneLabel: string;
  itemId: string;
  itemLabel: string;
  itemDesc: string;
  note: string;
  status: "open";
};

export type AuditSummaryRow = {
  zoneId: string;
  zoneLabel: string;
  zoneComment: string;
  itemId: string;
  itemLabel: string;
  itemDesc: string;
  status: string;
  note: string;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function asNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function asStatus(value: unknown): AuditReportItemStatus {
  if (value === "pass" || value === "fix") return value;
  return null;
}

export function normalizeAuditRawJson(rawJson: unknown): AuditReportRawJson {
  if (!isObject(rawJson)) {
    return { zones: [] };
  }

  const rawZones = Array.isArray(rawJson.zones) ? rawJson.zones : [];
  const zones: AuditReportZone[] = rawZones
    .filter(isObject)
    .map((zone) => {
      const rawItems = Array.isArray(zone.items) ? zone.items : [];
      const items: AuditReportItem[] = rawItems
        .filter(isObject)
        .map((item) => ({
          id: asString(item.id),
          label: asString(item.label, "-"),
          desc: asString(item.desc),
          status: asStatus(item.status),
          note: asString(item.note),
        }));

      return {
        id: asString(zone.id),
        label: asString(zone.label, "-"),
        comment: asString(zone.comment),
        items,
      };
    });

  return {
    company: asString(rawJson.company),
    companyName: asString(rawJson.companyName),
    project: asString(rawJson.project),
    projectName: asString(rawJson.projectName),
    auditor: asString(rawJson.auditor),
    date: asString(rawJson.date),
    total: asNumber(rawJson.total),
    answered: asNumber(rawJson.answered),
    passed: asNumber(rawJson.passed),
    fixed: asNumber(rawJson.fixed),
    zones,
    overallComment: asString(rawJson.overallComment),
  };
}

export function buildAuditSummaryRows(zones: AuditReportZone[]) {
  return zones.flatMap<AuditSummaryRow>((zone) =>
    (zone.items || []).map((item) => ({
      zoneId: zone.id || "",
      zoneLabel: zone.label || "-",
      zoneComment: zone.comment || "",
      itemId: item.id || "",
      itemLabel: item.label || "-",
      itemDesc: item.desc || "",
      status: item.status === "pass" ? "ผ่าน" : item.status === "fix" ? "ต้องแก้" : "รอตรวจ",
      note: item.note || "",
    }))
  );
}

export function buildAuditIssueRows(zones: AuditReportZone[]) {
  let issueIndex = 0;

  return zones.flatMap<AuditIssueRow>((zone) =>
    (zone.items || [])
      .filter((item) => item.status === "fix")
      .map((item) => {
        issueIndex += 1;

        return {
          issueNo: `ISS-${String(issueIndex).padStart(3, "0")}`,
          zoneId: zone.id || "",
          zoneLabel: zone.label || "-",
          itemId: item.id || "",
          itemLabel: item.label || "-",
          itemDesc: item.desc || "",
          note: item.note || "",
          status: "open",
        };
      })
  );
}

function sanitizeCsvCell(value: unknown) {
  const text = String(value ?? "");
  const safeText = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safeText.replace(/"/g, '""')}"`;
}

export function rowsToCsv(rows: unknown[][]) {
  return rows.map((row) => row.map(sanitizeCsvCell).join(",")).join("\n");
}
