"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import type { AuditStatus, Zone } from "./data";

type Checks = Record<string, AuditStatus | undefined>;
type Notes = Record<string, string>;
type ZoneComments = Record<string, string>;

type ProjectOption = {
  Company: string;
  CompanyName: string;
  Project: string;
  ProjectName: string;
  IsHousingJuristicPerson?: boolean;
};

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

export default function SamcoAuditPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const loginUser = session?.user;

  const [authChecked, setAuthChecked] = useState(false);

  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [company, setCompany] = useState("");
  const [project, setProject] = useState("");
  const [projectName, setProjectName] = useState("");
  const [auditor, setAuditor] = useState("");
  const [date, setDate] = useState(todayISO());
  const [zones, setZones] = useState<Zone[]>([]);
  const [activeZoneId, setActiveZoneId] = useState("");
  const [checks, setChecks] = useState<Checks>({});
  const [notes, setNotes] = useState<Notes>({});
  const [zoneComments, setZoneComments] = useState<ZoneComments>({});
  const [overallComment, setOverallComment] = useState("");
  const [showSummary, setShowSummary] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [loadingZones, setLoadingZones] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (status === "loading") return;

    if (status === "unauthenticated") {
      router.replace("/login");
      return;
    }

    const user = session?.user;

    if (status === "authenticated" && user?.company) {
      setCompany(user.company);
      setAuditor(user.username || user.displayName || "");
      setAuthChecked(true);
      loadProjects(user.company);
    }
  }, [status, session?.user?.company, router]);

  const allItems = useMemo(() => zones.flatMap((zone) => zone.items), [zones]);
  const activeZone = zones.find((zone) => zone.id === activeZoneId) ?? zones[0];
  const activeIndex = activeZone ? zones.findIndex((zone) => zone.id === activeZone.id) : -1;
  const isLastZone = activeZone ? activeIndex === zones.length - 1 : false;

  const stats = useMemo(() => {
    const answered = allItems.filter((item) => checks[item.id]).length;
    const fixed = allItems.filter((item) => checks[item.id] === "fix").length;
    const total = allItems.length;

    return {
      answered,
      fixed,
      total,
      passed: answered - fixed,
      pct: total > 0 ? Math.round((answered / total) * 100) : 0,
    };
  }, [allItems, checks]);

  async function loadProjects(companyCode: string) {
    if (!companyCode) return;

    setLoadingProjects(true);
    setErrorMessage("");

    try {
      const response = await fetch(
        `/api/external-projects?company=${encodeURIComponent(companyCode)}`
      );
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result?.message || "Cannot load projects");
      }

      setProjects(result.projects || []);
    } catch (error) {
      console.error(error);
      setErrorMessage("โหลดรายชื่อโครงการไม่สำเร็จ กรุณาตรวจสอบ Project API / Basic Auth");
    } finally {
      setLoadingProjects(false);
    }
  }

  async function loadZonesByProject(companyCode: string, projectCode: string) {
    if (!companyCode || !projectCode) {
      setZones([]);
      setActiveZoneId("");
      return;
    }

    setLoadingZones(true);
    setErrorMessage("");

    try {
      const selectedProject = projects.find(
        (item) => item.Company === companyCode && item.Project === projectCode
      );

      setProjectName(selectedProject?.ProjectName || projectCode);

      const response = await fetch(
        `/api/audit-config?project=${encodeURIComponent(projectCode)}`
      );
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result?.message || "Cannot load audit config");
      }

      const loadedZones = result.zones || [];

      setZones(loadedZones);
      setActiveZoneId(loadedZones[0]?.id || "");
      setChecks({});
      setNotes({});
      setZoneComments({});
      setOverallComment("");
      setShowSummary(false);
    } catch (error) {
      console.error(error);
      setErrorMessage("โหลด Checklist ของโครงการไม่สำเร็จ");
      setZones([]);
      setActiveZoneId("");
    } finally {
      setLoadingZones(false);
    }
  }

  function getZoneStat(zone: Zone) {
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

  function logout() {
    void signOut({ callbackUrl: "/login" });
  }

  function resetAuditOnly() {
    setProject("");
    setProjectName("");
    setDate(todayISO());
    setZones([]);
    setActiveZoneId("");
    setChecks({});
    setNotes({});
    setZoneComments({});
    setOverallComment("");
    setShowSummary(false);
    window.scrollTo(0, 0);
  }

  function buildPayload() {
    return {
      company,
      companyName: loginUser?.companyName || company,
      project,
      projectName,
      auditor,
      date,
      total: stats.total,
      answered: stats.answered,
      passed: stats.passed,
      fixed: stats.fixed,
      overallComment,
      zones: zones.map((zone) => ({
        id: zone.id,
        label: zone.label,
        comment: zoneComments[zone.id] || "",

        items: zone.items.map((item) => ({
          id: item.id,
          label: item.label,
          desc: item.desc,
          status: checks[item.id] || null,
          note: notes[item.id] || "",
        })),

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

      if (!response.ok || !result.success) {
        throw new Error(result?.message || "Submit failed");
      }

      if (result.emailSent) {
        alert("บันทึกข้อมูลและส่ง Email สำเร็จ");
      } else {
        alert("บันทึกข้อมูลสำเร็จ แต่อีเมลส่งไม่สำเร็จ กรุณาตรวจสอบ SMTP config");
      }
    } catch (error) {
      console.error(error);
      alert("บันทึกข้อมูลไม่สำเร็จ กรุณาตรวจสอบ API / Database config");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!authChecked) {
    return (
      <main>
        <div className="content">
          <div className="empty-state">กำลังตรวจสอบสิทธิ์...</div>
        </div>
      </main>
    );
  }

  if (showSummary) {
    return (
      <main>
        <div className="summary active">
          <div className="summary-hero">
            <div className="summary-icon">📋</div>
            <div className="summary-title">Audit เสร็จแล้ว!</div>
            <div className="summary-meta">
              {loginUser?.companyName || company || "—"} · {projectName || project || "—"} · {date || "—"} · {auditor || "—"}
            </div>
          </div>

          <div className="score-grid">
            <div className="score-card">
              <div className="score-val" style={{ color: "#1D4ED8" }}>
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

          {zones.map((zone) => {
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
              ส่ง summary ให้ทีมที่เกี่ยวข้อง และมอบหมาย owner สำหรับรายการที่ต้องแก้
            </div>
          </div>

          {zones.some((zone) => zoneComments[zone.id]) ? (
            <>
              <div style={{ fontSize: "0.65rem", fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.08em", margin: "1rem 0 0.6rem" }}>
                💬 Comments by Zone
              </div>
              {zones.filter((zone) => zoneComments[zone.id]).map((zone) => (
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
          <button className="btn-reset" onClick={() => setShowSummary(false)}>← กลับไปแก้ไข</button>
          <button className="btn-reset" onClick={resetAuditOnly}>🔄 เริ่ม Audit ใหม่</button>
          <button className="btn-reset" onClick={logout}>ออกจากระบบ</button>
        </div>
      </main>
    );
  }

  return (
    <main>
      <div className="deco" style={{ top: "15%", right: "5%" }}>🏢</div>
      <div className="deco" style={{ top: "40%", left: "3%" }}>📋</div>
      <div className="deco" style={{ top: "65%", right: "8%" }}>✅</div>
      <div className="deco" style={{ top: "80%", left: "6%" }}>🛠️</div>

      <div className="header">
        <div className="header-brand">SAMCO · Marketing</div>
        <div className="header-title">🏡 Weekly Site Audit <span>DB Config</span></div>

        <div className="login-user-bar">
          <span>
            {loginUser?.companyName || loginUser?.company} · {loginUser?.username}
          </span>
          <button type="button" onClick={logout}>Logout</button>
        </div>

        <div className="meta-grid">
          <div>
            <div className="meta-label">โครงการ</div>
            <select
              className="meta-input"
              value={project}
              disabled={loadingProjects}
              onChange={(e) => {
                const selectedProject = e.target.value;
                const selected = projects.find(
                  (item) => item.Company === company && item.Project === selectedProject
                );

                setProject(selectedProject);
                setProjectName(selected?.ProjectName || selectedProject);
                loadZonesByProject(company, selectedProject);
              }}
            >
              <option value="">{loadingProjects ? "กำลังโหลด..." : "เลือกโครงการ"}</option>
              {projects
                .filter((item) => item.Company === company)
                .map((item) => (
                  <option key={`${item.Company}-${item.Project}`} value={item.Project}>
                    {item.ProjectName}
                  </option>
                ))}
            </select>
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

      {errorMessage ? <div className="alert-box">{errorMessage}</div> : null}

      <div className="progress-wrap">
        <div className="progress-track"><div className="progress-fill" style={{ width: `${stats.pct}%` }} /></div>
        <span className="progress-text">{stats.answered}/{stats.total}</span>
        {stats.fixed > 0 ? <span className="fix-badge">🔴 {stats.fixed} ต้องแก้</span> : null}
      </div>

      <div className="zone-pills">
        {zones.map((zone) => {
          const zoneStat = getZoneStat(zone);
          const active = activeZone?.id === zone.id;
          const suffix = zoneStat.fixed > 0 ? " ⚠️" : zoneStat.answered === zoneStat.total && zoneStat.total > 0 ? " ✅" : "";

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
        {loadingZones ? (
          <div className="empty-state">กำลังโหลด Checklist...</div>
        ) : !project ? (
          <div className="empty-state">กรุณาเลือกโครงการก่อนเริ่ม Audit</div>
        ) : !activeZone ? (
          <div className="empty-state">ไม่พบ Checklist สำหรับโครงการนี้ กรุณาเพิ่มข้อมูลในตาราง audit_zones และ audit_items</div>
        ) : (
          <>
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
                <button className="btn-nav" onClick={() => setActiveZoneId(zones[activeIndex - 1].id)}>← {zones[activeIndex - 1].emoji}</button>
              ) : null}

              {!isLastZone ? (
                <button className="btn-nav" style={{ borderColor: activeZone.color, color: activeZone.color }} onClick={() => setActiveZoneId(zones[activeIndex + 1].id)}>
                  {zones[activeIndex + 1].emoji} ถัดไป →
                </button>
              ) : (
                <button className="btn-submit" disabled={stats.total === 0 || stats.answered < stats.total} onClick={() => setShowSummary(true)}>
                  {stats.answered < stats.total ? `🔒 กรอกให้ครบก่อน (${stats.pct}%)` : "🎉 ดูสรุปผล!"}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
