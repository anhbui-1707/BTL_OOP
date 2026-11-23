import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  FileCheck2,
  FileText,
  FolderKanban,
  LayoutDashboard,
  LoaderCircle,
  LockKeyhole,
  SearchCheck,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  UsersRound,
} from "lucide-react";
import { Badge, Button, Card, EmptyState, Progress } from "../../components/ui";
import { createDemoWorkspace } from "./fixtures";
import { demoRepository } from "./repository";
import {
  acceptanceBlockers,
  qualityScore,
  risks,
  transition,
  type Action,
  type Role,
  type Section,
  type Workspace as WorkspaceState,
} from "./model";
import {
  CandidatesPanel,
  dateLabel,
  money,
  QualityPanel,
} from "./RecruitmentPanels";
import {
  AcceptancePanel,
  ChangesPanel,
  MilestonesPanel,
  RisksPanel,
  ScopePanel,
} from "./DeliveryPanels";
import "./workspace.css";

const sections = [
  { id: "overview", label: "Tổng quan", icon: LayoutDashboard },
  { id: "quality", label: "Chất lượng tin", icon: ClipboardCheck },
  { id: "matching", label: "Độ phù hợp", icon: SearchCheck },
  { id: "proposals", label: "Proposal & lựa chọn", icon: UsersRound },
  { id: "scope", label: "Phạm vi dự án", icon: LockKeyhole },
  { id: "milestones", label: "Milestone", icon: FolderKanban },
  { id: "acceptance", label: "Nghiệm thu & đánh giá", icon: FileCheck2 },
] as const;
export const workspacePages: Record<string, Section> = {
  "Không gian dự án": "overview",
  "Chất lượng tin": "quality",
  "Độ phù hợp": "matching",
  "Scope Lock": "scope",
  Milestone: "milestones",
  "Cảnh báo & nghiệm thu": "acceptance",
  "Báo cáo": "overview",
};

