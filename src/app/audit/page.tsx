"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import SamcoIcon, { type SamcoIconName } from "@/components/SamcoIcon";
import {
  buildSessionDraftKey,
  buildSessionDraftSyncHashKey,
  buildSessionDraftUserPrefix,
} from "@/lib/sessionDraftKeys";
import {
  getUniqueAuditProjects,
  type ExternalProject,
} from "@/types/project";
import { normalizeDateInputValue, todayDateInputValue } from "@/lib/date";
import type { AuditStatus, Zone } from "./data";

type Checks = Record<string, AuditStatus | undefined>;
type Notes = Record<string, string>;
type ZoneComments = Record<string, string>;

type ProjectOption = ExternalProject;

type DraftRawItem = {
  id?: string;
  label?: string;
  desc?: string;
  status?: AuditStatus | null;
  note?: string;
};

type DraftRawZone = {
  id?: string;
  label?: string;
  comment?: string;
  items?: DraftRawItem[];
};

type SessionDraftItem = {
  id: string;
  label: string;
  desc?: string;
  status: AuditStatus | null;
  note: string;
};

type SessionDraftZone = {
  id: string;
  label: string;
  comment: string;
  items: SessionDraftItem[];
};

type SessionAuditDraft = {
  schemaVersion: 1;
  userId: string;
  company: string;
  companyName: string;
  project: string;
  projectName: string;
  auditDate: string;
  auditorName: string;
  zones: SessionDraftZone[];
  overallComment: string;
  localSavedAt: string;
};

type LastAuditSelection = {
  schemaVersion: 1;
  userId: string;
  company: string;
  project: string;
  projectName: string;
  auditDate: string;
  savedAt: string;
};

type AuditDraftListItem = {
  draft_id: string;
  company_code: string;
  company_name?: string | null;
  project_code: string;
  project_name: string;
  audit_date: string;
  auditor_name?: string | null;
  total_items: number;
  answered_items: number;
  passed_items: number;
  fixed_items: number;
  last_saved_at: string;
};

type SummaryProps = {
  companyName: string;
  projectName: string;
  auditor: string;
  date: string;
  zones: Zone[];
  checks: Checks;
  notes: Notes;
  zoneComments: ZoneComments;
  overallComment: string;
  stats: {
    answered: number;
    fixed: number;
    total: number;
    passed: number;
    pct: number;
  };
  getZoneStat: (zone: Zone) => {
    answered: number;
    fixed: number;
    total: number;
  };
  onBack: () => void;
  onReset: () => void;
  onSubmit: () => void;
  onSaveDraft: () => void;
  isSubmitting: boolean;
  isSavingDraft: boolean;
};

function todayISO() {
  return todayDateInputValue();
}

function weekNo() {
  const current = new Date();
  const firstDay = new Date(current.getFullYear(), 0, 1);
  return Math.ceil(
    ((current.getTime() - firstDay.getTime()) / 86400000 +
      firstDay.getDay() +
      1) /
      7,
  );
}

function zoneIconName(zone: Zone): SamcoIconName {
  const key = `${zone.id} ${zone.label}`.toLowerCase();
  if (key.includes("security") || key.includes("ป้อม") || key.includes("ยาม"))
    return "shield";
  if (key.includes("gallery") || key.includes("sales")) return "building";
  if (key.includes("show") || key.includes("house") || key.includes("บ้าน"))
    return "home";
  if (key.includes("pool") || key.includes("สระ")) return "pool";
  if (key.includes("fitness") || key.includes("gym")) return "fitness";
  if (key.includes("สวน") || key.includes("common") || key.includes("ส่วนกลาง"))
    return "leaf";
  if (key.includes("shelf") || key.includes("unit")) return "tag";
  return "entrance";
}

function shortZoneLabel(zone: Zone) {
  return zone.label.split("/")[0].split("&")[0].trim();
}

