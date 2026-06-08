"use client";

import { useMemo, useState } from "react";
import { ZONES, type AuditStatus } from "./data";

type Checks = Record<string, AuditStatus | undefined>;
type Notes = Record<string, string>;
type ZoneComments = Record<string, string>;

const ALL_ITEMS = ZONES.flatMap((zone) => zone.items);

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

export default function SamcoAuditPage() {
  const [project, setProject] = useState("");
  const [auditor, setAuditor] = useState("");
  const [date, setDate] = useState(todayISO());
  const [activeZoneId, setActiveZoneId] = useState(ZONES[0].id);
  const [checks, setChecks] = useState<Checks>({});
  const [notes, setNotes] = useState<Notes>({});
  const [zoneComments, setZoneComments] = useState<ZoneComments>({});
  const [overallComment, setOverallComment] = useState("");
  const [showSummary, setShowSummary] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const activeZone = ZONES.find((zone) => zone.id === activeZoneId) ?? ZONES[0];
  const activeIndex = ZONES.findIndex((zone) => zone.id === activeZone.id);
  const isLastZone = activeIndex === ZONES.length - 1;

  const stats = useMemo(() => {
    const answered = ALL_ITEMS.filter((item) => checks[item.id]).length;
    const fixed = ALL_ITEMS.filter((item) => checks[item.id] === "fix").length;
    const total = ALL_ITEMS.length;
    return {
      answered,
      fixed,
      total,
      passed: answered - fixed,
      pct: Math.round((answered / total) * 100),
    };
  }, [checks]);

  function getZoneStat(zone: (typeof ZONES)[number]) {
    const answered = zone.items.filter((item) => checks[item.id]).length;
    const fixed = zone.items.filter((item) => checks[item.id] === "fix").length;
    return { answered, fixed, total: zone.items.length };
  }

  function toggleCheck(itemId: string, value: AuditStatus) {
    setChecks((current) => ({
      ...current,
      [itemId]: current[itemId] === value ? undefined : value,
    }));
  }

  function resetAll() {
    setProject("");
    setAuditor("");
    setDate(todayISO());
    setActiveZoneId(ZONES[0].id);
    setChecks({});
    setNotes({});
    setZoneComments({});
    setOverallComment("");
    setShowSummary(false);
    window.scrollTo(0, 0);
  }

  function buildPayload() {
    return {
      project,
      auditor,
      date,
      total: stats.total,
      answered: stats.answered,
      passed: stats.passed,
      fixed: stats.fixed,
      overallComment,
      zones: ZONES.map((zone) => ({
        id: zone.id,
        label: zone.label,
        comment: zoneComments[zone.id] || "",
        fixItems: zone.items
          .filter((item) => checks[item.id] === "fix")
          .map((item) => ({
            id: item.id,
            label: item.label,
            desc: item.desc,
            note: notes[item.id] || "",
          })),
      })),
    };
  }

  async function submitAudit() {
    try {
      setIsSubmitting(true);

      const response = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result?.message || "Submit failed");
      }

      alert("บันทึกข้อมูลและส่ง Email สำเร็จ");
    } catch (error) {
      console.error(error);
      alert("บันทึกข้อมูลไม่สำเร็จ กรุณาตรวจสอบ API / Database / Email config");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (showSummary) {
    return (
      <main>
        <div className="summary active">
          <div className="summary-hero">
            <div className="summary-icon">🎉</div>
            <div className="summary-title">Audit เสร็จแล้ว!</div>
            <div className="summary-meta">
              {project || "—"} · {date || "—"} · {auditor || "—"}
            </div>
          </div>

          <div className="score-grid">
            <div className="score-card">
              <div className="score-val" style={{ color: "#FF9EC4" }}>
                {stats.answered}/{stats.total}
              </div>
              <div className="score-lbl">ตรวจแล้ว</div>
            </div>
            <div className="score-card">
              <div className="score-val" style={{ color: "#5DC98A" }}>{stats.passed}</div>
              <div className="score-lbl">ผ่าน ✅</div>
            </div>
            <div className="score-card">
              <div className="score-val" style={{ color: stats.fixed > 0 ? "#FF6B6B" : "#5DC98A" }}>
                {stats.fixed}
              </div>
              <div className="score-lbl">ต้องแก้ {stats.fixed > 0 ? "⚠️" : "🎉"}</div>
            </div>
          </div>

          {ZONES.map((zone) => {
            const zoneStat = getZoneStat(zone);
            const fixItems = zone.items.filter((item) => checks[item.id] === "fix");

            return (
              <div key={zone.id} className={`zone-result${zoneStat.fixed > 0 ? " has-fix" : ""}`}>
                <div className="zone-result-header">
                  <span className="zone-result-name" style={{ color: zone.color }}>
                    {zone.emoji} {zone.label}
                  </span>
                  <span className="zone-result-status" style={{ color: zoneStat.fixed > 0 ? "#FF6B6B" : "#5DC98A" }}>
                    {zoneStat.fixed > 0 ? `⚠️ ${zoneStat.fixed} จุด` : "✅ ผ่าน"}
                  </span>
                </div>

                {fixItems.map((item) => (
                  <div className="fix-item" key={item.id}>
                    <div className="fix-item-label">⚠️ {item.label}</div>
                    {notes[item.id] ? <div className="fix-item-note">📝 {notes[item.id]}</div> : null}
                  </div>
                ))}

                {zoneComments[zone.id] && fixItems.length > 0 ? (
                  <div className="fix-item">
                    <div className="fix-item-note">💬 {zoneComments[zone.id]}</div>
                  </div>
                ) : null}
              </div>
            );
          })}

          <div className="next-box">
            <div className="next-label">📬 Next Step</div>
            <div className="next-text">
              ส่ง summary เข้า LINE Group <strong style={{ color: "#FF9EC4" }}>Mkt + Sales + PM</strong> ภายใน 30 นาที
              <br />
              PM มอบหมาย owner ภายในเที่ยงวัน → แก้ไข + รูป After ภายในพรุ่งนี้ 🙏
            </div>
          </div>

          {ZONES.some((zone) => zoneComments[zone.id]) ? (
            <>
              <div style={{ fontSize: "0.65rem", fontWeight: 800, color: "#C4A0B0", textTransform: "uppercase", letterSpacing: "0.08em", margin: "1rem 0 0.6rem" }}>
                💬 Comments by Zone
              </div>
              {ZONES.filter((zone) => zoneComments[zone.id]).map((zone) => (
                <div className="comment-result" key={zone.id}>
                  <div className="comment-result-label" style={{ color: zone.color }}>
                    {zone.emoji} {zone.label}
                  </div>
                  <div className="comment-result-text">{zoneComments[zone.id]}</div>
                </div>
              ))}
            </>
          ) : null}

          {overallComment ? (
            <div className="next-box" style={{ marginTop: "0.75rem" }}>
              <div className="next-label">📋 Overall Comment</div>
              <div className="next-text">{overallComment}</div>
            </div>
          ) : null}

          <button className="btn-submit" onClick={submitAudit} disabled={isSubmitting} style={{ width: "100%", marginTop: "1rem" }}>
            {isSubmitting ? "กำลังส่ง..." : "📨 บันทึก + ส่ง Email"}
          </button>
          <button className="btn-reset" onClick={resetAll}>🔄 เริ่ม Audit ใหม่</button>
        </div>
      </main>
    );
  }

  return (
    <main>
      <div className="deco" style={{ top: "15%", right: "5%" }}>🌸</div>
      <div className="deco" style={{ top: "40%", left: "3%" }}>⭐</div>
      <div className="deco" style={{ top: "65%", right: "8%" }}>🌿</div>
      <div className="deco" style={{ top: "80%", left: "6%" }}>🌸</div>

      <div className="header">
        <div className="header-brand">SAMCO · Marketing</div>
        <div className="header-title">🏡 Weekly Site Audit <span>✨</span></div>
        <div className="meta-grid">
          <div>
            <div className="meta-label">โครงการ</div>
            <input className="meta-input" value={project} onChange={(e) => setProject(e.target.value)} type="text" placeholder="ชื่อโครงการ" />
          </div>
          <div>
            <div className="meta-label">ผู้ตรวจ</div>
            <input className="meta-input" value={auditor} onChange={(e) => setAuditor(e.target.value)} type="text" placeholder="ชื่อ" />
          </div>
          <div>
            <div className="meta-label">วันที่</div>
            <input className="meta-input" value={date} onChange={(e) => setDate(e.target.value)} type="date" />
          </div>
        </div>
      </div>

      <div className="progress-wrap">
        <div className="progress-track"><div className="progress-fill" style={{ width: `${stats.pct}%` }} /></div>
        <span className="progress-text">{stats.answered}/{stats.total}</span>
        {stats.fixed > 0 ? <span className="fix-badge">🔴 {stats.fixed} ต้องแก้</span> : null}
      </div>

      <div className="zone-pills">
        {ZONES.map((zone) => {
          const zoneStat = getZoneStat(zone);
          const active = zone.id === activeZone.id;
          const suffix = zoneStat.fixed > 0 ? " ⚠️" : zoneStat.answered === zoneStat.total ? " ✅" : "";

          return (
            <button
              key={zone.id}
              className={`pill${active ? " active" : ""}`}
              style={active ? { background: zone.color, boxShadow: `0 4px 12px ${zone.color}55` } : undefined}
              onClick={() => setActiveZoneId(zone.id)}
            >
              {zone.emoji} {zone.label.split("/")[0].split("&")[0].trim()}{suffix}
            </button>
          );
        })}
      </div>

      <div className="content">
        <div className="zone-title-wrap">
          <span className="zone-emoji">{activeZone.emoji}</span>
          <span className="zone-title" style={{ color: activeZone.color }}>{activeZone.label}</span>
          <span className="zone-count">{getZoneStat(activeZone).answered}/{getZoneStat(activeZone).total}</span>
        </div>

        <div>
          {activeZone.items.map((item, index) => {
            const value = checks[item.id] || "";

            return (
              <div className={`item-card${value ? ` ${value}` : ""}`} key={item.id}>
                <div className="item-row">
                  <div className="item-num">{index + 1}</div>
                  <div className="item-body">
                    <div className="item-label">{item.label}</div>
                    <div className="item-desc">{item.desc}</div>
                    <div className="btn-row">
                      <button className={`btn-check${value === "pass" ? " pass" : ""}`} onClick={() => toggleCheck(item.id, "pass")}>✅ ผ่าน</button>
                      <button className={`btn-check${value === "fix" ? " fix" : ""}`} onClick={() => toggleCheck(item.id, "fix")}>⚠️ ต้องแก้</button>
                    </div>
                    {value === "fix" ? (
                      <input
                        className="note-input"
                        placeholder="📝 รายละเอียด / ผู้รับผิดชอบ..."
                        value={notes[item.id] || ""}
                        onChange={(e) => setNotes((current) => ({ ...current, [item.id]: e.target.value }))}
                      />
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="comment-wrap">
          <div className="comment-label">💬 Comment — <span>{activeZone.label}</span></div>
          <textarea
            rows={2}
            placeholder="ข้อสังเกตเพิ่มเติม..."
            value={zoneComments[activeZone.id] || ""}
            onChange={(e) => setZoneComments((current) => ({ ...current, [activeZone.id]: e.target.value }))}
          />
        </div>

        {isLastZone ? (
          <div className="comment-wrap">
            <div className="comment-label overall">📋 Overall Comment &amp; สิ่งที่ต้องติดตาม</div>
            <textarea
              rows={3}
              className="overall"
              placeholder="ภาพรวมสัปดาห์นี้ สิ่งที่ดีขึ้น / แย่ลง / ต้องเฝ้าระวัง..."
              value={overallComment}
              onChange={(e) => setOverallComment(e.target.value)}
            />
          </div>
        ) : null}

        <div className="nav-btns">
          {activeIndex > 0 ? (
            <button className="btn-nav" onClick={() => setActiveZoneId(ZONES[activeIndex - 1].id)}>← {ZONES[activeIndex - 1].emoji}</button>
          ) : null}

          {!isLastZone ? (
            <button className="btn-nav" style={{ borderColor: activeZone.color, color: activeZone.color }} onClick={() => setActiveZoneId(ZONES[activeIndex + 1].id)}>
              {ZONES[activeIndex + 1].emoji} ถัดไป →
            </button>
          ) : (
            <button className="btn-submit" disabled={stats.answered < stats.total} onClick={() => setShowSummary(true)}>
              {stats.answered < stats.total ? `🔒 กรอกให้ครบก่อน (${stats.pct}%)` : "🎉 ดูสรุปผล!"}
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
