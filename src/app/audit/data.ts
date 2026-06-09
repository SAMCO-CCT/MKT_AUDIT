export type AuditStatus = "pass" | "fix";

export type AuditItem = {
  id: string;
  label: string;
  desc: string;
};

export type Zone = {
  id: string;
  emoji: string;
  label: string;
  color: string;
  bg: string;
  items: AuditItem[];
};