export default function SamcoAuditPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const loginUser = session?.user;
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const dbSyncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const draftDirtyRef = useRef(false);
  const lastLocalDraftHashRef = useRef<string | null>(null);
  const lastSyncedDraftHashRef = useRef<string | null>(null);
  const firstStateUpdate = useRef(true);
  const isRestoringSessionDraftRef = useRef(false);
  const hasRestoredLastSelectionRef = useRef(false);
  const restoredSessionDraftKeyRef = useRef<string | null>(null);

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
  const [toast, setToast] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [lastLocalSavedAt, setLastLocalSavedAt] = useState<string | null>(null);
  const [lastDraftSavedAt, setLastDraftSavedAt] = useState<string | null>(null);

  const [drafts, setDrafts] = useState<AuditDraftListItem[]>([]);
  const [showDraftPopup, setShowDraftPopup] = useState(false);
  const [loadingDrafts, setLoadingDrafts] = useState(false);
  const [draftActionLoading, setDraftActionLoading] = useState<string | null>(
    null,
  );

  useEffect(() => {
    if (status === "loading") return;

    if (status === "unauthenticated") {
      router.replace("/login");
      return;
    }

    const user = session?.user;

    if (status === "authenticated" && user?.company) {
      setCompany(user.company);
      setAuditor(user.displayName || user.name || user.username || "");
      setAuthChecked(true);
      void loadProjects(user.company);
    }
  }, [status, session?.user?.company, router]);

  useEffect(() => {
    if (!authChecked) return;

    cleanupSessionDraftsForOtherUsers();
    void loadDraftList();
  }, [authChecked]);

  useEffect(() => {
    if (!authChecked) return;
    if (firstStateUpdate.current) {
      firstStateUpdate.current = false;
      return;
    }

    setToast(true);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(false), 1400);
  }, [
    checks,
    notes,
    zoneComments,
    overallComment,
    project,
    auditor,
    date,
    authChecked,
  ]);

  useEffect(() => {
    if (!authChecked) return;
    if (!company || !project || !projectName || !date) return;
    if (
      isSubmitting ||
      draftActionLoading ||
      isRestoringSessionDraftRef.current
    )
      return;

    if (sessionSaveTimerRef.current) {
      clearTimeout(sessionSaveTimerRef.current);
    }

    if (!hasDraftInput()) return;

    sessionSaveTimerRef.current = setTimeout(() => {
      saveCurrentDraftToSession();
      sessionSaveTimerRef.current = null;
    }, 2000);

    return () => {
      if (sessionSaveTimerRef.current) {
        clearTimeout(sessionSaveTimerRef.current);
        sessionSaveTimerRef.current = null;
      }
    };
  }, [
    authChecked,
    company,
    project,
    projectName,
    date,
    auditor,
    zones,
    checks,
    notes,
    zoneComments,
    overallComment,
    isSubmitting,
    draftActionLoading,
  ]);

  useEffect(() => {
    if (!authChecked) return;
    if (!company || !project || !projectName || !date) return;

    if (dbSyncIntervalRef.current) {
      clearInterval(dbSyncIntervalRef.current);
    }

    dbSyncIntervalRef.current = setInterval(() => {
      const draft = getCurrentSessionDraft();
      if (!draft || isSubmitting || draftActionLoading) return;

      void syncDraftToDb(draft, { silent: true });
    }, 30000);

    return () => {
      if (dbSyncIntervalRef.current) {
        clearInterval(dbSyncIntervalRef.current);
        dbSyncIntervalRef.current = null;
      }
    };
  }, [
    authChecked,
    company,
    project,
    projectName,
    date,
    isSubmitting,
    draftActionLoading,
  ]);

  useEffect(() => {
    if (!authChecked) return;
    if (!company || !project || !projectName || !date) return;

    saveLastAuditSelection();
  }, [authChecked, company, project, projectName, date]);

  useEffect(() => {
    if (!authChecked) return;
    if (!company || !project || !date) return;
    if (zones.length === 0) return;
    if (isRestoringSessionDraftRef.current) return;

    const key = getSessionDraftKey();
    if (!key || restoredSessionDraftKeyRef.current === key) return;

    restoredSessionDraftKeyRef.current = key;
    const localDraft = getSessionDraftByParams(company, project, date);
    if (localDraft) {
      applySessionDraftToState(localDraft);
      setShowDraftPopup(false);
    }
  }, [authChecked, company, project, date, zones.length]);

  const allItems = useMemo(() => zones.flatMap((zone) => zone.items), [zones]);
  const activeZone = zones.find((zone) => zone.id === activeZoneId) ?? zones[0];
  const activeIndex = activeZone
    ? zones.findIndex((zone) => zone.id === activeZone.id)
    : -1;
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

  function toDateInputValue(value: string) {
    return normalizeDateInputValue(value);
  }


  function normalizeDraftZonesToAuditState(draftZones: DraftRawZone[]) {
    const loadedZones: Zone[] = [];
    const nextChecks: Checks = {};
    const nextNotes: Notes = {};
    const nextZoneComments: ZoneComments = {};

    draftZones.forEach((zone, zoneIndex) => {
      const zoneId = zone.id || `draft-zone-${zoneIndex + 1}`;
      const items = Array.isArray(zone.items)
        ? zone.items.map((item, itemIndex) => {
            const itemId =
              item.id || `draft-item-${zoneIndex + 1}-${itemIndex + 1}`;

            if (item.status === "pass" || item.status === "fix") {
              nextChecks[itemId] = item.status;
            }

            if (item.note) {
              nextNotes[itemId] = item.note;
            }

            return {
              id: itemId,
              label: item.label || item.id || "ไม่ระบุรายการ",
              desc: item.desc || "",
            };
          })
        : [];

      if (zone.comment) {
        nextZoneComments[zoneId] = zone.comment;
      }

      loadedZones.push({
        id: zoneId,
        emoji: "",
        label: zone.label || zone.id || "ไม่ระบุหมวดหมู่",
        color: "#0B3D91",
        bg: "#EBF3FF",
        items,
      });
    });

    return { loadedZones, nextChecks, nextNotes, nextZoneComments };
  }

  async function loadDraftList() {
    try {
      setLoadingDrafts(true);

      const response = await fetch("/api/audit-drafts/list", {
        method: "GET",
        cache: "no-store",
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        console.error("Load draft list failed:", result);
        return;
      }

      const draftList: AuditDraftListItem[] = Array.isArray(result.drafts)
        ? result.drafts
        : [];
      setDrafts(draftList);

      const lastSelection = getLastAuditSelection();
      const hasLocalDraftForLastSelection = lastSelection
        ? Boolean(
            getSessionDraftByParams(
              lastSelection.company,
              lastSelection.project,
              lastSelection.auditDate,
            ),
          )
        : false;

      if (draftList.length > 0 && !hasLocalDraftForLastSelection) {
        setShowDraftPopup(true);
      }
    } catch (error) {
      console.error("Load draft list error:", error);
    } finally {
      setLoadingDrafts(false);
    }
  }

  async function handleLoadDraft(draft: AuditDraftListItem) {
    try {
      setDraftActionLoading(draft.draft_id);

      const auditDate = toDateInputValue(draft.audit_date);
      const params = new URLSearchParams({
        company: draft.company_code,
        project: draft.project_code,
        auditDate,
      });

      const response = await fetch(`/api/audit-drafts?${params.toString()}`, {
        method: "GET",
        cache: "no-store",
      });

      const result = await response.json();

      if (!response.ok || !result.success || !result.draft?.raw_json) {
        throw new Error(result?.message || "Load draft failed");
      }

      const raw = result.draft.raw_json;
      const draftZones: DraftRawZone[] = Array.isArray(raw.zones)
        ? raw.zones
        : [];
      const { loadedZones, nextChecks, nextNotes, nextZoneComments } =
        normalizeDraftZonesToAuditState(draftZones);

      setCompany(raw.company || draft.company_code);
      setProject(raw.project || draft.project_code);
      setProjectName(raw.projectName || draft.project_name);
      setDate(raw.auditDate || auditDate);
      setAuditor(raw.auditorName || draft.auditor_name || auditor);
      setZones(loadedZones);
      setActiveZoneId(loadedZones[0]?.id || "");
      setChecks(nextChecks);
      setNotes(nextNotes);
      setZoneComments(nextZoneComments);
      setOverallComment(raw.overallComment || "");
      setLastDraftSavedAt(
        result.draft.last_saved_at || draft.last_saved_at || null,
      );
      setLastLocalSavedAt(new Date().toISOString());
      setShowSummary(false);
      setShowDraftPopup(false);
      window.scrollTo(0, 0);
    } catch (error) {
      console.error("Load draft error:", error);
      alert("โหลด Draft ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setDraftActionLoading(null);
    }
  }

  async function handleDeleteDraft(draft: AuditDraftListItem) {
    const draftId = draft.draft_id;
    const confirmed = window.confirm(
      "ต้องการลบ Draft นี้หรือไม่?\nข้อมูลที่กรอกไว้จะไม่สามารถกู้คืนได้",
    );

    if (!confirmed) return;

    try {
      setDraftActionLoading(draftId);

      const response = await fetch(`/api/audit-drafts/${draftId}`, {
        method: "DELETE",
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result?.message || "Delete draft failed");
      }

      removeSessionDraftByParams(
        draft.company_code,
        draft.project_code,
        toDateInputValue(draft.audit_date),
      );

      setDrafts((current) => {
        const nextDrafts = current.filter((item) => item.draft_id !== draftId);

        if (nextDrafts.length === 0) {
          setShowDraftPopup(false);
        }

        return nextDrafts;
      });
    } catch (error) {
      console.error("Delete draft error:", error);
      alert("ลบ Draft ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setDraftActionLoading(null);
    }
  }

  async function loadProjects(companyCode: string) {
    if (!companyCode) return;

    setLoadingProjects(true);
    setErrorMessage("");

    try {
      const response = await fetch(
        `/api/external-projects?company=${encodeURIComponent(companyCode)}`,
      );
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result?.message || "Cannot load projects");
      }

      const loadedProjects: ProjectOption[] = getUniqueAuditProjects(
        Array.isArray(result.projects) ? result.projects : [],
      );
      setProjects(loadedProjects);

      const lastSelection = getLastAuditSelection();
      if (
        lastSelection &&
        !hasRestoredLastSelectionRef.current &&
        !project &&
        lastSelection.company === companyCode &&
        loadedProjects.some(
          (item) =>
            item.Company === lastSelection.company &&
            item.Project === lastSelection.project,
        )
      ) {
        hasRestoredLastSelectionRef.current = true;
        setCompany(lastSelection.company);
        setProject(lastSelection.project);
        setProjectName(lastSelection.projectName || lastSelection.project);
        setDate(lastSelection.auditDate || todayISO());
        void loadZonesByProject(
          lastSelection.company,
          lastSelection.project,
          loadedProjects,
          lastSelection.auditDate || todayISO(),
        );
      }
    } catch (error) {
      console.error(error);
      setErrorMessage(
        "โหลดรายชื่อโครงการไม่สำเร็จ กรุณาตรวจสอบ Project API / Basic Auth",
      );
    } finally {
      setLoadingProjects(false);
    }
  }

  async function loadZonesByProject(
    companyCode: string,
    projectCode: string,
    projectOptions: ProjectOption[] = projects,
    auditDate: string = date,
  ) {
    if (!companyCode || !projectCode) {
      setZones([]);
      setActiveZoneId("");
      return;
    }

    setLoadingZones(true);
    setErrorMessage("");

    try {
      const selectedProject = projectOptions.find(
        (item) => item.Company === companyCode && item.Project === projectCode,
      );

      setProjectName(selectedProject?.ProjectName || projectCode);

      const response = await fetch(
        `/api/audit-config?company=${encodeURIComponent(companyCode)}&project=${encodeURIComponent(projectCode)}`,
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

      const localDraft = getSessionDraftByParams(
        companyCode,
        projectCode,
        auditDate,
      );
      if (localDraft) {
        applySessionDraftToState(localDraft);
        setShowDraftPopup(false);
        return;
      }
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

  function goToZone(zoneId: string) {
    setActiveZoneId(zoneId);
    window.scrollTo({ top: 0, behavior: "smooth" });
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
    removeCurrentSessionDraft();
    removeLastAuditSelection();
    setLastLocalSavedAt(null);
    setLastDraftSavedAt(null);
    setShowSummary(false);
    window.scrollTo(0, 0);
  }

  function hasDraftInput() {
    return (
      Object.values(checks).some(Boolean) ||
      Object.values(notes).some((value) => value.trim().length > 0) ||
      Object.values(zoneComments).some((value) => value.trim().length > 0) ||
      overallComment.trim().length > 0
    );
  }

  function getLastSelectionKey() {
    if (!loginUser?.id) return null;
    return `audit-last-selection:${loginUser.id}`;
  }

  function getLastAuditSelection() {
    if (typeof window === "undefined") return null;

    const key = getLastSelectionKey();
    if (!key) return null;

    const raw = sessionStorage.getItem(key);
    if (!raw) return null;

    try {
      const parsed = JSON.parse(raw) as LastAuditSelection;
      const isValid =
        parsed.schemaVersion === 1 &&
        parsed.userId === loginUser?.id &&
        Boolean(parsed.company) &&
        Boolean(parsed.project) &&
        Boolean(parsed.auditDate);

      if (!isValid) {
        sessionStorage.removeItem(key);
        return null;
      }

      return parsed;
    } catch {
      sessionStorage.removeItem(key);
      return null;
    }
  }

  function saveLastAuditSelection() {
    if (typeof window === "undefined" || !loginUser?.id) return;
    if (!company || !project || !date) return;

    const key = getLastSelectionKey();
    if (!key) return;

    const selection: LastAuditSelection = {
      schemaVersion: 1,
      userId: loginUser.id,
      company,
      project,
      projectName: projectName || project,
      auditDate: date,
      savedAt: new Date().toISOString(),
    };

    sessionStorage.setItem(key, JSON.stringify(selection));
  }

  function removeLastAuditSelection() {
    if (typeof window === "undefined") return;

    const key = getLastSelectionKey();
    if (!key) return;

    sessionStorage.removeItem(key);
  }

  function getSessionDraftKey() {
    if (!loginUser?.id || !company || !project || !date) return null;

    return buildSessionDraftKey({
      userId: loginUser.id,
      company,
      project,
      auditDate: date,
    });
  }

  function getSessionDraftSyncHashKey() {
    if (!loginUser?.id || !company || !project || !date) return null;

    return buildSessionDraftSyncHashKey({
      userId: loginUser.id,
      company,
      project,
      auditDate: date,
    });
  }

  function getSessionDraftKeyByParams(
    companyCode: string,
    projectCode: string,
    auditDate: string,
  ) {
    if (!loginUser?.id) return null;

    return buildSessionDraftKey({
      userId: loginUser.id,
      company: companyCode,
      project: projectCode,
      auditDate,
    });
  }

  function getSessionDraftSyncHashKeyByParams(
    companyCode: string,
    projectCode: string,
    auditDate: string,
  ) {
    if (!loginUser?.id) return null;

    return buildSessionDraftSyncHashKey({
      userId: loginUser.id,
      company: companyCode,
      project: projectCode,
      auditDate,
    });
  }

  function buildSessionDraftPayload(): SessionAuditDraft {
    return {
      schemaVersion: 1,
      userId: loginUser?.id || "",
      company,
      companyName: loginUser?.companyName || company,
      project,
      projectName,
      auditDate: date,
      auditorName: auditor,
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
      })),
      overallComment,
      localSavedAt: new Date().toISOString(),
    };
  }

  function buildDbPayloadFromSessionDraft(draft: SessionAuditDraft) {
    return {
      company: draft.company,
      companyName: draft.companyName,
      project: draft.project,
      projectName: draft.projectName,
      auditDate: draft.auditDate,
      auditorName: draft.auditorName,
      overallComment: draft.overallComment,
      zones: draft.zones,
    };
  }

  function buildPayload() {
    const draft = buildSessionDraftPayload();

    return {
      ...buildDbPayloadFromSessionDraft(draft),
      auditor: draft.auditorName,
      date: draft.auditDate,
      total: stats.total,
      answered: stats.answered,
      passed: stats.passed,
      fixed: stats.fixed,
      zones: draft.zones.map((zone) => ({
        ...zone,
        fixItems: zone.items
          .filter((item) => item.status === "fix")
          .map((item) => ({
            id: item.id,
            label: item.label,
            desc: item.desc,
            note: item.note || "",
          })),
      })),
    };
  }

  function getDraftSyncHash(draft: SessionAuditDraft) {
    return JSON.stringify(buildDbPayloadFromSessionDraft(draft));
  }

  function saveCurrentDraftToSession() {
    if (typeof window === "undefined") return null;

    const key = getSessionDraftKey();
    if (!key) return null;

    const draft = buildSessionDraftPayload();
    const draftHash = getDraftSyncHash(draft);
    const previousLocalHash = lastLocalDraftHashRef.current;

    if (!lastSyncedDraftHashRef.current) {
      const syncHashKey = getSessionDraftSyncHashKeyByParams(
        draft.company,
        draft.project,
        draft.auditDate,
      );
      lastSyncedDraftHashRef.current = syncHashKey
        ? sessionStorage.getItem(syncHashKey)
        : null;
    }

    sessionStorage.setItem(key, JSON.stringify(draft));
    setLastLocalSavedAt(draft.localSavedAt);

    lastLocalDraftHashRef.current = draftHash;

    if (
      previousLocalHash !== draftHash &&
      lastSyncedDraftHashRef.current !== draftHash
    ) {
      draftDirtyRef.current = true;
    }

    return draft;
  }

  function getCurrentSessionDraft() {
    if (typeof window === "undefined") return null;

    const key = getSessionDraftKey();
    if (!key) return null;

    const raw = sessionStorage.getItem(key);
    if (!raw) return null;

    try {
      const parsed = JSON.parse(raw) as SessionAuditDraft;

      if (parsed.schemaVersion !== 1) return null;

      const draftHash = getDraftSyncHash(parsed);
      const syncHashKey = getSessionDraftSyncHashKeyByParams(
        parsed.company,
        parsed.project,
        parsed.auditDate,
      );
      const syncedDraftHash = syncHashKey
        ? sessionStorage.getItem(syncHashKey)
        : null;

      lastLocalDraftHashRef.current = draftHash;
      lastSyncedDraftHashRef.current = syncedDraftHash;
      draftDirtyRef.current = syncedDraftHash !== draftHash;

      return parsed;
    } catch {
      return null;
    }
  }

  function getSessionDraftByParams(
    companyCode: string,
    projectCode: string,
    auditDate: string,
  ) {
    if (typeof window === "undefined" || !loginUser?.id) return null;

    const key = getSessionDraftKeyByParams(companyCode, projectCode, auditDate);
    if (!key) return null;

    const raw = sessionStorage.getItem(key);
    if (!raw) return null;

    try {
      const parsed = JSON.parse(raw) as SessionAuditDraft;
      const isMatchingDraft =
        parsed.schemaVersion === 1 &&
        parsed.userId === loginUser.id &&
        parsed.company === companyCode &&
        parsed.project === projectCode &&
        parsed.auditDate === auditDate &&
        Array.isArray(parsed.zones);

      if (!isMatchingDraft) {
        sessionStorage.removeItem(key);
        return null;
      }

      const draftHash = getDraftSyncHash(parsed);
      const syncHashKey = getSessionDraftSyncHashKeyByParams(
        companyCode,
        projectCode,
        auditDate,
      );
      const syncedDraftHash = syncHashKey
        ? sessionStorage.getItem(syncHashKey)
        : null;

      lastLocalDraftHashRef.current = draftHash;
      lastSyncedDraftHashRef.current = syncedDraftHash;
      draftDirtyRef.current = syncedDraftHash !== draftHash;

      return parsed;
    } catch {
      sessionStorage.removeItem(key);
      return null;
    }
  }

  function cleanupSessionDraftsForOtherUsers() {
    if (typeof window === "undefined" || !loginUser?.id) return;

    const currentUserPrefix = buildSessionDraftUserPrefix(loginUser.id);

    for (let index = sessionStorage.length - 1; index >= 0; index -= 1) {
      const key = sessionStorage.key(index);
      if (!key || !key.startsWith("audit-draft:")) continue;

      if (!key.startsWith(currentUserPrefix)) {
        sessionStorage.removeItem(key);
      }
    }
  }

  function removeSessionDraftByParams(
    companyCode: string,
    projectCode: string,
    auditDate: string,
  ) {
    if (typeof window === "undefined" || !loginUser?.id) return;

    const key = getSessionDraftKeyByParams(companyCode, projectCode, auditDate);
    const syncHashKey = getSessionDraftSyncHashKeyByParams(
      companyCode,
      projectCode,
      auditDate,
    );

    if (key) sessionStorage.removeItem(key);
    if (syncHashKey) sessionStorage.removeItem(syncHashKey);
  }

  function applySessionDraftToState(draft: SessionAuditDraft) {
    isRestoringSessionDraftRef.current = true;

    const { loadedZones, nextChecks, nextNotes, nextZoneComments } =
      normalizeDraftZonesToAuditState(draft.zones);

    setCompany(draft.company);
    setProject(draft.project);
    setProjectName(draft.projectName);
    setDate(draft.auditDate);
    setAuditor(draft.auditorName);
    setZones(loadedZones);
    setActiveZoneId(loadedZones[0]?.id || "");
    setChecks(nextChecks);
    setNotes(nextNotes);
    setZoneComments(nextZoneComments);
    setOverallComment(draft.overallComment || "");
    setLastLocalSavedAt(draft.localSavedAt);
    setShowSummary(false);

    window.setTimeout(() => {
      isRestoringSessionDraftRef.current = false;
    }, 0);
  }

  function removeCurrentSessionDraft() {
    if (sessionSaveTimerRef.current) {
      clearTimeout(sessionSaveTimerRef.current);
      sessionSaveTimerRef.current = null;
    }

    if (typeof window === "undefined") return;

    const key = getSessionDraftKey();
    if (!key) return;

    const syncHashKey = getSessionDraftSyncHashKey();

    sessionStorage.removeItem(key);
    if (syncHashKey) sessionStorage.removeItem(syncHashKey);
    draftDirtyRef.current = false;
    lastLocalDraftHashRef.current = null;
    lastSyncedDraftHashRef.current = null;
  }

  async function syncDraftToDb(
    draft: SessionAuditDraft,
    {
      silent = false,
      force = false,
    }: { silent?: boolean; force?: boolean } = {},
  ) {
    const draftHash = getDraftSyncHash(draft);

    if (!force) {
      if (!draftDirtyRef.current) return;
      if (lastSyncedDraftHashRef.current === draftHash) return;
    }

    try {
      setSavingDraft(true);

      const response = await fetch("/api/audit-drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildDbPayloadFromSessionDraft(draft)),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result?.message || "Save draft failed");
      }

      setLastDraftSavedAt(
        result.draft?.last_saved_at || new Date().toISOString(),
      );
      const syncHashKey = getSessionDraftSyncHashKeyByParams(
        draft.company,
        draft.project,
        draft.auditDate,
      );

      draftDirtyRef.current = false;
      lastSyncedDraftHashRef.current = draftHash;
      if (syncHashKey) sessionStorage.setItem(syncHashKey, draftHash);

      if (!silent) {
        alert("บันทึก Draft สำเร็จ");
      }
    } catch (error) {
      console.error("Save draft error:", error);

      if (!silent) {
        alert("บันทึก Draft ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
      }
    } finally {
      setSavingDraft(false);
    }
  }

  async function handleSaveDraft({
    silent = false,
  }: { silent?: boolean } = {}) {
    if (!company || !project || !projectName || !date) {
      if (!silent) {
        alert("กรุณาเลือกโครงการและวันที่ก่อนบันทึก Draft");
      }
      return;
    }

    const draft = saveCurrentDraftToSession();
    if (!draft) return;

    await syncDraftToDb(draft, { silent, force: true });
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
        alert(
          "บันทึกข้อมูลสำเร็จ แต่อีเมลส่งไม่สำเร็จ กรุณาตรวจสอบ SMTP config",
        );
      }

      removeCurrentSessionDraft();
      setLastLocalSavedAt(null);
    } catch (error) {
      console.error(error);
      alert("บันทึกข้อมูลไม่สำเร็จ กรุณาตรวจสอบ API / Database config");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!authChecked) {
    return (
      <main className="app">
        <div className="empty">กำลังตรวจสอบสิทธิ์...</div>
      </main>
    );
  }

  const companyName = loginUser?.companyName || company || "—";
  const displayDraftSavedAt = lastLocalSavedAt || lastDraftSavedAt;
  const displayDraftSavedTime = displayDraftSavedAt
    ? new Date(displayDraftSavedAt).toLocaleTimeString("th-TH", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  if (showSummary) {
    return (
      <main className="app">
        <Summary
          companyName={companyName}
          projectName={projectName || project || "—"}
          auditor={auditor || "—"}
          date={date || "—"}
          zones={zones}
          checks={checks}
          notes={notes}
          zoneComments={zoneComments}
          overallComment={overallComment}
          stats={stats}
          getZoneStat={getZoneStat}
          onBack={() => {
            setShowSummary(false);
            window.scrollTo(0, 0);
          }}
          onReset={resetAuditOnly}
          onSubmit={submitAudit}
          onSaveDraft={() => void handleSaveDraft()}
          isSubmitting={isSubmitting}
          isSavingDraft={savingDraft}
        />
      </main>
    );
  }

  return (
    <main className="app">
      <div className="topwrap">
        <div className="top">
          <div className="toprow">
            <div className="logo">
              <span className="logo-mark">
                <span />
              </span>
              <span className="logo-text">
                <span className="logo-name">SAMMAKORN</span>
                <span className="logo-sub">PROPERTY</span>
              </span>
            </div>
            <div className="topright">
              {displayDraftSavedTime ? (
                <span className="header-draft-time">
                  บันทึก {displayDraftSavedTime}
                </span>
              ) : null}
              <span className="week">
                <SamcoIcon name="calendar" size={13} stroke={2} /> WK {weekNo()}{" "}
                · {new Date().getFullYear()}
              </span>
              <button
                className="signout"
                onClick={logout}
                title={`ออกจากระบบ · ${loginUser?.username || ""}`}
                type="button"
              >
                <SamcoIcon name="logout" size={15} stroke={2} />
                <span className="so-label">ออกจากระบบ</span>
              </button>
            </div>
          </div>

          <div className="h1">Weekly Site Audit</div>
          <div className="sub">
            ตรวจคุณภาพหน้างานประจำสัปดาห์ · มาตรฐาน Sammakorn
          </div>
          <div className="meta-user">
            <span>
              {companyName} · {loginUser?.username || "ผู้ใช้งาน"}
            </span>
          </div>

          <div className="meta">
            <div className="field select">
              <div className="l">
                <SamcoIcon name="pin" size={10} stroke={2} />
                โครงการ
              </div>
              <select
                required
                value={project}
                disabled={loadingProjects}
                onChange={(e) => {
                  const selectedProject = e.target.value;
                  const selected = projects.find(
                    (item) =>
                      item.Company === company &&
                      item.Project === selectedProject,
                  );

                  setProject(selectedProject);
                  setProjectName(selected?.ProjectName || selectedProject);
                  void loadZonesByProject(
                    company,
                    selectedProject,
                    projects,
                    date,
                  );
                }}
              >
                <option value="" disabled>
                  {loadingProjects ? "กำลังโหลด..." : "เลือกโครงการ"}
                </option>
                {projects
                  .filter((item) => item.Company === company)
                  .map((item) => (
                    <option
                      key={`${item.Company}-${item.Project}`}
                      value={item.Project}
                    >
                      {item.Project} · {item.ProjectName}
                    </option>
                  ))}
              </select>
              <span className="caret">
                <SamcoIcon name="chevR" size={13} stroke={2.4} />
              </span>
            </div>

            <div className="field">
              <div className="l">
                <SamcoIcon name="user" size={10} stroke={2} />
                ผู้ตรวจ
              </div>
              <input
                value={auditor}
                onChange={(e) => setAuditor(e.target.value)}
                placeholder="ชื่อผู้ตรวจ"
              />
            </div>

            <div className="field date-field">
              <div className="l">
                <SamcoIcon name="calendar" size={10} stroke={2} />
                วันที่
              </div>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="prog">
          <div className="track">
            <div className="fill" style={{ width: `${stats.pct}%` }} />
          </div>
          <span className="pct">
            {stats.answered}/{stats.total}
          </span>
          <span className={stats.fixed > 0 ? "flag" : "flag ok"}>
            <SamcoIcon
              name={stats.fixed > 0 ? "alert" : "check"}
              size={11}
              stroke={2.2}
            />
            {stats.fixed > 0 ? `${stats.fixed} ต้องแก้` : "ไม่มีต้องแก้"}
          </span>
        </div>

        {zones.length > 0 ? (
          <div className="tabs">
            {zones.map((zone) => {
              const zoneStat = getZoneStat(zone);
              const active = activeZone?.id === zone.id;
              return (
                <button
                  key={zone.id}
                  type="button"
                  onClick={() => goToZone(zone.id)}
                  className={`tab${active ? " on" : ""}${
                    zoneStat.answered === zoneStat.total && zoneStat.total > 0
                      ? zoneStat.fixed > 0
                        ? " hasfix"
                        : " done"
                      : ""
                  }`}
                >
                  <SamcoIcon name={zoneIconName(zone)} size={14} />
                  {shortZoneLabel(zone)}
                  {zoneStat.answered === zoneStat.total &&
                  zoneStat.fixed > 0 ? (
                    <span className="dot" />
                  ) : null}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      {errorMessage ? (
        <div className="alertbox">
          <SamcoIcon name="alert" size={14} stroke={2.2} />
          {errorMessage}
        </div>
      ) : null}

      <div className="scrollY">
        {loadingZones ? (
          <div className="empty">กำลังโหลด Checklist...</div>
        ) : !project ? (
          <div className="empty">กรุณาเลือกโครงการก่อนเริ่ม Audit</div>
        ) : !activeZone ? (
          <div className="empty">
            ไม่พบ Checklist สำหรับโครงการนี้ กรุณาเพิ่มข้อมูลในตาราง audit_zones
            และ audit_items
          </div>
        ) : (
          <>
            <div className="zhead">
              <span className="zico">
                <SamcoIcon name={zoneIconName(activeZone)} size={18} />
              </span>
              <span className="zt">{activeZone.label}</span>
              <span className="zc">
                {getZoneStat(activeZone).answered}/
                {getZoneStat(activeZone).total}
              </span>
            </div>

            {activeZone.items.map((item, index) => {
              const value = checks[item.id] || "";

              return (
                <div key={item.id} className={`card ${value}`}>
                  <div className="crow">
                    <span className="num">{index + 1}</span>
                    <div className="cbody">
                      <div className="cl">{item.label}</div>
                      <div className="cd">{item.desc}</div>
                    </div>
                  </div>

                  <div className="seg">
                    <button
                      type="button"
                      onClick={() => toggleCheck(item.id, "pass")}
                      className={`sbtn${value === "pass" ? " passon" : ""}`}
                    >
                      <SamcoIcon name="check" size={14} stroke={2.4} />
                      ผ่าน
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleCheck(item.id, "fix")}
                      className={`sbtn${value === "fix" ? " fixon" : ""}`}
                    >
                      <SamcoIcon name="alert" size={13} stroke={2.2} />
                      ต้องแก้
                    </button>
                  </div>

                  {value === "fix" ? (
                    <div className="note">
                      <SamcoIcon
                        name="alert"
                        size={12}
                        stroke={2.2}
                        style={{ color: "#d98a8a" }}
                      />
                      <input
                        className="note-input-clean"
                        value={notes[item.id] || ""}
                        onChange={(e) =>
                          setNotes((current) => ({
                            ...current,
                            [item.id]: e.target.value,
                          }))
                        }
                        placeholder="รายละเอียด / ผู้รับผิดชอบ…"
                      />
                    </div>
                  ) : null}
                </div>
              );
            })}

            <div className="commentwrap">
              <div className="clabel">
                <SamcoIcon name="flag" size={11} stroke={2} />
                Comment — {activeZone.label}
              </div>
              <textarea
                rows={2}
                value={zoneComments[activeZone.id] || ""}
                onChange={(e) =>
                  setZoneComments((current) => ({
                    ...current,
                    [activeZone.id]: e.target.value,
                  }))
                }
                placeholder="ข้อสังเกตเพิ่มเติมของโซนนี้…"
              />
            </div>

            {isLastZone ? (
              <div className="commentwrap">
                <div className="clabel overall">
                  <SamcoIcon name="flag" size={11} stroke={2} />
                  Overall Comment & สิ่งที่ต้องติดตาม
                </div>
                <textarea
                  className="overall"
                  rows={3}
                  value={overallComment}
                  onChange={(e) => setOverallComment(e.target.value)}
                  placeholder="ภาพรวมสัปดาห์นี้ สิ่งที่ดีขึ้น / แย่ลง / ต้องเฝ้าระวัง…"
                />
              </div>
            ) : null}

            <div className="nav">
              {activeIndex > 0 ? (
                <button
                  className="nbtn"
                  type="button"
                  onClick={() => goToZone(zones[activeIndex - 1].id)}
                >
                  <SamcoIcon name="chevL" size={15} stroke={2.4} />
                </button>
              ) : null}

              {!isLastZone ? (
                <button
                  className="nbtn next"
                  type="button"
                  onClick={() => goToZone(zones[activeIndex + 1].id)}
                >
                  ถัดไป · {shortZoneLabel(zones[activeIndex + 1])}{" "}
                  <SamcoIcon name="chevR" size={15} stroke={2.4} />
                </button>
              ) : (
                <button
                  className="nbtn submit"
                  type="button"
                  disabled={stats.answered < stats.total}
                  onClick={() => {
                    setShowSummary(true);
                    window.scrollTo(0, 0);
                  }}
                >
                  {stats.answered < stats.total ? (
                    `กรอกให้ครบก่อน · ${stats.pct}%`
                  ) : (
                    <>
                      <SamcoIcon name="trophy" size={15} stroke={2.2} />
                      ดูสรุปผล
                    </>
                  )}
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {showDraftPopup ? (
        <div className="draft-modal-backdrop">
          <div className="draft-modal">
            <div className="draft-modal-head">
              <div>
                <p className="draft-modal-kicker">Draft Recovery</p>
                <h2>พบ Draft ที่ยังไม่ได้ส่ง</h2>
                <p>
                  คุณมีรายการตรวจที่บันทึกค้างไว้ สามารถโหลดกลับมาทำต่อ หรือลบ
                  Draft แล้วเลือกโครงการใหม่ได้
                </p>
              </div>

              <button
                type="button"
                className="draft-modal-close"
                onClick={() => setShowDraftPopup(false)}
                disabled={Boolean(draftActionLoading)}
                aria-label="ปิดหน้าต่าง Draft"
              >
                ×
              </button>
            </div>

            {loadingDrafts ? (
              <div className="draft-empty">กำลังโหลด Draft...</div>
            ) : (
              <div className="draft-list">
                {drafts.map((draft) => {
                  const progress =
                    draft.total_items > 0
                      ? Math.round(
                          (draft.answered_items / draft.total_items) * 100,
                        )
                      : 0;
                  const isLoading = draftActionLoading === draft.draft_id;

                  return (
                    <div className="draft-card" key={draft.draft_id}>
                      <div className="draft-card-main">
                        <div>
                          <p className="draft-project">{draft.project_name}</p>
                          <p className="draft-meta">
                            {draft.company_code} / {draft.project_code} ·
                            วันที่ตรวจ {toDateInputValue(draft.audit_date)}
                          </p>
                        </div>

                        <div className="draft-progress-pill">{progress}%</div>
                      </div>

                      <div className="draft-stats">
                        <span>
                          กรอกแล้ว {draft.answered_items}/{draft.total_items}
                        </span>
                        <span>ผ่าน {draft.passed_items}</span>
                        <span>ต้องแก้ {draft.fixed_items}</span>
                      </div>

                      <p className="draft-saved-at">
                        บันทึกล่าสุด:{" "}
                        {new Date(draft.last_saved_at).toLocaleString("th-TH", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </p>

                      <div className="draft-actions">
                        <button
                          type="button"
                          className="draft-load-btn"
                          onClick={() => handleLoadDraft(draft)}
                          disabled={isLoading}
                        >
                          {isLoading ? "กำลังโหลด..." : "โหลด Draft"}
                        </button>

                        <button
                          type="button"
                          className="draft-delete-btn"
                          onClick={() => handleDeleteDraft(draft)}
                          disabled={isLoading}
                        >
                          ลบ Draft
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <button
              type="button"
              className="draft-skip-btn"
              onClick={() => setShowDraftPopup(false)}
              disabled={Boolean(draftActionLoading)}
            >
              เลือกโครงการใหม่
            </button>
          </div>
        </div>
      ) : null}

      <div className={`saved${toast ? " show" : ""}`}>
        <SamcoIcon name="check" size={13} stroke={2.6} />
        บันทึกแล้ว
      </div>
    </main>
  );
}

function Summary({
  companyName,
  projectName,
  auditor,
  date,
  zones,
  checks,
  notes,
  zoneComments,
  overallComment,
  stats,
  getZoneStat,
  onBack,
  onReset,
  onSubmit,
  onSaveDraft,
  isSubmitting,
  isSavingDraft,
}: SummaryProps) {
  return (
    <div className="sum">
      <div className="sumhero">
        <div className="badge">
          <SamcoIcon name="trophy" size={24} stroke={2} />
        </div>
        <h2>
          {stats.fixed > 0
            ? "สรุปผล Audit สัปดาห์นี้"
            : "เยี่ยม! ผ่านครบทุกจุด"}
        </h2>
        <div className="m">
          {companyName} · {projectName} · {date} · ผู้ตรวจ {auditor}
        </div>
      </div>

      <div className="scoregrid">
        <div className="scard">
          <div className="v primary">
            {stats.answered}/{stats.total}
          </div>
          <div className="sl">ตรวจแล้ว</div>
        </div>
        <div className="scard">
          <div className="v green">{stats.passed}</div>
          <div className="sl">ผ่าน</div>
        </div>
        <div className="scard">
          <div className={`v ${stats.fixed > 0 ? "red" : "green"}`}>
            {stats.fixed}
          </div>
          <div className="sl">ต้องแก้</div>
        </div>
      </div>

      {stats.answered < stats.total ? (
        <div className="draft-hint">
          ยังกรอกไม่ครบ {stats.total - stats.answered} รายการ สามารถบันทึก Draft
          เพื่อกลับมาทำต่อภายหลังได้
        </div>
      ) : null}

      {zones.map((zone) => {
        const zs = getZoneStat(zone);
        const fixItems = zone.items.filter((item) => checks[item.id] === "fix");

        return (
          <div key={zone.id} className={`zres${zs.fixed > 0 ? " hasfix" : ""}`}>
            <div className="zres-h">
              <span className="zico small">
                <SamcoIcon name={zoneIconName(zone)} size={16} />
              </span>
              <span className="zres-n">{zone.label}</span>
              <span className={`zres-s ${zs.fixed > 0 ? "red" : "green"}`}>
                {zs.fixed > 0 ? (
                  <>
                    <SamcoIcon name="alert" size={13} stroke={2.3} />
                    {zs.fixed} จุด
                  </>
                ) : (
                  <>
                    <SamcoIcon name="check" size={14} stroke={2.6} />
                    ผ่าน
                  </>
                )}
              </span>
            </div>

            {fixItems.map((item) => (
              <div key={item.id} className="fixrow">
                <div className="fixl">
                  <SamcoIcon
                    name="alert"
                    size={13}
                    stroke={2.3}
                    style={{ marginTop: 1 }}
                  />
                  {item.label}
                </div>
                {notes[item.id] ? (
                  <div className="fixn">{notes[item.id]}</div>
                ) : null}
              </div>
            ))}
          </div>
        );
      })}

      {zones.some((zone) => zoneComments[zone.id]) ? (
        <>
          <div className="sectlabel">Comments แยกตามโซน</div>
          {zones
            .filter((zone) => zoneComments[zone.id])
            .map((zone) => (
              <div key={zone.id} className="cmtcard">
                <div className="cl2">
                  <SamcoIcon name={zoneIconName(zone)} size={14} />
                  {zone.label}
                </div>
                <div className="ct">{zoneComments[zone.id]}</div>
              </div>
            ))}
        </>
      ) : null}

      {overallComment ? (
        <div className="nextbox spaced">
          <div className="nl">
            <SamcoIcon name="flag" size={12} stroke={2} />
            Overall Comment
          </div>
          <div className="nt">{overallComment}</div>
        </div>
      ) : null}

      <div className="summary-actions">
        <button
          className="nbtn summary-back"
          type="button"
          onClick={onBack}
          disabled={isSubmitting || isSavingDraft}
        >
          <SamcoIcon name="chevL" size={15} stroke={2.4} />
          กลับไปแก้ไข
        </button>
        <button
          className="nbtn summary-draft"
          type="button"
          onClick={onSaveDraft}
          disabled={isSubmitting || isSavingDraft}
        >
          <SamcoIcon name="save" size={15} stroke={2.3} />
          {isSavingDraft ? "กำลังบันทึก..." : "บันทึก Draft"}
        </button>
        <button
          className="reset submit-final summary-submit"
          type="button"
          onClick={onSubmit}
          disabled={isSubmitting || isSavingDraft}
        >
          <SamcoIcon name="send" size={15} stroke={2} />
          {isSubmitting ? "กำลังส่ง..." : "บันทึก + ส่ง Email"}
        </button>
      </div>

      <button
        className="reset"
        type="button"
        onClick={onReset}
        disabled={isSubmitting || isSavingDraft}
      >
        <SamcoIcon name="refresh" size={15} stroke={2} />
        เริ่ม Audit ใหม่
      </button>
    </div>
  );
}