function Overview({
  state,
  go,
}: {
  state: WorkspaceState;
  go: (section: Section) => void;
}) {
  const done = state.milestones.filter((m) => m.status === "APPROVED").length;
  const selected = state.candidates.find((c) => c.id === state.selectedId);
  const steps = [
    { name: "Chọn cộng sự", done: !!selected, section: "proposals" },
    { name: "Khóa phạm vi", done: state.scope.locked, section: "scope" },
    {
      name: "Bàn giao milestone",
      done: done === state.milestones.length,
      section: "milestones",
    },
    {
      name: "Nghiệm thu cuối",
      done: !!state.acceptedAt,
      section: "acceptance",
    },
  ] as const;
  const next = steps.find((s) => !s.done);
  return (
    <div className="v2-stack">
      <div className="v2-stats-grid">
        {[
          {
            title: "Ngân sách đã thống nhất",
            value: money(state.scope.budget),
            detail: `Scope v${state.scope.version}`,
            icon: FileText,
          },
          {
            title: "Tiến độ bàn giao",
            value: `${done}/${state.milestones.length}`,
            detail: "Milestone đã nghiệm thu",
            icon: FolderKanban,
          },
          {
            title: "Chất lượng tin",
            value: `${qualityScore(state.job).score}/100`,
            detail: "Theo quy tắc demo",
            icon: Sparkles,
          },
          {
            title: "Rủi ro cần chú ý",
            value: String(risks(state).length).padStart(2, "0"),
            detail: "Được tính từ tiến độ",
            icon: ShieldCheck,
          },
        ].map((item) => (
          <Card key={item.title}>
            <div className="v2-stat-label">
              <span>{item.title}</span>
              <item.icon size={18} />
            </div>
            <strong className="v2-stat-value">{item.value}</strong>
            <small className="v2-muted">{item.detail}</small>
          </Card>
        ))}
      </div>
      <div className="v2-two-col">
        <div className="v2-stack">
          <section className="v2-next-step">
            <Badge>HÀNH TRÌNH DỰ ÁN</Badge>
            <h2>
              {next ? next.name : "Hợp tác trọn vẹn, thành quả xứng đáng."}
            </h2>
            <p>
              {next
                ? "Đưa dự án tiến thêm một bước. Mọi quyết định được ghi nhận, mọi kỳ vọng đều rõ ràng."
                : "Dự án đã hoàn thành. Đừng quên ghi nhận Freelancer bằng một đánh giá."}
            </p>
            <Button onClick={() => go(next?.section || "acceptance")}>
              {next ? "Tiếp tục bước này" : "Xem nghiệm thu"}
              <ArrowRight size={17} />
            </Button>
            <div className="v2-next-decoration" aria-hidden="true">
              <FolderKanban size={110} strokeWidth={1} />
            </div>
          </section>
          <Card
            title="Lộ trình hợp tác"
            action={
              <Badge tone="green">
                {steps.filter((s) => s.done).length}/4 bước
              </Badge>
            }
          >
            <div className="v2-journey">
              {steps.map((s, i) => (
                <button key={s.name} onClick={() => go(s.section)}>
                  <span className={`v2-step ${s.done ? "done" : ""}`}>
                    {s.done ? <CheckCircle2 size={20} /> : i + 1}
                  </span>
                  <span>
                    <b>{s.name}</b>
                    <small>{s.done ? "Hoàn tất" : "Chưa hoàn tất"}</small>
                  </span>
                  <ChevronRight size={17} />
                </button>
              ))}
            </div>
          </Card>
          <Card
            title="Các mốc bàn giao"
            action={
              <Button variant="ghost" onClick={() => go("milestones")}>
                Xem tất cả <ArrowRight size={15} />
              </Button>
            }
          >
            {state.milestones.map((m) => (
              <div className="v2-history-row" key={m.id}>
                <div className="v2-mini-icon">
                  <FolderKanban size={18} />
                </div>
                <span>
                  <b>{m.title}</b>
                  <small>
                    {dateLabel(m.due)} · {money(m.amount)}
                  </small>
                </span>
                <Badge tone={m.status === "APPROVED" ? "green" : "neutral"}>
                  {m.status === "APPROVED" ? "Đã duyệt" : "Đang chờ"}
                </Badge>
              </div>
            ))}
          </Card>
        </div>
        <div className="v2-stack">
          <Card title="Cộng sự dự án">
            {selected ? (
              <>
                <div className="v2-inline">
                  <div className="v2-avatar">{selected.initials}</div>
                  <div>
                    <h3>{selected.name}</h3>
                    <p className="v2-muted">{selected.title}</p>
                  </div>
                </div>
                <div className="v2-tags">
                  {selected.skills.map((s) => (
                    <span key={s}>{s}</span>
                  ))}
                </div>
                <Badge tone="green">
                  <CheckCircle2 size={14} />
                  Freelancer duy nhất của dự án
                </Badge>
              </>
            ) : (
              <EmptyState
                icon={<UsersRound size={28} />}
                title="Tìm cộng sự phù hợp"
              >
                <p>
                  {state.candidates.length} Proposal mẫu đang chờ bạn xem xét.
                </p>
                <Button variant="secondary" onClick={() => go("proposals")}>
                  Xem Proposal
                </Button>
              </EmptyState>
            )}
          </Card>
          <Card title="Hoạt động gần đây">
            <div className="v2-activity">
              {state.activity.slice(0, 6).map((event, i) => (
                <div key={`${event.at}-${i}`}>
                  <span className="v2-activity-dot" />
                  <div>
                    <p>{event.text}</p>
                    <small>{new Date(event.at).toLocaleString("vi-VN")}</small>
                  </div>
                </div>
              ))}
            </div>
          </Card>
          <div className="v2-tip">
            <ShieldCheck size={22} />
            <h3>Hợp tác có cơ sở.</h3>
            <p>
              Scope được khóa, milestone minh bạch và mọi thay đổi đều cần sự
              đồng thuận.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Workspace({
  role: suppliedRole = "Client",
  initialSection = "overview",
  embedded = false,
  demo = true,
  sectionOnly = false,
}: {
  role?: Role;
  initialSection?: Section;
  embedded?: boolean;
  demo?: boolean;
  sectionOnly?: boolean;
}) {
  const [state, setState] = useState<WorkspaceState | null>(null);
  const [role, setRole] = useState<Role>(suppliedRole);
  const [section, setSection] = useState<Section>(
    sections.some((s) => s.id === initialSection) ? initialSection : "overview",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [resetConfirm, setResetConfirm] = useState(false);
  const inFlight = useRef(false);
  const stateRef = useRef<WorkspaceState | null>(null);
  useEffect(() => {
    setSection(
      sections.some((s) => s.id === initialSection)
        ? initialSection
        : "overview",
    );
  }, [initialSection]);
  useEffect(() => {
    if (!demo) return;
    let cancelled = false;
    demoRepository
      .load()
      .then((data) => {
        if (!cancelled) {
          stateRef.current = data;
          setState(data);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(String(e.message));
      });
    return () => {
      cancelled = true;
    };
  }, [demo]);
  useEffect(() => {
    if (embedded) return;
    const update = () => {
      const value = location.hash.slice(1);
      if (sections.some((s) => s.id === value)) setSection(value as Section);
    };
    update();
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, [embedded]);
  const go = (id: Section) => {
    if (sectionOnly && id !== initialSection) return;
    setSection(id);
    setError("");
    setNotice("");
    if (!embedded) location.hash = id;
  };
  const dispatch = async (action: Action) => {
    if (!stateRef.current || inFlight.current) return false;
    inFlight.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const next = transition(stateRef.current, action, role);
      await demoRepository.save(next);
      stateRef.current = next;
      setState(next);
      setNotice(next.activity[0].text);
      return true;
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Không thể lưu thay đổi. Vui lòng thử lại.",
      );
      return false;
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };
  const restart = async () => {
    try {
      const next = createDemoWorkspace();
      await demoRepository.save(next);
      stateRef.current = next;
      setState(next);
      setError("");
      setResetConfirm(false);
      go("overview");
    } catch {
      setError(
        "Không thể lưu bản demo. Kiểm tra quyền lưu trữ của trình duyệt.",
      );
    }
  };
  if (!demo) return null;
  const panelProps = state ? { state, role, dispatch, busy } : null;
  const activeSection = sections.find((s) => s.id === section)!;
  return (
    <div
      className={`v2-root ${embedded ? "v2-embedded" : "v2-standalone"} ${sectionOnly ? "v2-section-only" : ""}`}
    >
      {!embedded && (
        <header className="v2-topbar">
          <a className="v2-brand" href="/#/">
            <img src="/linkit-brand-logo.png" alt="LinkIT" />
          </a>
          <span className="v2-topbar-divider" />
          <span className="v2-topbar-title">Không gian làm việc</span>
          <a className="v2-back" href="/#/">
            <ArrowLeft size={16} />
            Về marketplace
          </a>
        </header>
      )}
      <div className="v2-demo-banner">
        <span>
          <Sparkles size={16} />
          <b>Bản demo giao diện</b>
          <span>
            {" "}
            · Dữ liệu mẫu lưu riêng trên trình duyệt, không cập nhật backend.
          </span>
        </span>
        <label>
          Xem vai trò
          <select
            aria-label="Vai trò demo"
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
          >
            <option>Client</option>
            <option>Freelancer</option>
            <option>Admin</option>
          </select>
        </label>
      </div>
      <div className="v2-layout">
        <aside className="v2-sidebar">
          <div className="v2-sidebar-label">PROJECT WORKSPACE</div>
          <nav aria-label="Điều hướng LinkIT 2.0">
            {sections.map((s) => (
              <button
                key={s.id}
                className={section === s.id ? "active" : ""}
                aria-current={section === s.id ? "page" : undefined}
                onClick={() => go(s.id)}
              >
                <s.icon size={18} />
                <span>{s.label}</span>
              </button>
            ))}
          </nav>
          <div className="v2-sidebar-bottom">
            <div className="v2-avatar small">
              {role.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <b>Không gian {role}</b>
              <small>LinkIT 2.0 · Preview</small>
            </div>
          </div>
        </aside>
        <main className="v2-main">
          <div className="v2-breadcrumb">
            Dự án <ChevronRight size={14} />
            {state?.id || "Demo"}
            <ChevronRight size={14} />
            {activeSection.label}
          </div>
          <div className="v2-page-heading">
            <div>
              <div className="v2-inline">
                <span className="v2-eyebrow">{state?.company || "LINKIT"}</span>
                {state && (
                  <Badge tone="green">
                    {state.acceptedAt
                      ? "Hoàn thành"
                      : state.selectedId
                        ? "Đang hợp tác"
                        : "Đang tuyển"}
                  </Badge>
                )}
              </div>
              <h1>
                {section === "overview"
                  ? state?.job.title || "Không gian dự án"
                  : activeSection.label}
              </h1>
              <p className="v2-muted">
                Từ ý tưởng đến bàn giao — cùng nhau tạo nên giá trị.
              </p>
            </div>
            <Button variant="secondary" onClick={() => setResetConfirm(true)}>
              Tạo bản demo mới
            </Button>
          </div>
          {resetConfirm && (
            <Card title="Bắt đầu lại dữ liệu demo?">
              <p>
                Thao tác này chỉ thay dữ liệu demo trong trình duyệt; tài khoản
                và dự án thật không bị ảnh hưởng.
              </p>
              <div className="v2-actions">
                <Button
                  variant="secondary"
                  onClick={() => setResetConfirm(false)}
                >
                  Giữ bản hiện tại
                </Button>
                <Button onClick={() => void restart()}>Tạo lại demo</Button>
              </div>
            </Card>
          )}
          {error && (
            <div className="v2-message error" role="alert">
              <TriangleAlert size={18} />
              {error}
            </div>
          )}
          {notice && (
            <div className="v2-message success" role="status">
              <CheckCircle2 size={18} />
              {notice}
            </div>
          )}
          {!state && !error && (
            <div className="v2-empty" role="status">
              <LoaderCircle className="v2-spin" />
              Đang tải không gian làm việc…
            </div>
          )}
          {state && panelProps && (
            <div key={`${section}-${state.scope.version}`}>
              {section === "overview" && <Overview state={state} go={go} />}
              {section === "quality" && <QualityPanel {...panelProps} />}
              {(section === "matching" || section === "proposals") && (
                <CandidatesPanel
                  {...panelProps}
                  matching={section === "matching"}
                />
              )}
              {section === "scope" && (
                <ScopePanel key={JSON.stringify(state.scope)} {...panelProps} />
              )}
              {section === "milestones" && <MilestonesPanel {...panelProps} />}
              {section === "changes" && <ChangesPanel {...panelProps} />}
              {section === "risks" && <RisksPanel {...panelProps} />}
              {section === "acceptance" && <AcceptancePanel {...panelProps} />}
            </div>
          )}
          <div className="v2-workspace-footer">
            <span>LinkIT · Kết nối. Hợp tác. Sáng tạo.</span>
            {state && (
              <span>
                {acceptanceBlockers(state).length
                  ? "Đang hoàn thiện điều kiện nghiệm thu"
                  : "Đủ điều kiện nghiệm thu"}
              </span>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
