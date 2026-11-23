import { useCallback, useEffect, useRef, useState } from "react";
import "./workspace-polish.css";
import "./overview-template.css";
import "./workspace-three-tabs.css";
import "./scope-reference.css";
import "./milestone-reference.css";
import "./workspace-compact.css";
import "./acceptance-reference.css";
import {
  scopeDocumentsApi,
  type ScopeDocumentInfo,
} from "../../api/scopeDocuments";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FolderKanban,
  LayoutDashboard,
  LoaderCircle,
  LockKeyhole,
  ShieldCheck,
  TriangleAlert,
  FileCheck2,
  Wallet,
  Coins,
  Building2,
  UserRound,
  ArrowRight,
  Target,
  Paperclip,
  Plus,
  ExternalLink,
  CalendarDays,
  Star,
  Eye,
  Download,
  Upload,
  Layers3,
  FileText,
  RotateCcw,
  Check,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  RichDescription,
} from "../../components/ui";
import { ApiError } from "../../api/http";
import { reviewsApi, type Review } from "../../api/lifecycle";
import { Stars } from "../../components/ui";
import type { AuthUser } from "../../api/auth";
import type { Page } from "../../api/jobs";
import {
  milestonesApi,
  scopesApi,
  type Milestone,
  type Scope,
  type Submission,
} from "../../api/workspace";
import { Assignments, assignmentLabels } from "../recruitment/Recruitment";
import { money } from "../jobs/model";
import { AcceptancePanel } from "./LifecyclePanels";
import {
  blankMilestone,
  loadWorkspace,
  milestoneForm,
  milestoneInput,
  milestoneRights,
  openWorkspace,
  reviewNote,
  scopeForm,
  scopeInput,
  readMilestonePlan,
  scopeRights,
  submissionInput,
  workspaceId,
  party,
  type MilestoneForm,
  type WorkspaceData,
} from "./productionModel";

type Section = "overview" | "scope" | "milestones" | "acceptance";
const sections = [
  { id: "overview", label: "Tổng quan", icon: LayoutDashboard },
  { id: "scope", label: "Phạm vi & xác nhận", icon: LockKeyhole },
  { id: "milestones", label: "Mốc bàn giao", icon: FolderKanban },
  { id: "acceptance", label: "Nghiệm thu & đánh giá", icon: FileCheck2 },
] as const;
const dateLabelForWorkspace = (value: string | null | undefined) =>
  value && Number.isFinite(Date.parse(value))
    ? new Date(value).toLocaleDateString("vi-VN")
    : "Chưa cập nhật";
const message = (e: unknown) =>
  e instanceof ApiError
    ? [e.message, ...Object.values(e.errors)].join(" · ")
    : e instanceof Error
      ? e.message
      : "Không thể tải dữ liệu.";
const blankPage = <T,>(): Page<T> => ({
  content: [],
  page: 0,
  size: 20,
  totalElements: 0,
  totalPages: 0,
});
function Loading() {
  return (
    <div className="v2-empty" role="status">
      <LoaderCircle className="v2-spin" />
      Đang tải dữ liệu…
    </div>
  );
}
function ErrorView({ value, reload }: { value: string; reload?: () => void }) {
  return value ? (
    <div className="v2-message error" role="alert">
      <TriangleAlert size={18} />
      {value}
      {reload && (
        <Button variant="ghost" onClick={reload}>
          Tải lại dữ liệu
        </Button>
      )}
    </div>
  ) : null;
}
function Paging({
  page,
  pages,
  total,
  disabled,
  change,
}: {
  page: number;
  pages: number;
  total: number;
  disabled: boolean;
  change: (page: number) => void;
}) {
  if (pages <= 1) return null;
  return (
    <div className="v2-actions">
      <span className="v2-muted">
        {total} kết quả · Trang {pages ? page + 1 : 0}/{pages}
      </span>
      <Button
        variant="secondary"
        disabled={disabled || !page}
        onClick={() => change(page - 1)}
      >
        ‹
      </Button>
      <Button
        variant="secondary"
        disabled={disabled || page + 1 >= pages}
        onClick={() => change(page + 1)}
      >
        ›
      </Button>
    </div>
  );
}
export interface Runtime {
  data: WorkspaceData;
  user: AuthUser;
  busy: boolean;
  blocked: boolean;
  revision: number;
  run: <T>(
    task: () => Promise<T>,
    committed?: (value: T) => void,
    afterReload?: () => Promise<void>,
  ) => Promise<void>;
}

