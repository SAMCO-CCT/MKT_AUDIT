import type { CSSProperties, ReactNode } from "react";

export type SamcoIconName =
  | "entrance"
  | "shield"
  | "building"
  | "home"
  | "pool"
  | "fitness"
  | "leaf"
  | "tag"
  | "check"
  | "alert"
  | "chevR"
  | "chevL"
  | "calendar"
  | "user"
  | "pin"
  | "send"
  | "save"
  | "flag"
  | "trophy"
  | "refresh"
  | "lock"
  | "logout"
  | "eye"
  | "eyeoff";

const ICON_PATHS: Record<SamcoIconName, ReactNode> = {
  entrance: <><path d="M4 21h16"/><path d="M6 21V5a1 1 0 0 1 1-1h7l4 3v14"/><path d="M12 12h.5"/></>,
  shield: <><path d="M12 3l7 2.5v5.2c0 4.3-3 7-7 8.3-4-1.3-7-4-7-8.3V5.5L12 3z"/><path d="M9 11.5l2 2 4-4.2"/></>,
  building: <><path d="M3 21h18"/><path d="M5 21V5a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v16"/><path d="M14 21V9h4a1 1 0 0 1 1 1v11"/><path d="M8 8h3M8 12h3M8 16h3"/></>,
  home: <><path d="M4 11l8-6 8 6"/><path d="M6 10v10h12V10"/><path d="M10 20v-5h4v5"/></>,
  pool: <><path d="M3 13c1.6 0 1.6-1.4 3.2-1.4S7.8 13 9.4 13s1.6-1.4 3.2-1.4S14.2 13 15.8 13s1.6-1.4 3.2-1.4S20.6 13 21 13"/><path d="M3 18c1.6 0 1.6-1.4 3.2-1.4S7.8 18 9.4 18s1.6-1.4 3.2-1.4S14.2 18 15.8 18s1.6-1.4 3.2-1.4S20.6 18 21 18"/><path d="M8 11V5.5A1.5 1.5 0 0 1 9.5 4"/><path d="M16 11V5.5A1.5 1.5 0 0 0 14.5 4"/></>,
  fitness: <><path d="M3 12h2M19 12h2"/><path d="M5 9v6M19 9v6"/><path d="M8 7v10M16 7v10"/><path d="M8 12h8"/></>,
  leaf: <><path d="M11 20v-7"/><path d="M11 13c-3.3 0-6-2.2-6-6 0-1 .2-2 .5-2.8C6.3 4 7.4 4 8.5 4c3.3 0 6 2.2 6 6 0 .5-.1 1-.2 1.4"/><path d="M13 16c2.5 0 4.5-1.6 4.5-4.4 0-.8-.2-1.5-.4-2.1-1.6-.1-2.4-.1-3.3.3"/></>,
  tag: <><path d="M4 13V6a2 2 0 0 1 2-2h7l7 7-7 7-7-7z"/><circle cx="9" cy="9" r="1.3"/></>,
  check: <path d="M5 12.5l4.5 4.5L19 7"/>,
  alert: <><path d="M12 4l8.5 15H3.5L12 4z"/><path d="M12 10v4"/><path d="M12 17h.01"/></>,
  chevR: <path d="M9 5l7 7-7 7"/>,
  chevL: <path d="M15 5l-7 7 7 7"/>,
  calendar: <><rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 9.5h17M8 3v3M16 3v3"/></>,
  user: <><circle cx="12" cy="8" r="3.4"/><path d="M5 20c.6-3.6 3.4-5.4 7-5.4s6.4 1.8 7 5.4"/></>,
  pin: <><path d="M12 21c4-4.2 6-7.4 6-10.2A6 6 0 0 0 6 10.8C6 13.6 8 16.8 12 21z"/><circle cx="12" cy="10.5" r="2"/></>,
  send: <><path d="M21 4L3 11l6 2.5L21 4z"/><path d="M21 4l-3.5 16-4.5-6.5"/></>,
  save: <><path d="M5 4h12l2 2v14H5z"/><path d="M8 4v6h8V4"/><path d="M8 20v-6h8v6"/></>,
  flag: <><path d="M5 21V4M5 4l10 0 -2 4 2 4H5"/></>,
  trophy: <><path d="M7 4h10v4a5 5 0 0 1-10 0V4z"/><path d="M7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3"/><path d="M12 13v4M9 21h6M10 17h4"/></>,
  refresh: <><path d="M4 12a8 8 0 0 1 13.7-5.6L20 8"/><path d="M20 4v4h-4"/><path d="M20 12a8 8 0 0 1-13.7 5.6L4 16"/><path d="M4 20v-4h4"/></>,
  lock: <><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/><path d="M12 15v2"/></>,
  logout: <><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"/><path d="M10 16l4-4-4-4"/><path d="M14 12H4"/></>,
  eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="2.6"/></>,
  eyeoff: <><path d="M10.6 6.2A9.7 9.7 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3 3.6M6.2 6.2A17 17 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 4-.8"/><path d="M9.8 9.8a3 3 0 0 0 4.4 4.1M4 4l16 16"/></>,
};

type IconProps = {
  name: SamcoIconName;
  size?: number;
  stroke?: number;
  style?: CSSProperties;
};

export default function SamcoIcon({ name, size = 18, stroke = 1.85, style }: IconProps) {
  return (
    <span className="ico" style={style}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {ICON_PATHS[name]}
      </svg>
    </span>
  );
}