export default function ProductionWorkspace({
  user,
  initialSection = "overview",
  dashboardPage = "Không gian dự án",
  navigate,
  viewRole,
}: {
  user: AuthUser;
  initialSection?: string;
  dashboardPage?: string;
  navigate?: (page: string) => void;
  viewRole?: "Client" | "Freelancer" | "Admin";
}) {
  const [id, setId] = useState(() => workspaceId(window.location.hash));
  const [deepSection, setDeepSection] = useState(() =>
    new URLSearchParams(window.location.hash.split("?")[1] || "").get(
      "section",
    ),
  );
  const [routeRevision, setRouteRevision] = useState(0);
  const clientView = viewRole === "Client";
  useEffect(() => {
    const changed = () => {
      setId(workspaceId(window.location.hash));
      setDeepSection(
        new URLSearchParams(window.location.hash.split("?")[1] || "").get(
          "section",
        ),
      );
      setRouteRevision((value) => value + 1);
    };
    window.addEventListener("popstate", changed);
    window.addEventListener("hashchange", changed);
    return () => {
      window.removeEventListener("popstate", changed);
      window.removeEventListener("hashchange", changed);
    };
  }, []);
  if (!id)
    return (
      <div className={clientView ? "v2-root client-projects" : "v2-root"}>
        <Assignments
          user={user}
          openWorkspace={(id) =>
            openWorkspace(id, clientView ? "Không gian dự án" : dashboardPage)
          }
          navigate={navigate}
          viewRole={viewRole}
          listMode="workspace"
        />
      </div>
    );
  return (
    <WorkspaceContent
      key={`${user.id}:${id}:${deepSection || initialSection}:${routeRevision}`}
      id={id}
      user={user}
      initialSection={deepSection || initialSection}
      clientView={clientView}
      back={() => {
        window.history.pushState(
          null,
          "",
          `#/dashboard/${encodeURIComponent(clientView ? "Không gian dự án" : dashboardPage)}`,
        );
        window.dispatchEvent(new PopStateEvent("popstate"));
      }}
    />
  );
}
function WorkspaceContent({
  id,
  user,
  initialSection,
  back,
  clientView = false,
}: {
  id: number;
  user: AuthUser;
  initialSection: string;
  back: () => void;
  clientView?: boolean;
}) {
  const [section, setSection] = useState<Section>(
    sections.some((s) => s.id === initialSection)
      ? (initialSection as Section)
      : "overview",
  );
  const [data, setData] = useState<WorkspaceData | null>(null);
  const [projectReview, setProjectReview] = useState<Review | null>(null);
  useEffect(() => {
    let active = true;
    reviewsApi
      .get(id)
      .then((value) => {
        if (active) setProjectReview(value);
      })
      .catch(() => {
        if (active) setProjectReview(null);
      });
    return () => {
      active = false;
    };
  }, [id, section]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const flight = useRef(false);
  const alive = useRef(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [blocked, setBlocked] = useState(false);
  const [revision, setRevision] = useState(0);
  const refreshFlight = useRef<Promise<void> | null>(null);

  const principal = useRef(user);
  principal.current = user;
  const principalKey = JSON.stringify([user.id, ...user.roles]);
  const reload = useCallback((): Promise<void> => {
    if (refreshFlight.current) return refreshFlight.current;
    const operation = loadWorkspace(id, principal.current, true).then(
      (value) => {
        if (alive.current) {
          setData(value);
          setBlocked(false);
          setRevision((n) => n + 1);
        }
      },
    );
    refreshFlight.current = operation.finally(() => {
      refreshFlight.current = null;
    });
    return refreshFlight.current;
  }, [id, principalKey]);
  useEffect(() => {
    alive.current = true;
    setLoading(true);
    reload()
      .catch((e) => {
        if (alive.current) setError(message(e));
      })
      .finally(() => {
        if (alive.current) setLoading(false);
      });
    return () => {
      alive.current = false;
    };
  }, [reload]);

  useEffect(() => {
    if (
      section !== "scope" ||
      !data ||
      party(principal.current, data.assignment) !== "FREELANCER" ||
      data.assignment.status !== "PENDING_SCOPE"
    )
      return;
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible" && !flight.current)
        void reload().catch(() => {});
    }, 15000);
    return () => window.clearInterval(interval);
  }, [section, data?.assignment.id, data?.assignment.status, reload]);

  const manualReload = async () => {
    if (flight.current) return;
    flight.current = true;
    setBusy(true);
    try {
      await reload();
      setError("");
      setNotice("Đã tải lại dữ liệu. Nội dung đang nhập được giữ nguyên.");
    } catch (e) {
      setError(message(e));
      setBlocked(true);
    } finally {
      flight.current = false;
      setBusy(false);
    }
  };
  const run: Runtime["run"] = async (task, committed, afterReload) => {
    if (flight.current || blocked) return;
    flight.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    let saved = false;
    try {
      const value = await task();
      saved = true;
      committed?.(value);
      setNotice("Thao tác đã được backend ghi nhận.");
      await reload();
      await afterReload?.();
    } catch (e) {
      setError(
        (saved
          ? "Đã ghi thành công nhưng chưa tải lại đủ dữ liệu. Không gửi lại thao tác. "
          : e instanceof ApiError && e.status === 0
            ? "Chưa xác định thao tác đã được ghi hay chưa. Tải lại và kiểm tra trước khi gửi lại. "
            : "") + message(e),
      );
      if (saved || (e instanceof ApiError && [0, 409, 412].includes(e.status)))
        setBlocked(true);
    } finally {
      flight.current = false;
      setBusy(false);
    }
  };
  const adminOnly =
    !!data && !party(user, data.assignment) && user.roles.includes("ADMIN");
  const availableSections = adminOnly
    ? sections.filter((s) => ["overview", "acceptance"].includes(s.id))
    : sections;
  const active =
    availableSections.find((s) => s.id === section) || availableSections[0];
  const runtime = data ? { data, user, busy, blocked, revision, run } : null;
  const currentScope =
    data?.scopes.reduce<Scope | null>(
      (latest, item) =>
        !latest || item.versionNumber > latest.versionNumber ? item : latest,
      null,
    ) ?? null;
  const scopeLocked = currentScope?.status === "LOCKED";
  const done = data?.assignment.status === "COMPLETED";
  const dateLabel = (value: string | null) =>
    value && Number.isFinite(Date.parse(value))
      ? new Date(value).toLocaleDateString("vi-VN")
      : "Chưa cập nhật";
  return (
    <div className="v2-root v2-embedded workspace3 ws-template-active">
      <div className="workspace3-header">
        <div className="workspace3-breadcrumb">
          <button type="button" onClick={back}>
            <ArrowLeft size={15} /> Danh sách dự án
          </button>
          <ChevronRight size={14} />
          <span>Dự án #{id}</span>
        </div>
        <div className="workspace3-titlebar">
          <div className="workspace3-title">
            <div className="ws-ref-project-title">
              <span className="ws-ref-title-symbol">
                <FolderKanban size={29} />
              </span>
              <h1>
                {data?.assignment.jobTitle ||
                  (loading ? "Đang tải dự án…" : `Dự án #${id}`)}
              </h1>
            </div>
            {data && (
              <div className="workspace3-project-meta">
                <span>
                  <Building2 size={15} />
                  <b>{data.assignment.companyName || "Chưa cập nhật"}</b>
                </span>
                <span>
                  <UserRound size={15} />
                  <b>{data.assignment.freelancerName || "Chưa cập nhật"}</b>
                </span>
                <span>
                  <Wallet size={15} />
                  <b>
                    {money(
                      data.assignment.agreedBudget,
                      data.assignment.currencyCode,
                    )}
                  </b>
                </span>
              </div>
            )}
          </div>
          <div className="workspace3-actions">
            {data && (
              <Badge tone={done ? "green" : "neutral"}>
                {assignmentLabels[data.assignment.status]}
              </Badge>
            )}
            <span className="workspace3-role">
              {clientView ? "Client" : "Freelancer"}
            </span>
            <Button
              variant="secondary"
              disabled={busy || loading}
              onClick={() => void manualReload()}
            >
              Tải lại
            </Button>
          </div>
        </div>
        {active.id === "overview" && data && !adminOnly && (
          <div className="ws-template-steps" aria-label="Tiến trình dự án">
            <button
              type="button"
              onClick={() => setSection("scope")}
              className={scopeLocked || done ? "is-done" : ""}
            >
              <CheckCircle2 size={16} /> Phạm vi
            </button>
            <span aria-hidden="true" className="ws-template-step-line" />
            <button
              type="button"
              onClick={() => setSection("milestones")}
              className={done ? "is-done" : ""}
            >
              <CheckCircle2 size={16} /> Triển khai
            </button>
            <span aria-hidden="true" className="ws-template-step-line" />
            <button
              type="button"
              onClick={() => setSection("acceptance")}
              className={done ? "is-done" : ""}
            >
              <CheckCircle2 size={16} /> Hoàn thành
            </button>
          </div>
        )}
        <div
          className="workspace3-tabs"
          role="navigation"
          aria-label="Mục quản lý dự án"
        >
          {availableSections.map((item) => (
            <button
              key={item.id}
              type="button"
              disabled={busy}
              className={active.id === item.id ? "active" : ""}
              aria-current={active.id === item.id ? "page" : undefined}
              onClick={() => setSection(item.id)}
            >
              <item.icon size={17} />
              {item.label}
            </button>
          ))}
        </div>
      </div>
      <div className="v2-layout">
        <main className="v2-main">
          <ErrorView value={error} reload={() => void manualReload()} />
          {notice && (
            <div className="v2-message success" role="status">
              <CheckCircle2 size={18} />
              {notice}
            </div>
          )}
          {loading ? (
            <Loading />
          ) : (
            runtime && (
              <>
                {active.id === "overview" && (
                  <section
                    className="ws-template-overview"
                    aria-label="Tổng quan dự án"
                  >
                    <div className="ws-template-kpis">
                      <article className="ws-template-kpi">
                        <span className="ws-template-kpi-icon">
                          <Coins size={23} />
                        </span>
                        <div>
                          <span className="ws-template-kpi-label">
                            Ngân sách
                          </span>
                          <strong>
                            {money(
                              data!.assignment.agreedBudget,
                              data!.assignment.currencyCode,
                            )}
                          </strong>
                        </div>
                      </article>
                      <article className="ws-template-kpi">
                        <span className="ws-template-kpi-icon">
                          <CalendarDays size={23} />
                        </span>
                        <div>
                          <span className="ws-template-kpi-label">
                            Hạn hoàn thành
                          </span>
                          <strong>
                            {dateLabel(
                              currentScope?.deadline ?? data!.job.deadline,
                            )}
                          </strong>
                        </div>
                      </article>
                      <article className="ws-template-kpi">
                        <span className="ws-template-kpi-icon">
                          <CheckCircle2 size={23} />
                        </span>
                        <div>
                          <span className="ws-template-kpi-label">
                            Trạng thái
                          </span>
                          <span className="ws-template-status">
                            {assignmentLabels[data!.assignment.status]}
                          </span>
                        </div>
                      </article>
                    </div>
                    <div className="ws-template-content">
                      <article className="ws-template-panel ws-template-project">
                        <h2>
                          <FileCheck2 size={20} /> Thông tin dự án
                        </h2>
                        <div className="ws-template-project-description">
                          <RichDescription
                            text={
                              data!.job.description || "Chưa có mô tả dự án."
                            }
                          />
                        </div>
                        <div className="ws-template-scope-block">
                          <h3>Phạm vi</h3>
                          <div className="ws-template-skills">
                            {data!.job.skills.length
                              ? data!.job.skills
                                  .slice(0, 6)
                                  .map((skill) => (
                                    <span key={skill.skillId}>
                                      {skill.name}
                                    </span>
                                  ))
                              : (
                                  currentScope?.deliverables ||
                                  data!.job.deliverables ||
                                  ""
                                )
                                  .split(/[\n,;]+/)
                                  .map((v) => v.trim())
                                  .filter(Boolean)
                                  .slice(0, 4)
                                  .map((item, i) => (
                                    <span key={i}>
                                      {item.length > 55
                                        ? item.slice(0, 52) + "…"
                                        : item}
                                    </span>
                                  ))}
                            {!data!.job.skills.length &&
                              !(
                                currentScope?.deliverables ||
                                data!.job.deliverables
                              )?.trim() && (
                                <span>Chưa có thông tin phạm vi</span>
                              )}
                          </div>
                        </div>
                      </article>
                      <article className="ws-template-panel ws-template-review">
                        <h2>
                          <Star size={20} /> Đánh giá freelancer
                        </h2>
                        <div className="ws-template-review-body">
                          <div className="ws-template-score">
                            {projectReview ? (
                              <>
                                <strong>
                                  {Number(projectReview.overallRating).toFixed(
                                    1,
                                  )}
                                </strong>
                                <Stars
                                  value={projectReview.overallRating}
                                  label="Đánh giá tổng thể"
                                />
                              </>
                            ) : (
                              <>
                                <strong className="ws-template-no-rating">
                                  —
                                </strong>
                                <small>Chưa có đánh giá</small>
                              </>
                            )}
                          </div>
                          <div className="ws-template-freelancer">
                            <span className="ws-template-avatar">
                              {(data!.assignment.freelancerName || "FL")
                                .trim()
                                .split(/\s+/)
                                .slice(-2)
                                .map((name) => name.charAt(0))
                                .join("")
                                .toUpperCase()}
                            </span>
                            <div>
                              <strong>
                                {data!.assignment.freelancerName ||
                                  "Freelancer"}
                              </strong>
                              <small>Freelancer</small>
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="ws-template-review-button"
                          onClick={() => setSection("acceptance")}
                        >
                          Xem chi tiết đánh giá <ArrowRight size={17} />
                        </button>
                      </article>
                    </div>
                  </section>
                )}
                {active.id === "scope" && <ScopePanel runtime={runtime} />}
                {active.id === "acceptance" && (
                  <AcceptancePanel runtime={runtime} />
                )}
                {active.id === "milestones" && (
                  <MilestonesPanel runtime={runtime} />
                )}
              </>
            )
          )}
          {!clientView && (
            <div className="v2-workspace-footer">
              <span>LinkIT · Kết nối. Hợp tác. Sáng tạo.</span>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
const scopeRows = (source: string) =>
  source
    .split(/\r?\n|;|•/)
    .map((v) =>
      v
        .trim()
        .replace(/^[-–*✓✔]\s*/, "")
        .replace(/^\d+[.)]\s*/, ""),
    )
    .filter(Boolean);
const scopeCriteriaRows = (source: string) =>
  scopeRows(source).map((text) => {
    const match = text.match(
      /(?:^|\s|[-–(])((?:100|\d{1,2})(?:[.,]\d+)?)\s*%(?:\))?\s*$/,
    );
    return {
      title: match
        ? text
            .slice(0, match.index)
            .replace(/\s*[-–(:]\s*$/, "")
            .trim()
        : text,
      weight: match ? match[1] + "%" : null,
    };
  });
function ScopePanel({ runtime: r }: { runtime: Runtime }) {
  const { data, user } = r;
  const ordered = [...data.scopes].sort(
    (a, b) => b.versionNumber - a.versionNumber,
  );
  const [selected, setSelected] = useState<number | null>(
    ordered[0]?.id ?? null,
  );
  const [detail, setDetail] = useState<Scope | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [retry, setRetry] = useState(0);
  const [form, setForm] = useState(() => scopeForm(data, ordered[0]));
  const [editing, setEditing] = useState(!ordered.length);
  const [scopeDocument, setScopeDocument] = useState<ScopeDocumentInfo | null>(
    null,
  );
  const [documentBusy, setDocumentBusy] = useState(false);
  const [documentError, setDocumentError] = useState("");
  const current = ordered[0];
  const isLatest = detail?.id === current?.id;
  const client = party(user, data.assignment) === "CLIENT";
  const scopeVisible =
    client || (current != null && current.status !== "DRAFT");
  const approvals = detail?.approvals ?? [];

  const lockedByChange = detail?.status === "LOCKED" && approvals.length === 0;
  useEffect(() => {
    if (!selected && ordered.length) setSelected(ordered[0].id);
  }, [selected, ordered[0]?.id]);
  useEffect(() => {
    let alive = true;
    if (
      selected &&
      (client ||
        ordered.find((scope) => scope.id === selected)?.status !== "DRAFT")
    ) {
      setLoading(true);
      setError("");
      scopesApi
        .detail(selected)
        .then((value) => {
          if (alive) setDetail(value);
        })
        .catch((e) => {
          if (alive) {
            setDetail(null);
            setError(message(e));
          }
        })
        .finally(() => {
          if (alive) setLoading(false);
        });
    } else {
      setDetail(null);
      setLoading(false);
      setError("");
    }
    return () => {
      alive = false;
    };
  }, [selected, client, ordered[0]?.status, r.revision, retry]);
  useEffect(() => {
    let mounted = true;
    if (!scopeVisible) {
      setScopeDocument(null);
      return () => {
        mounted = false;
      };
    }
    scopeDocumentsApi
      .info(data.assignment.id)
      .then((v) => {
        if (mounted) setScopeDocument(v);
      })
      .catch((e) => {
        if (mounted) setDocumentError(message(e));
      });
    return () => {
      mounted = false;
    };
  }, [data.assignment.id, scopeVisible]);
  const uploadScopeDocument = async (file?: File) => {
    if (!file) return;
    if (!canEditDocument) {
      setDocumentError("Tài liệu đã được gửi để xác nhận, không thể thay đổi.");
      return;
    }
    if (
      !file.name.toLowerCase().endsWith(".pdf") ||
      file.size > 2 * 1024 * 1024
    ) {
      setDocumentError("Chỉ nhận PDF tối đa 2 MB.");
      return;
    }
    setDocumentBusy(true);
    setDocumentError("");
    try {
      setScopeDocument(
        await scopeDocumentsApi.upload(data.assignment.id, file),
      );
    } catch (e) {
      setDocumentError(message(e));
    } finally {
      setDocumentBusy(false);
    }
  };
  const openScopeDocument = async (download: boolean) => {
    setDocumentBusy(true);
    setDocumentError("");
    const tab = download ? null : window.open("about:blank", "_blank");
    if (tab) tab.opener = null;
    try {
      const blob = await scopeDocumentsApi.file(data.assignment.id);
      const url = URL.createObjectURL(
        new Blob([blob], { type: "application/pdf" }),
      );
      if (download) {
        const link = document.createElement("a");
        link.href = url;
        link.download = scopeDocument?.name || "Tai_lieu_pham_vi.pdf";
        document.body.appendChild(link);
        link.click();
        link.remove();
      } else if (tab) tab.location.href = url;
      else {
        const link = document.createElement("a");
        link.href = url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.click();
      }
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) {
      tab?.close();
      setDocumentError(message(e));
    } finally {
      setDocumentBusy(false);
    }
  };
  const rights = scopeRights(user, data, detail || undefined);
  const disabled = r.busy || r.blocked || loading;
  const canEditDocument =
    client &&
    (detail?.status === "DRAFT" || (!current && !detail)) &&
    data.assignment.status === "PENDING_SCOPE";
  const update = (key: keyof typeof form, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));
  return (
    <div className="workspace3-scope ws-template-scope">
      {!client &&
        detail?.status === "PENDING_APPROVAL" &&
        !detail.approvals.some((a) => a.partyRole === "FREELANCER") && (
          <div className="workspace3-scope-alert">
            <CheckCircle2 size={20} />
            <div>
              <strong>Client đã gửi phạm vi — Đến lượt bạn</strong>
              <p>
                Vui lòng đọc kỹ nội dung trước khi ký hoặc đề xuất chỉnh sửa.
              </p>
            </div>
          </div>
        )}

      {!isLatest && detail && (
        <div className="v2-message" role="status">
          <Clock3 size={18} /> Bạn đang xem phiên bản cũ. Chỉ phiên bản mới nhất
          mới có thể được xác nhận.
        </div>
      )}

      <div className="v2-two-col workspace3-scope-columns ws-template-scope-columns">
        <Card title="Sản phẩm cần bàn giao">
          <ErrorView value={error} reload={() => setRetry((n) => n + 1)} />
          {loading && <Loading />}
          {detail?.status === "PENDING_APPROVAL" &&
            rights.create &&
            !client &&
            !editing &&
            !detail.approvals.some(
              (a) => a.partyRole === party(user, data.assignment),
            ) && (
              <Button
                variant="secondary"
                disabled={disabled}
                onClick={() => {
                  setForm(scopeForm(data, detail));
                  setEditing(true);
                }}
              >
                Không đồng ý · Đề xuất chỉnh sửa
              </Button>
            )}
          {editing &&
            rights.create &&
            detail?.status === "PENDING_APPROVAL" && (
              <p className="v2-muted">
                Chỉnh sửa sẽ tạo phiên bản phạm vi mới. Hai bên cần xác nhận lại
                trên cùng phiên bản.
              </p>
            )}
          {editing && rights.create ? (
            <form
              className="v2-form"
              onSubmit={(e) => {
                e.preventDefault();
                void r.run(
                  () =>
                    scopesApi.create(
                      data.assignment.id,
                      scopeInput(form),
                      data.assignment.etag!,
                    ),
                  (value) => {
                    setSelected(value.id);
                    setEditing(false);
                  },
                );
              }}
            >
              {(
                [
                  ["deliverables", "Sản phẩm cần bàn giao"],
                  ["acceptanceCriteria", "Tiêu chí nghiệm thu"],
                ] as const
              ).map(([key, label]) => (
                <label key={key}>
                  {label}
                  <textarea
                    rows={4}
                    maxLength={20000}
                    disabled={disabled}
                    value={form[key]}
                    onChange={(e) => update(key, e.target.value)}
                  />
                </label>
              ))}
              <div className="ws-plan-editor">
                <div className="ws-plan-heading">
                  <div>
                    <strong>Lịch các mốc bàn giao</strong>
                    <small>
                      Hai bên thống nhất tên và thời hạn trước khi bắt đầu dự
                      án.
                    </small>
                  </div>
                </div>
                {form.milestonePlan.map((item, index) => (
                  <div className="ws-plan-edit-row" key={index}>
                    <label>
                      Tên mốc {index + 1}
                      <input
                        type="text"
                        maxLength={200}
                        placeholder="VD: Thiết kế giao diện"
                        disabled={disabled}
                        value={item.title}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            milestonePlan: prev.milestonePlan.map((row, i) =>
                              i === index
                                ? { ...row, title: e.target.value }
                                : row,
                            ),
                          }))
                        }
                      />
                    </label>
                    <label>
                      Hạn bàn giao
                      <input
                        type="date"
                        disabled={disabled}
                        max={form.deadline}
                        value={item.dueDate}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            milestonePlan: prev.milestonePlan.map((row, i) =>
                              i === index
                                ? { ...row, dueDate: e.target.value }
                                : row,
                            ),
                          }))
                        }
                      />
                    </label>
                    <button
                      type="button"
                      className="ws-plan-remove"
                      disabled={disabled}
                      aria-label={`Bỏ mốc ${index + 1}`}
                      onClick={() =>
                        setForm((prev) => ({
                          ...prev,
                          milestonePlan: prev.milestonePlan.filter(
                            (_, i) => i !== index,
                          ),
                        }))
                      }
                    >
                      Bỏ
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="ws-plan-add"
                  disabled={disabled || form.milestonePlan.length >= 30}
                  onClick={() =>
                    setForm((prev) => ({
                      ...prev,
                      milestonePlan: [
                        ...prev.milestonePlan,
                        { title: "", dueDate: "" },
                      ],
                    }))
                  }
                >
                  <Plus size={16} /> Thêm mốc
                </button>
              </div>
              <div className="v2-form-grid">
                <label>
                  Ngân sách ({data.assignment.currencyCode})
                  <input
                    inputMode="decimal"
                    disabled={disabled}
                    value={form.budget}
                    onChange={(e) => update("budget", e.target.value)}
                  />
                </label>
                <label>
                  Deadline
                  <input
                    type="date"
                    disabled={disabled}
                    value={form.deadline}
                    onChange={(e) => update("deadline", e.target.value)}
                  />
                </label>
              </div>
              <Button type="submit" disabled={disabled}>
                Lưu bản nháp phạm vi
              </Button>
            </form>
          ) : (
            scopeVisible &&
            detail &&
            !loading && (
              <>
                <div className="ws-ref-scope-detail">
                  <div className="ws-ref-list ws-sample-scope-list">
                    {scopeRows(detail.deliverables).map((item, i) => (
                      <div className="ws-sample-scope-row" key={i}>
                        <span className="ws-sample-check">
                          <CheckCircle2 size={16} />
                        </span>
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                  <h3 className="ws-template-section-caption">
                    <CalendarDays size={18} /> Lịch bàn giao đã thỏa thuận
                  </h3>
                  {readMilestonePlan(detail.exclusions).length ? (
                    <div className="ws-plan-summary">
                      {readMilestonePlan(detail.exclusions).map(
                        (item, index) => (
                          <div className="ws-plan-summary-row" key={index}>
                            <span className="ws-plan-index">
                              {String(index + 1).padStart(2, "0")}
                            </span>
                            <span className="ws-plan-title">{item.title}</span>
                            <strong>
                              {dateLabelForWorkspace(item.dueDate)}
                            </strong>
                          </div>
                        ),
                      )}
                    </div>
                  ) : (
                    <p className="ws-plan-legacy-note">
                      {detail.status === "LOCKED"
                        ? "Phạm vi cũ chưa lưu lịch từng mốc. Các mốc đã tạo vẫn được giữ nguyên."
                        : "Chưa có lịch mốc. Client cần bổ sung và lưu phạm vi trước khi gửi xác nhận."}
                    </p>
                  )}
                  <h3 className="ws-template-section-caption">
                    <Target size={18} /> Tiêu chí đánh giá
                  </h3>
                  <div className="ws-criteria-panel ws-sample-criteria-list">
                    {scopeCriteriaRows(detail.acceptanceCriteria).map(
                      (criterion, i) => (
                        <div key={i} className="ws-sample-criterion-row">
                          <span className="ws-sample-check">
                            <CheckCircle2 size={16} />
                          </span>
                          <span className="ws-sample-criterion-title">
                            {criterion.title}
                          </span>
                          {criterion.weight && (
                            <span className="ws-sample-criterion-weight">
                              {criterion.weight}
                            </span>
                          )}
                        </div>
                      ),
                    )}
                  </div>
                </div>
                {rights.submit && (
                  <Button
                    disabled={disabled}
                    onClick={() =>
                      void r.run(async () => {
                        if (!readMilestonePlan(detail.exclusions).length)
                          throw new Error(
                            "Hãy thêm ít nhất một mốc bàn giao và lưu phạm vi trước khi gửi.",
                          );
                        return scopesApi.submit(
                          detail.id,
                          data.assignment.etag!,
                        );
                      })
                    }
                  >
                    Gửi phạm vi & xác nhận phía Client
                  </Button>
                )}
              </>
            )
          )}
          {!scopeVisible && !client && (
            <EmptyState title="Đang chờ Client gửi phạm vi">
              Phạm vi, tiêu chí nghiệm thu và tài liệu chỉ hiển thị sau khi
              Client gửi xác nhận.
            </EmptyState>
          )}
          {!ordered.length && client && !editing && (
            <EmptyState title="Chưa có phạm vi dự án" />
          )}
        </Card>
        <div className="v2-stack">
          <Card title="Xác nhận" className="ws-template-approval-card">
            {client &&
              detail?.status === "PENDING_APPROVAL" &&
              (detail.approvals.some((a) => a.partyRole === "CLIENT") ? (
                <p className="ws-ref-copy" role="status">
                  Bạn đã gửi và xác nhận phạm vi. Đang chờ Freelancer xác nhận.
                </p>
              ) : (
                <p className="ws-ref-copy" role="status">
                  Phạm vi này được gửi trước khi cập nhật quy trình. Hãy chọn
                  “Xác nhận phạm vi” một lần để chuyển yêu cầu cho Freelancer.
                </p>
              ))}
            {scopeVisible &&
              (["CLIENT", "FREELANCER"] as const).map((role) => {
                const approval = detail?.approvals.find(
                  (a) => a.partyRole === role,
                );
                return (
                  <div
                    className="v2-approval ws-template-approval-row"
                    key={role}
                  >
                    <div className="ws-template-approval-avatar">
                      {role === "CLIENT" ? (
                        <Building2 size={21} />
                      ) : (
                        <UserRound size={21} />
                      )}
                    </div>
                    <div>
                      <b>
                        {role === "CLIENT"
                          ? `${data.assignment.companyName || "Khách hàng"}`
                          : `${data.assignment.freelancerName}`}
                      </b>
                      <small>
                        {role === "CLIENT" ? "Khách hàng" : "Người thực hiện"}
                      </small>
                    </div>
                    <Badge
                      tone={approval || lockedByChange ? "green" : "amber"}
                    >
                      {approval || lockedByChange
                        ? "Đã xác nhận"
                        : "Chờ xác nhận"}
                    </Badge>
                  </div>
                );
              })}
            {scopeVisible && rights.approve && detail && isLatest && (
              <Button
                disabled={disabled}
                onClick={() =>
                  void r.run(() =>
                    scopesApi.approve(detail.id, data.assignment.etag!),
                  )
                }
              >
                <ShieldCheck size={16} />
                {party(user, data.assignment) === "FREELANCER"
                  ? "Tôi đồng ý và xác nhận"
                  : "Xác nhận phạm vi"}{" "}
                · v{detail.versionNumber}
              </Button>
            )}
            {scopeVisible ? (
              <div className="ws-ref-attachment">
                <h3 className="ws-template-section-caption">
                  <Paperclip size={18} /> Tài liệu đính kèm
                </h3>
                <div className="ws-ref-document">
                  {scopeDocument ? (
                    <>
                      <span className="ws-template-pdf-badge">PDF</span>
                      <span className="ws-ref-document-name">
                        <strong>{scopeDocument.name}</strong>
                        <small>
                          {(scopeDocument.size / 1024 / 1024).toFixed(2)} MB
                        </small>
                      </span>
                      <div className="ws-ref-document-actions">
                        <button
                          type="button"
                          onClick={() => void openScopeDocument(false)}
                          disabled={documentBusy}
                          title="Xem PDF"
                        >
                          <Eye size={17} /> Xem
                        </button>
                        <button
                          type="button"
                          onClick={() => void openScopeDocument(true)}
                          disabled={documentBusy}
                          title="Tải PDF"
                        >
                          <Download size={17} /> Tải
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <span className="ws-ref-empty-doc">
                        <FileCheck2 size={20} />
                        <span>Chưa có tài liệu đính kèm</span>
                      </span>
                      <div className="ws-ref-document-actions">
                        <button
                          type="button"
                          disabled
                          title="Chưa có PDF để xem"
                        >
                          <Eye size={17} /> Xem
                        </button>
                        <button
                          type="button"
                          disabled
                          title="Chưa có PDF để tải"
                        >
                          <Download size={17} /> Tải
                        </button>
                      </div>
                    </>
                  )}
                </div>
                {canEditDocument && (
                  <label className="ws-ref-document-upload">
                    <Upload size={16} />
                    {scopeDocument ? "Thay tài liệu PDF" : "Tải PDF lên"}
                    <input
                      type="file"
                      accept="application/pdf,.pdf"
                      disabled={documentBusy}
                      onChange={(event) => {
                        void uploadScopeDocument(event.target.files?.[0]);
                        event.target.value = "";
                      }}
                    />
                  </label>
                )}
                {documentError && (
                  <p role="alert" className="ws-ref-document-error">
                    {documentError}
                  </p>
                )}
              </div>
            ) : (
              <p className="ws-ref-copy">
                Client đang chuẩn bị phạm vi. Tài liệu và xác nhận sẽ mở sau khi
                gửi.
              </p>
            )}
          </Card>
          <div
            className={`ws-template-scope-status ${detail?.status === "LOCKED" ? "is-locked" : ""}`}
          >
            <span className="ws-template-scope-status-message">
              {detail?.status === "LOCKED" ? (
                <CheckCircle2 size={22} />
              ) : (
                <Clock3 size={22} />
              )}
              <strong>
                {detail?.status === "LOCKED"
                  ? "Đã xác nhận"
                  : detail?.status === "PENDING_APPROVAL"
                    ? "Đang chờ xác nhận"
                    : detail
                      ? "Phạm vi đang soạn"
                      : "Chưa có phạm vi"}
              </strong>
            </span>
            {rights.create &&
              client &&
              detail?.status === "DRAFT" &&
              !editing && (
                <Button
                  variant="secondary"
                  disabled={disabled}
                  onClick={() => {
                    setForm(scopeForm(data, detail));
                    setEditing(true);
                  }}
                >
                  Chỉnh sửa
                </Button>
              )}
          </div>
        </div>
      </div>
    </div>
  );
}
const milestoneStatusText = (status: Milestone["status"]) =>
  (
    ({
      APPROVED: "Hoàn thành",
      PLANNED: "Chờ thực hiện",
      IN_PROGRESS: "Đang thực hiện",
      SUBMITTED: "Chờ duyệt",
      REVISION_REQUIRED: "Cần chỉnh sửa",
      CANCELLED: "Đã hủy",
    }) as Record<Milestone["status"], string>
  )[status];
const milestoneEvidenceName = (url: string) => {
  try {
    const part = new URL(url).pathname.split("/").filter(Boolean).pop();
    return part ? decodeURIComponent(part).slice(0, 90) : "Tài liệu bàn giao";
  } catch {
    return "Tài liệu bàn giao";
  }
};
const milestoneEvidenceType = (url: string) => {
  const name = milestoneEvidenceName(url);
  const ext = name.includes(".") ? name.split(".").pop()!.toUpperCase() : "URL";
  return ext.length > 4 ? "LINK" : ext;
};
const DELIVERY_LINKS_MARKER = "\n[LINKIT_DELIVERY_LINKS_V1]";
function unpackDelivery(note: string, evidenceUrl?: string | null) {
  const at = note.lastIndexOf(DELIVERY_LINKS_MARKER);
  if (at >= 0) {
    try {
      const links: unknown = JSON.parse(
        note.slice(at + DELIVERY_LINKS_MARKER.length),
      );
      if (
        Array.isArray(links) &&
        links.every(
          (link) => typeof link === "string" && /^https?:\/\//i.test(link),
        )
      )
        return { note: note.slice(0, at), links: links as string[] };
    } catch {}
  }
  return {
    note,
    links:
      evidenceUrl && /^https?:\/\//i.test(evidenceUrl) ? [evidenceUrl] : [],
  };
}
function MilestonesPanel({ runtime: r }: { runtime: Runtime }) {
  const [list, setList] = useState<Page<Milestone>>(blankPage);
  const [page, setPage] = useState(0);
  const [id, setId] = useState<number | null>(null);
  const [detail, setDetail] = useState<Milestone | null>(null);
  const [history, setHistory] = useState<Page<Submission>>(blankPage);
  const [historyPage, setHistoryPage] = useState(0);
  const [showPreviousSubmissions, setShowPreviousSubmissions] = useState(false);
  const [latest, setLatest] = useState<Submission | undefined>();
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState("");
  const [detailError, setDetailError] = useState("");
  const [retry, setRetry] = useState(0);
  const [form, setForm] = useState<MilestoneForm>(blankMilestone);
  const [editing, setEditing] = useState(false);
  const [target, setTarget] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [urls, setUrls] = useState<string[]>([""]);
  const [review, setReview] = useState("");
  const dirty = useRef(false);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    milestonesApi
      .list(r.data.assignment.id, page, 20)
      .then((value) => {
        if (alive) {
          setList(value);
          setId((previous) => previous ?? value.content[0]?.id ?? null);
        }
      })
      .catch((e) => {
        if (alive) {
          setList(blankPage());
          setError(message(e));
        }
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [page, r.revision, retry]);
  useEffect(() => {
    let alive = true;
    if (!id) {
      setDetail(null);
      return;
    }
    setDetailLoading(true);
    setDetailError("");
    Promise.all([
      milestonesApi.detail(id),
      milestonesApi.history(id, historyPage, 20),
      milestonesApi.history(id, 0, 1),
    ])
      .then(([m, h, newest]) => {
        if (alive) {
          setDetail(m);
          setHistory(h);
          setLatest(newest.content[0]);
        }
      })
      .catch((e) => {
        if (alive) {
          setDetail(null);
          setDetailError(message(e));
        }
      })
      .finally(() => {
        if (alive) setDetailLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [id, historyPage, r.revision, retry]);
  const rights = milestoneRights(
    r.user,
    r.data,
    detail || undefined,
    latest,
    history.totalElements > 0,
  );
  const disabled = r.busy || r.blocked || detailLoading || loading;
  const locked = r.data.scopes.find((s) => s.status === "LOCKED");
  const agreedPlan = readMilestonePlan(locked?.exclusions);
  const pick = (value: Milestone) => {
    if (
      dirty.current &&
      !window.confirm("Bỏ nội dung chưa lưu để chọn Milestone khác?")
    )
      return;
    setId(value.id);
    setHistoryPage(0);
    setShowPreviousSubmissions(false);
    setEditing(false);
    setNote("");
    setUrls([""]);
    setReview("");
    dirty.current = false;
  };
  const edit = (m?: Milestone) => {
    if (dirty.current && !window.confirm("Thay nội dung form hiện tại?"))
      return;
    const firstOpen = agreedPlan.find(
      (item) => !list.content.some((existing) => existing.title === item.title),
    );
    const index = agreedPlan.findIndex(
      (item) => item.title === firstOpen?.title,
    );
    setForm(
      m
        ? milestoneForm(m)
        : firstOpen
          ? {
              ...blankMilestone(),
              title: firstOpen.title,
              description: firstOpen.title,
              acceptanceCriteria: locked?.acceptanceCriteria || "",
              dueDate: firstOpen.dueDate,
              isRequired: "true",
              sortOrder: String(index + 1),
              amount: "0",
            }
          : blankMilestone(),
    );
    setTarget(m?.id ?? null);
    setEditing(true);
    dirty.current = false;
  };
  const update = (key: keyof MilestoneForm, value: string) => {
    dirty.current = true;
    setForm((prev) => ({ ...prev, [key]: value }));
  };
  return (
    <div className="v2-stack ws-reference-milestones ws-template-milestones">
      <section
        className={`ms-ref-list-panel ${!loading && !error && !list.content.length ? "ms-ref-list-empty" : ""}`}
        style={
          !loading && !error && !list.content.length
            ? { width: "100%", maxWidth: "none", minHeight: 0 }
            : undefined
        }
        aria-label="Danh sách mốc"
      >
        <header className="ms-ref-panel-head">
          <h2>
            <Layers3 size={20} /> Danh sách mốc
          </h2>
          {rights.create && (
            <button
              type="button"
              className="ms-ref-add"
              aria-label="Thêm mốc bàn giao"
              onClick={() => edit()}
              disabled={disabled}
            >
              <Plus size={18} />
            </button>
          )}
        </header>
        <div className="ms-ref-items">
          <ErrorView value={error} reload={() => setRetry((n) => n + 1)} />
          {loading ? (
            <Loading />
          ) : (
            !error && (
              <>
                {list.content.map((m) => (
                  <button
                    type="button"
                    key={m.id}
                    className={`ms-ref-item ${m.id === id ? "is-selected" : ""}`}
                    aria-pressed={m.id === id}
                    disabled={r.busy}
                    onClick={() => pick(m)}
                  >
                    <span
                      className={`ms-ref-mark ${m.status === "APPROVED" ? "is-done" : ""}`}
                    >
                      {m.status === "APPROVED" ? (
                        <CheckCircle2 size={20} />
                      ) : (
                        <span className="ms-ref-circle" />
                      )}
                    </span>
                    <span className="ms-ref-item-text">
                      <strong>
                        Mốc {m.sortOrder} – {m.title}
                      </strong>
                      <small>
                        <CalendarDays size={14} />
                        {dateLabelForWorkspace(m.dueDate)}
                      </small>
                    </span>
                    <span
                      className={`ms-ref-status ms-ref-status-${m.status.toLowerCase()}`}
                    >
                      {milestoneStatusText(m.status)}
                    </span>
                  </button>
                ))}
                {!list.content.length && (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      textAlign: "center",
                      gap: 12,
                      padding: "38px 20px 44px",
                      minHeight: 210,
                    }}
                  >
                    <div
                      style={{
                        display: "grid",
                        placeItems: "center",
                        width: 58,
                        height: 58,
                        borderRadius: 18,
                        background: "#eafaf1",
                        color: "#009b62",
                      }}
                    >
                      <Layers3 size={28} />
                    </div>
                    <strong style={{ fontSize: 19, color: "#132b25" }}>
                      Chưa có mốc bàn giao
                    </strong>
                    <span
                      style={{
                        fontSize: 14,
                        color: "#64748b",
                        maxWidth: 460,
                        lineHeight: 1.6,
                      }}
                    >
                      {locked
                        ? "Client sẽ tạo mốc theo lịch bàn giao hai bên đã xác nhận. Freelancer nộp sản phẩm tại từng mốc."
                        : "Hai bên cần chốt sản phẩm, tiêu chí nghiệm thu và lịch từng mốc trong Phạm vi & xác nhận trước."}
                    </span>
                    {rights.create && (
                      <button
                        type="button"
                        className="ms-ref-add"
                        style={{
                          width: "auto",
                          height: 40,
                          padding: "0 18px",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 8,
                          borderRadius: 10,
                        }}
                        disabled={disabled}
                        onClick={() => edit()}
                      >
                        <Plus size={17} /> Tạo mốc đầu tiên
                      </button>
                    )}
                  </div>
                )}
                <Paging
                  page={list.page}
                  pages={list.totalPages}
                  total={list.totalElements}
                  disabled={r.busy}
                  change={setPage}
                />
              </>
            )
          )}
        </div>
      </section>
      {editing && (
        <div className="ws-template-modal-overlay">
          <div
            className="ws-template-modal-dialog"
            role="dialog"
            aria-modal="true"
            aria-label={target ? "Chỉnh sửa mốc bàn giao" : "Thêm mốc bàn giao"}
          >
            <Card title={target ? "Chỉnh sửa mốc" : "Thêm mốc bàn giao"}>
              <form
                className="v2-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  void r.run(
                    async () => {
                      if (!locked) throw new Error("Chưa có Scope LOCKED.");
                      const input = milestoneInput(form, locked.deadline);
                      if (agreedPlan.length) {
                        const agreed = agreedPlan.find(
                          (item) => item.title === input.title,
                        );
                        if (!agreed || agreed.dueDate !== input.dueDate)
                          throw new Error(
                            "Tên và hạn bàn giao phải đúng kế hoạch đã được hai bên xác nhận.",
                          );
                        if (
                          !target &&
                          list.content.some(
                            (item) => item.title === input.title,
                          )
                        )
                          throw new Error(
                            "Mốc này đã được tạo. Vui lòng chọn mốc khác trong kế hoạch.",
                          );
                      }
                      if (target) {
                        if (!detail || detail.id !== target || !rights.edit)
                          throw new Error(
                            "Milestone không còn được sửa. Nội dung form được giữ nguyên.",
                          );
                        return milestonesApi.update(target, input, detail.etag);
                      }
                      return milestonesApi.create(r.data.assignment.id, input);
                    },
                    (m) => {
                      setId(m.id);
                      setEditing(false);
                      dirty.current = false;
                    },
                  );
                }}
              >
                {!target && agreedPlan.length > 0 && (
                  <label>
                    Mốc theo kế hoạch đã chốt
                    <select
                      value={form.title}
                      disabled={disabled}
                      onChange={(e) => {
                        const next = agreedPlan.find(
                          (item) => item.title === e.target.value,
                        );
                        if (!next) return;
                        const index = agreedPlan.indexOf(next);
                        setForm((prev) => ({
                          ...prev,
                          title: next.title,
                          dueDate: next.dueDate,
                          description: prev.description || next.title,
                          sortOrder: String(index + 1),
                        }));
                      }}
                    >
                      <option value="">Chọn mốc bàn giao</option>
                      {agreedPlan.map((item, i) => (
                        <option
                          key={i}
                          value={item.title}
                          disabled={list.content.some(
                            (existing) => existing.title === item.title,
                          )}
                        >
                          {item.title} · {dateLabelForWorkspace(item.dueDate)}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {(
                  [
                    ["title", "Tiêu đề"],
                    ["description", "Mô tả"],
                    ["acceptanceCriteria", "Tiêu chí nghiệm thu"],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key}>
                    {label}
                    {key === "title" ? (
                      <input
                        maxLength={200}
                        disabled={
                          disabled || (!target && agreedPlan.length > 0)
                        }
                        value={form[key]}
                        onChange={(e) => update(key, e.target.value)}
                      />
                    ) : (
                      <textarea
                        rows={3}
                        maxLength={20000}
                        disabled={disabled}
                        value={form[key]}
                        onChange={(e) => update(key, e.target.value)}
                      />
                    )}
                  </label>
                ))}
                <div className="v2-form-grid">
                  <label>
                    Hạn bàn giao
                    <input
                      type="date"
                      disabled={disabled || (!target && agreedPlan.length > 0)}
                      value={form.dueDate}
                      onChange={(e) => update("dueDate", e.target.value)}
                    />
                  </label>
                  <label>
                    Ngân sách ({r.data.assignment.currencyCode})
                    <input
                      inputMode="decimal"
                      disabled={disabled}
                      value={form.amount}
                      onChange={(e) => update("amount", e.target.value)}
                    />
                  </label>
                  <label>
                    Bắt buộc
                    <select
                      disabled={disabled}
                      value={form.isRequired}
                      onChange={(e) => update("isRequired", e.target.value)}
                    >
                      <option value="">Chọn yêu cầu</option>
                      <option value="true">Bắt buộc</option>
                      <option value="false">Tùy chọn</option>
                    </select>
                  </label>
                  <label>
                    Thứ tự
                    <input
                      inputMode="numeric"
                      disabled={disabled}
                      value={form.sortOrder}
                      onChange={(e) => update("sortOrder", e.target.value)}
                    />
                  </label>
                </div>
                <Button
                  type="submit"
                  disabled={
                    disabled || (target ? !rights.edit : !rights.create)
                  }
                >
                  Lưu mốc
                </Button>
              </form>
            </Card>
            <button
              type="button"
              className="ws-template-modal-close"
              disabled={r.busy}
              onClick={() => {
                if (
                  !dirty.current ||
                  window.confirm("Hủy nội dung chưa lưu?")
                ) {
                  setEditing(false);
                  dirty.current = false;
                }
              }}
            >
              Đóng
            </button>
          </div>
        </div>
      )}
      <ErrorView value={detailError} reload={() => setRetry((n) => n + 1)} />
      {detailLoading ? (
        <Loading />
      ) : (
        detail && (
          <section
            className="ms-ref-detail-panel"
            aria-label="Chi tiết mốc bàn giao"
          >
            <header className="ms-ref-panel-head ms-ref-detail-head">
              <div className="ms-ref-detail-title">
                {detail.status === "APPROVED" ? (
                  <CheckCircle2 size={21} />
                ) : (
                  <CalendarDays size={21} />
                )}
                <h2>
                  Mốc {detail.sortOrder} – {detail.title}
                </h2>
              </div>
              <span
                className={`ms-ref-status ms-ref-status-${detail.status.toLowerCase()}`}
              >
                {milestoneStatusText(detail.status)}
              </span>
            </header>
            <div className="ms-ref-detail-content">
              <div className="ms-ref-description">
                <FileText size={18} />
                <RichDescription text={detail.description} />
              </div>
              <section className="ms-ref-result">
                <h3>
                  <Paperclip size={18} /> Kết quả bàn giao
                </h3>
                {latest &&
                unpackDelivery(latest.submissionNote, latest.evidenceUrl).links
                  .length ? (
                  unpackDelivery(
                    latest.submissionNote,
                    latest.evidenceUrl,
                  ).links.map((link, index) => (
                    <div className="ms-ref-file" key={index}>
                      <div className="ms-ref-file-type">
                        {milestoneEvidenceType(link)}
                      </div>
                      <div className="ms-ref-file-info">
                        <strong title={milestoneEvidenceName(link)}>
                          {milestoneEvidenceName(link)}
                        </strong>
                        <small>
                          Liên kết {index + 1} · Lần bàn giao{" "}
                          {latest.submissionNumber}
                        </small>
                      </div>
                      <div className="ms-ref-file-actions">
                        <a
                          href={link}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label="Mở liên kết"
                        >
                          <ExternalLink size={18} />
                        </a>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="ms-ref-empty-result">
                    Chưa có liên kết bàn giao.
                  </div>
                )}
                {latest &&
                  unpackDelivery(
                    latest.submissionNote,
                    latest.evidenceUrl,
                  ).note.trim() && (
                    <div className="ms-ref-latest-note">
                      <span className="ms-ref-note-label">
                        Ghi chú bàn giao
                      </span>
                      <RichDescription
                        text={
                          unpackDelivery(
                            latest.submissionNote,
                            latest.evidenceUrl,
                          ).note
                        }
                      />
                    </div>
                  )}
                {latest?.reviewNote && (
                  <div className="ms-ref-review-feedback">
                    <CheckCircle2 size={16} />
                    <div>
                      <strong>Nhận xét của Client</strong>
                      <p>{latest.reviewNote}</p>
                    </div>
                  </div>
                )}
                {history.totalElements > 1 && (
                  <div className="ms-ref-history-block">
                    <button
                      type="button"
                      className="ms-ref-history-toggle"
                      onClick={() => setShowPreviousSubmissions((v) => !v)}
                      aria-expanded={showPreviousSubmissions}
                    >
                      <span>
                        <Clock3 size={17} /> Lịch sử bàn giao{" "}
                        <small>{history.totalElements - 1} lần trước</small>
                      </span>
                      <ChevronRight
                        size={17}
                        className={showPreviousSubmissions ? "is-expanded" : ""}
                      />
                    </button>
                    {showPreviousSubmissions && (
                      <div className="ms-ref-history-list">
                        {history.content
                          .filter((item) => item.id !== latest?.id)
                          .map((item) => (
                            <article
                              className="ms-ref-old-delivery"
                              key={item.id}
                            >
                              <div className="ms-ref-old-delivery-head">
                                <strong>Lần {item.submissionNumber}</strong>
                                <time>
                                  {dateLabelForWorkspace(item.submittedAt)}
                                </time>
                              </div>
                              <div className="ms-ref-old-delivery-note">
                                <RichDescription
                                  text={
                                    unpackDelivery(
                                      item.submissionNote,
                                      item.evidenceUrl,
                                    ).note || "Không có ghi chú"
                                  }
                                />
                              </div>
                              {unpackDelivery(
                                item.submissionNote,
                                item.evidenceUrl,
                              ).links.map((link, i) => (
                                <a
                                  key={i}
                                  href={link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  <ExternalLink size={14} /> Liên kết {i + 1}
                                </a>
                              ))}
                              {item.reviewNote && (
                                <div className="ms-ref-old-feedback">
                                  <span>Nhận xét</span>
                                  <p>{item.reviewNote}</p>
                                </div>
                              )}
                            </article>
                          ))}
                        <Paging
                          page={history.page}
                          pages={history.totalPages}
                          total={history.totalElements}
                          disabled={disabled}
                          change={setHistoryPage}
                        />
                      </div>
                    )}
                  </div>
                )}
              </section>
              {detail.acceptanceCriteria.trim() && (
                <section
                  className="ms-ref-criteria-panel"
                  aria-label="Tiêu chí nghiệm thu"
                >
                  <h3>
                    <CheckCircle2 size={18} /> Tiêu chí nghiệm thu
                  </h3>
                  <div className="ms-ref-criteria-content">
                    <RichDescription text={detail.acceptanceCriteria} />
                  </div>
                </section>
              )}
              {rights.submit && (
                <div className="ms-ref-submit-form">
                  <h3>Nộp kết quả bàn giao</h3>
                  <>
                    <form
                      className="v2-form"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void r.run(
                          () =>
                            milestonesApi.submit(
                              detail.id,
                              submissionInput(
                                (note.trim() || "Bàn giao sản phẩm") +
                                  DELIVERY_LINKS_MARKER +
                                  JSON.stringify(
                                    urls.map((v) => v.trim()).filter(Boolean),
                                  ),
                                urls.find((v) => v.trim()) || "",
                              ),
                              detail.etag,
                            ),
                          () => {
                            setNote("");
                            setUrls([""]);
                            dirty.current = false;
                            setHistoryPage(0);
                          },
                        );
                      }}
                    >
                      <label>
                        Ghi chú bàn giao (không bắt buộc)
                        <textarea
                          rows={3}
                          maxLength={20000}
                          disabled={disabled}
                          value={note}
                          onChange={(e) => {
                            dirty.current = true;
                            setNote(e.target.value);
                          }}
                        />
                      </label>
                      <div className="ms-delivery-links">
                        <div className="ms-delivery-links-heading">
                          <strong>Liên kết sản phẩm</strong>
                          <button
                            type="button"
                            disabled={disabled || urls.length >= 20}
                            onClick={() => setUrls((v) => [...v, ""])}
                          >
                            <Plus size={15} /> Thêm liên kết
                          </button>
                        </div>
                        {urls.map((value, index) => (
                          <div className="ms-delivery-link-row" key={index}>
                            <input
                              aria-label={`Liên kết ${index + 1}`}
                              type="url"
                              placeholder="https://..."
                              maxLength={1000}
                              disabled={disabled}
                              value={value}
                              onChange={(e) => {
                                dirty.current = true;
                                setUrls((v) =>
                                  v.map((link, i) =>
                                    i === index ? e.target.value : link,
                                  ),
                                );
                              }}
                            />
                            {urls.length > 1 && (
                              <button
                                type="button"
                                disabled={disabled}
                                aria-label={`Xóa liên kết ${index + 1}`}
                                onClick={() =>
                                  setUrls((v) =>
                                    v.filter((_, i) => i !== index),
                                  )
                                }
                              >
                                Xóa
                              </button>
                            )}
                          </div>
                        ))}
                        <small>
                          Tối đa 20 liên kết. Ghi chú không bắt buộc.
                        </small>
                      </div>
                      <Button
                        type="submit"
                        disabled={disabled || !urls.some((v) => v.trim())}
                      >
                        {detail.status === "REVISION_REQUIRED"
                          ? "Nộp lại kết quả"
                          : "Nộp bàn giao"}
                      </Button>
                    </form>
                  </>
                </div>
              )}
              {rights.review && latest && historyPage === 0 && (
                <div className="ms-ref-review-note">
                  <label htmlFor="ms-review-input">
                    Nhận xét / lý do chỉnh sửa
                  </label>
                  <textarea
                    id="ms-review-input"
                    rows={2}
                    maxLength={20000}
                    disabled={disabled}
                    value={review}
                    onChange={(e) => {
                      dirty.current = true;
                      setReview(e.target.value);
                    }}
                  />
                </div>
              )}
            </div>
            {(rights.review || rights.edit) && (
              <footer className="ms-ref-detail-actions">
                {rights.edit && (
                  <div className="ms-ref-management-actions">
                    <Button
                      variant="secondary"
                      disabled={disabled}
                      onClick={() => edit(detail)}
                    >
                      Chỉnh sửa mốc
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={disabled}
                      onClick={() => {
                        if (window.confirm("Hủy mềm Milestone PLANNED này?"))
                          void r.run(() =>
                            milestonesApi.cancel(detail.id, detail.etag),
                          );
                      }}
                    >
                      Hủy mốc
                    </Button>
                  </div>
                )}

                {rights.review && latest && historyPage > 0 && (
                  <Button variant="secondary" onClick={() => setHistoryPage(0)}>
                    Xem lần mới nhất
                  </Button>
                )}
                {rights.review && latest && historyPage === 0 && (
                  <>
                    <Button
                      variant="secondary"
                      disabled={disabled}
                      onClick={() =>
                        void r.run(
                          () =>
                            milestonesApi.revise(
                              latest.id,
                              reviewNote(review, true)!,
                              detail.etag,
                            ),
                          () => {
                            setReview("");
                            dirty.current = false;
                          },
                        )
                      }
                    >
                      <RotateCcw size={17} /> Yêu cầu chỉnh sửa
                    </Button>
                    <Button
                      disabled={disabled}
                      onClick={() =>
                        void r.run(
                          () =>
                            milestonesApi.approve(
                              latest.id,
                              reviewNote(review, false),
                              detail.etag,
                            ),
                          () => {
                            setReview("");
                            dirty.current = false;
                          },
                        )
                      }
                    >
                      <Check size={17} /> Xác nhận
                    </Button>
                  </>
                )}
              </footer>
            )}
          </section>
        )
      )}
    </div>
  );
}
