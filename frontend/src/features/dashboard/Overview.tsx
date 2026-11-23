import { useEffect, useState, type ReactNode } from "react";
import {
  BriefcaseBusiness,
  FolderKanban,
  CheckCircle2,
  X,
  FileText,
  UsersRound,
  Search,
  ShieldCheck,
  Clock3,
  Send,
  Bell,
  ArrowRight,
  Building2,
  Zap,
} from "lucide-react";
import { money } from "../jobs/model";
import type { AuthUser } from "../../api/auth";
import { sessionGeneration } from "../../auth/session";
import type { JobSummary } from "../../api/jobs";
import {
  assignmentLabels,
  initialDashboard,
  jobLabels,
  loadDashboard,
  metric,
  monthly,
  proposalLabels,
  resourceError,
  rows,
  type DashboardData,
  type DashboardRole,
  type Resource,
  type Series,
} from "./model";

const unavailable = "Chưa có dữ liệu thống kê";
const unsupported = { state: "unsupported" } as const;
function ResourceState<T>({ value }: { value: Resource<T> }) {
  if (value.state === "loading") return <p role="status">Đang tải thống kê…</p>;
  if (value.state === "error")
    return (
      <p className="auth-error" role="alert">
        {value.message}
      </p>
    );
  if (value.state === "unsupported") return <p>{unavailable}</p>;
  if (value.state === "empty") return <p>Chưa có hoạt động để hiển thị.</p>;
  return null;
}
function Bars({ series, title }: { series: Series; title: string }) {
  if (series.state === "unsupported") return <p>{series.message}</p>;
  if (series.state === "empty")
    return <p>Chưa có hoạt động trong giai đoạn này.</p>;
  const max = Math.max(1, ...series.months.map((m) => m.count));
  return (
    <>
      <div className="bar-chart" aria-label={title}>
        {series.months.map((m) => (
          <div key={m.label}>
            <span
              role="img"
              tabIndex={0}
              className="chart-bar"
              style={{
                height: `${(m.count / max) * 100}%`,
                opacity: m.count ? 1 : 0,
              }}
              data-tooltip={`${m.count}`}
              aria-label={`${m.label}: ${m.count}`}
            />
            <span>{m.label}</span>
          </div>
        ))}
      </div>
    </>
  );
}
function Distribution<T extends { status: string }>({
  value,
  labels,
  title,
  donut = false,
}: {
  value: Resource<T>;
  labels: Record<string, string>;
  title: string;
  donut?: boolean;
}) {
  const items = rows(value);
  const count = (status: string) =>
    items?.filter((i) => i.status === status).length ?? 0;
  const palette = [
    "#22c55e",
    "#3b82f6",
    "#14b8a6",
    "#ef4444",
    "#8b5cf6",
    "#64748b",
    "#f59e0b",
  ];
  let offset = 0;
  const gradient = Object.keys(labels)
    .map((status, i) => {
      const start = offset;
      offset += items?.length ? (count(status) / items.length) * 100 : 0;
      return `${palette[i % palette.length]} ${start}% ${offset}%`;
    })
    .join(",");
  return (
    <article className="panel chart-card assignment-chart">
      <div className="chart-heading">
        <div>
          <h3>{title}</h3>
          <p>
            {metric(value)} {items ? "bản ghi trong phạm vi tài khoản" : ""}
          </p>
        </div>
      </div>
      <ResourceState value={value} />
      {items &&
        (donut ? (
          <div className="donut-wrap">
            <div
              className="client-job-donut"
              style={{
                background: items.length
                  ? `conic-gradient(${gradient})`
                  : "conic-gradient(#d1d5db 0 100%)",
              }}
            >
              <div>
                <strong>{metric(value)}</strong>
                <span>Tổng</span>
              </div>
            </div>
            <div className="chart-legend">
              {Object.entries(labels).map(([status, label], i) => (
                <span key={status}>
                  <i style={{ background: palette[i % palette.length] }} />
                  {label}
                  <b>{count(status)}</b>
                </span>
              ))}
            </div>
          </div>
        ) : (
          Object.entries(labels).map(([status, label], i) => (
            <div className="status-chart-row" key={status}>
              <div>
                <span>{label}</span>
                <b>{count(status)}</b>
              </div>
              <div>
                <i
                  className={i ? "status-progress" : "status-completed"}
                  style={{
                    width: `${items.length ? (count(status) / items.length) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
          ))
        ))}
    </article>
  );
}
function Charts({ role, data }: { role: DashboardRole; data: DashboardData }) {
  const client = role === "Client";
  const assignments = rows(data.assignments);
  const completed =
    assignments &&
    monthly(
      assignments.filter((item) => item.status === "COMPLETED"),
      (item) => item.completedAt,
    );
  return (
    <section
      className="dashboard-insights"
      aria-label={
        client ? "Biểu đồ tổng quan Client" : "Biểu đồ tổng quan Freelancer"
      }
    >
      <div className="dashboard-insights-heading">
        <div>
          <h2>Thống kê trực quan</h2>
          <p>
            {client
              ? "Phân bố công việc và đề xuất ứng viên theo trạng thái."
              : "Trạng thái đề xuất và số dự án hoàn thành theo từng tháng."}
          </p>
        </div>
        <span className="dashboard-insights-tag">Dữ liệu tài khoản</span>
      </div>
      <div className="dashboard-insights-grid">
        {client ? (
          <>
            <Distribution
              value={data.jobs}
              labels={jobLabels}
              title="Phân bố trạng thái Job"
              donut
            />
            <Distribution
              value={data.proposals}
              labels={proposalLabels}
              title="Phân bố trạng thái Proposal"
              donut
            />
          </>
        ) : (
          <>
            <Distribution
              value={data.proposals}
              labels={proposalLabels}
              title="Trạng thái Proposal"
              donut
            />
            <article className="panel chart-card completed-chart">
              <div className="chart-heading">
                <div>
                  <h3>Công việc hoàn thành theo tháng</h3>
                  <p>6 tháng gần nhất · theo giờ UTC</p>
                </div>
              </div>
              <ResourceState value={data.assignments} />
              {completed && (
                <Bars
                  series={completed}
                  title="Số dự án hoàn thành theo từng tháng"
                />
              )}
            </article>
          </>
        )}
      </div>
    </section>
  );
}

interface Props {
  user: AuthUser;
  role: DashboardRole;
  navigate: (page: string) => void;
  renderJob: (job: JobSummary) => ReactNode;
  openAssignment: (id: number) => void;
  onCreateJob?: () => void;
  onOpenJob?: (id: number | undefined, panel: "details" | "proposals") => void;
}
export default function DashboardOverview({
  user,
  role,
  navigate,
  renderJob,
  openAssignment,
  onCreateJob,
  onOpenJob,
}: Props) {
  const [data, setData] = useState<DashboardData>(() => initialDashboard(role));
  const [reload, setReload] = useState(0);
  const principal = JSON.stringify([
    user.id,
    [...user.roles].sort(),
    role,
    sessionGeneration(),
  ]);
  useEffect(() => {
    let alive = true;
    setData(initialDashboard(role));
    loadDashboard(user, role, sessionGeneration())
      .then((result) => {
        if (alive) setData(result);
      })
      .catch((e) => {
        if (alive)
          setData({
            jobs: resourceError(e),
            proposals: resourceError(e),
            assignments: resourceError(e),
          });
      });
    return () => {
      alive = false;
    };
  }, [principal, reload]);
  const loading = [data.jobs, data.proposals, data.assignments].some(
    (r) => r.state === "loading",
  );
  const jobs = rows(data.jobs);
  const assignments = rows(data.assignments);
  const proposals = rows(data.proposals);
  const count = <T extends { status: string }>(
    r: Resource<T>,
    status: string,
  ) => metric(r, (list) => list.filter((i) => i.status === status).length);
  const renderClientOverview = () => {
    const openJob = (
      id?: number,
      panel: "details" | "proposals" = "details",
    ) => {
      const selectedId =
        id ??
        (panel === "proposals"
          ? (proposals?.find((item) => item.status === "PENDING")?.jobId ??
            jobs?.[0]?.id)
          : undefined);
      if (onOpenJob) onOpenJob(selectedId, panel);
      else navigate("Quản lý công việc");
    };
    const company =
      jobs?.find((job) => job.companyName?.trim())?.companyName ||
      user.fullName;
    const recentJobs = [...(jobs ?? [])]
      .sort(
        (a, b) =>
          (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0),
      )
      .slice(0, 3);
    const pending = proposals?.filter(
      (item) => item.status === "PENDING",
    ).length;
    const kpis = [
      {
        label: "Job đã tạo",
        value: metric(data.jobs),
        icon: <BriefcaseBusiness />,
        action: () => openJob(),
      },
      {
        label: "Đề xuất nhận được",
        value: metric(data.proposals),
        icon: <Send />,
        action: () => openJob(undefined, "proposals"),
      },
      {
        label: "Đang thực hiện",
        value: count(data.assignments, "ACTIVE"),
        icon: <FolderKanban />,
        action: () => navigate("Không gian dự án"),
      },
      {
        label: "Đã hoàn thành",
        value: count(data.assignments, "COMPLETED"),
        icon: <CheckCircle2 />,
        action: () => navigate("Không gian dự án"),
      },
    ];
    return (
      <div className="client-overview">
        <div className="client-overview-greeting">
          <div>
            <h1>
              Chào {company} <span aria-hidden="true">👋</span>
            </h1>
            <p>Quản lý tuyển dụng và các dự án của bạn trên LinkIT.</p>
          </div>
          <span className="client-overview-role">
            <Building2 size={18} />
            Client
          </span>
        </div>
        <div
          className="client-overview-kpis"
          aria-label="Tổng quan tuyển dụng"
          aria-busy={loading}
        >
          {kpis.map((item) => (
            <button
              className="metric-card clickable-metric"
              key={item.label}
              onClick={item.action}
              aria-label={`${item.label}: ${item.value}`}
            >
              <div className="metric-icon green">{item.icon}</div>
              <div className="metric-copy">
                <span>{item.label}</span>
                <strong title={item.value}>
                  {Number.isFinite(Number(item.value)) ? item.value : "—"}
                </strong>
                {!Number.isFinite(Number(item.value)) && (
                  <small>{item.value}</small>
                )}
              </div>
              <ArrowRight className="client-overview-kpi-arrow" size={18} />
            </button>
          ))}
        </div>
        <Charts role="Client" data={data} />
        <section
          className="panel client-overview-attention"
          aria-labelledby="client-attention-title"
        >
          <div className="client-overview-attention-content">
            <div className="client-overview-attention-icon">
              <Bell size={28} />
            </div>
            <div>
              <h2 id="client-attention-title">Việc cần xử lý</h2>
              {pending === undefined ? (
                <ResourceState value={data.proposals} />
              ) : (
                <p>
                  {pending > 0
                    ? `Bạn có ${pending} đề xuất đang chờ xem xét và phản hồi.`
                    : "Hiện không có đề xuất đang chờ phản hồi."}
                </p>
              )}
            </div>
            <button
              className="primary-button"
              onClick={() => openJob(undefined, "proposals")}
            >
              Xem đề xuất
              <ArrowRight size={17} />
            </button>
          </div>
        </section>
        <div className="client-overview-bottom">
          <section
            className="panel management-surface client-overview-jobs"
            aria-labelledby="client-recent-title"
          >
            <div className="panel-heading">
              <h2 id="client-recent-title">Công việc (Job) gần đây</h2>
              <button className="text-button" onClick={() => openJob()}>
                Xem tất cả
                <ArrowRight size={16} />
              </button>
            </div>
            {!jobs ? (
              <>
                <ResourceState value={data.jobs} />
                {data.jobs.state === "error" && (
                  <button
                    className="text-button"
                    disabled={loading}
                    onClick={() => setReload((n) => n + 1)}
                  >
                    Thử lại
                  </button>
                )}
              </>
            ) : recentJobs.length ? (
              <table className="management-table">
                <caption className="sr-only">
                  Ba công việc được tạo gần đây nhất
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Job</th>
                    <th scope="col">Ngân sách</th>
                    <th scope="col">Đề xuất</th>
                    <th scope="col">Deadline</th>
                    <th scope="col">Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {recentJobs.map((job) => (
                    <tr key={job.id}>
                      <td data-label="Job">
                        <button
                          className="table-title client-overview-job-title"
                          onClick={() => openJob(job.id)}
                        >
                          <span className="client-overview-job-icon">
                            <BriefcaseBusiness size={18} />
                          </span>
                          <span>{job.title || "Bản nháp chưa đặt tên"}</span>
                        </button>
                      </td>
                      <td data-label="Ngân sách">
                        <span className="table-number">
                          {money(job.budgetMin, "").trim()}
                        </span>
                        {" – "}
                        <span className="table-number">
                          {money(job.budgetMax, job.currencyCode)}
                        </span>
                      </td>
                      <td data-label="Đề xuất">
                        <button
                          className="text-button"
                          title="Xem đề xuất của Job"
                          onClick={() => openJob(job.id, "proposals")}
                        >
                          {proposals
                            ? proposals.filter((item) => item.jobId === job.id)
                                .length
                            : "—"}
                        </button>
                      </td>
                      <td data-label="Deadline">
                        <time className="table-number" dateTime={job.deadline}>
                          {job.deadline
                            ? job.deadline
                                .split("T")[0]
                                .split("-")
                                .reverse()
                                .join("/")
                            : "Chưa đặt"}
                        </time>
                      </td>
                      <td data-label="Trạng thái">
                        <b
                          className={`status job-status-${job.status.toLowerCase()}`}
                        >
                          {jobLabels[job.status]}
                        </b>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="client-overview-empty">
                Bạn chưa có Job nào. Đăng công việc đầu tiên để bắt đầu nhận đề
                xuất.
              </p>
            )}
          </section>
          <section
            className="panel client-overview-quick"
            aria-labelledby="client-quick-title"
          >
            <div className="panel-heading">
              <h2 id="client-quick-title">
                <Zap size={21} />
                Thao tác nhanh
              </h2>
            </div>
            <div className="client-overview-quick-links">
              <button
                onClick={() =>
                  onCreateJob ? onCreateJob() : navigate("Quản lý công việc")
                }
              >
                <span>
                  <BriefcaseBusiness size={21} />
                </span>
                <strong>Đăng Job mới</strong>
                <ArrowRight size={18} />
              </button>
              <button onClick={() => openJob(undefined, "proposals")}>
                <span>
                  <Send size={21} />
                </span>
                <strong>Xem đề xuất</strong>
                <ArrowRight size={18} />
              </button>
              <button onClick={() => navigate("Không gian dự án")}>
                <span>
                  <FolderKanban size={21} />
                </span>
                <strong>Quản lý dự án</strong>
                <ArrowRight size={18} />
              </button>
            </div>
            {data.assignments.state === "error" && (
              <>
                <ResourceState value={data.assignments} />
                <button
                  className="text-button"
                  disabled={loading}
                  onClick={() => setReload((n) => n + 1)}
                >
                  Tải lại thống kê
                </button>
              </>
            )}
          </section>
        </div>
      </div>
    );
  };
  const renderFreelancerOverview = () => {
    const kpis = [
      {
        label: "Tổng số Job",
        value: metric(data.assignments),
        icon: <BriefcaseBusiness />,
        page: "Công việc của tôi",
      },
      {
        label: "Đề xuất đã gửi",
        value: metric(data.proposals),
        icon: <FileText />,
        page: "Đề xuất đã gửi",
      },
      {
        label: "Đang thực hiện",
        value: count(data.assignments, "ACTIVE"),
        icon: <BriefcaseBusiness />,
        page: "Công việc của tôi",
      },
      {
        label: "Đã hoàn thành",
        value: count(data.assignments, "COMPLETED"),
        icon: <CheckCircle2 />,
        page: "Công việc của tôi",
      },
    ];
    const awaitingScope =
      assignments?.filter((item) => item.status === "PENDING_SCOPE").length ??
      0;
    const activeWork = [...(assignments ?? [])]
      .filter((item) => item.status === "ACTIVE")
      .sort(
        (a, b) =>
          (Date.parse(b.startedAt || b.createdAt) || 0) -
          (Date.parse(a.startedAt || a.createdAt) || 0),
      )
      .slice(0, 3);
    const recentProposals = [...(proposals ?? [])]
      .sort(
        (a, b) =>
          (Date.parse(b.submittedAt) || 0) - (Date.parse(a.submittedAt) || 0),
      )
      .slice(0, 3);
    const recent = [
      ...(assignments ?? []).map((item) => ({
        key: "assignment-" + item.id,
        title: item.jobTitle,
        label: item.completedAt
          ? "Hoàn thành dự án"
          : item.startedAt
            ? "Bắt đầu dự án"
            : "Nhận dự án",
        status: assignmentLabels[item.status],
        statusCode: item.status.toLowerCase(),
        icon: item.completedAt ? (
          <CheckCircle2 size={19} />
        ) : (
          <BriefcaseBusiness size={19} />
        ),
        date: item.completedAt || item.startedAt || item.createdAt,
        open: () => openAssignment(item.id),
      })),
      ...(proposals ?? []).map((item) => ({
        key: "proposal-" + item.id,
        title: item.jobTitle,
        label: "Gửi đề xuất",
        status: proposalLabels[item.status],
        statusCode: item.status.toLowerCase(),
        icon: <Send size={19} />,
        date: item.submittedAt,
        open: () => navigate("Đề xuất đã gửi"),
      })),
    ]
      .sort((a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0))
      .slice(0, 5);
    const dateLabel = (date: string) =>
      Number.isFinite(Date.parse(date))
        ? new Date(date).toLocaleDateString("vi-VN")
        : "Chưa có ngày";
    return (
      <div className="freelancer-overview">
        <div className="freelancer-overview-heading">
          <div>
            <h1>
              Chào {user.fullName} <span aria-hidden="true">👋</span>
            </h1>
            <p>Theo dõi công việc và đề xuất của bạn trên LinkIT.</p>
          </div>
          <button
            className="primary-button"
            onClick={() => navigate("Tìm việc")}
          >
            <Search size={17} />
            Tìm việc ngay
          </button>
        </div>
        <div
          className="freelancer-overview-kpis"
          aria-label="Tình trạng công việc và đề xuất"
          aria-busy={loading}
        >
          {kpis.map((item) => (
            <button
              className="metric-card clickable-metric"
              key={item.label}
              onClick={() => navigate(item.page)}
              aria-label={item.label + ": " + item.value}
            >
              <div className="metric-icon green">{item.icon}</div>
              <div className="metric-copy">
                <span>{item.label}</span>
                <strong title={item.value}>
                  {Number.isFinite(Number(item.value)) ? item.value : "—"}
                </strong>
                {!Number.isFinite(Number(item.value)) && (
                  <small>{item.value}</small>
                )}
              </div>
            </button>
          ))}
        </div>
        {assignments && awaitingScope > 0 && (
          <div className="freelancer-overview-notice" role="status">
            <span>Bạn có {awaitingScope} dự án chờ thống nhất phạm vi.</span>
            <button
              className="text-button"
              onClick={() => navigate("Công việc của tôi")}
            >
              Xem dự án
              <ArrowRight size={15} />
            </button>
          </div>
        )}
        <Charts role="Freelancer" data={data} />
        <div className="freelancer-overview-sections">
          <section
            className="panel freelancer-overview-recent"
            aria-labelledby="freelancer-recent-title"
          >
            <div className="panel-heading">
              <h2 id="freelancer-recent-title">
                <span className="freelancer-overview-section-icon">
                  <Clock3 size={19} />
                </span>
                Hoạt động gần đây
              </h2>
              <button
                className="text-button"
                disabled={loading}
                onClick={() => setReload((number) => number + 1)}
              >
                Tải lại
              </button>
            </div>
            {recent.length ? (
              <ul className="freelancer-overview-list">
                {recent.map((item) => (
                  <li key={item.key}>
                    <button
                      className="freelancer-activity-row"
                      onClick={item.open}
                    >
                      <span className="freelancer-activity-icon">
                        {item.icon}
                      </span>
                      <span className="freelancer-activity-copy">
                        <strong>{item.label}</strong>
                        <small>{item.title}</small>
                      </span>
                      <time dateTime={item.date}>{dateLabel(item.date)}</time>
                      <b
                        className={
                          "status freelancer-status-" + item.statusCode
                        }
                      >
                        {item.status}
                      </b>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="freelancer-overview-empty">
                {loading
                  ? "Đang tải hoạt động…"
                  : assignments && proposals
                    ? "Chưa có hoạt động để hiển thị."
                    : "Chưa tải được đầy đủ hoạt động. Bạn có thể thử tải lại."}
              </p>
            )}
          </section>
          <div className="freelancer-overview-side">
            <section
              className="panel freelancer-overview-work"
              aria-labelledby="freelancer-work-title"
            >
              <div className="panel-heading">
                <h2 id="freelancer-work-title">
                  <span className="freelancer-overview-section-icon">
                    <BriefcaseBusiness size={19} />
                  </span>
                  Công việc đang thực hiện
                </h2>
                {activeWork.length > 0 && (
                  <button
                    className="text-button"
                    onClick={() => navigate("Công việc của tôi")}
                  >
                    Xem tất cả
                    <ArrowRight size={15} />
                  </button>
                )}
              </div>
              {!assignments ? (
                <ResourceState value={data.assignments} />
              ) : activeWork.length ? (
                <ul className="freelancer-overview-list">
                  {activeWork.map((item) => (
                    <li key={item.id}>
                      <button
                        className="freelancer-overview-row"
                        onClick={() => openAssignment(item.id)}
                        aria-label={"Mở workspace dự án " + item.jobTitle}
                      >
                        <span>
                          <strong>{item.jobTitle}</strong>
                          <small>
                            {item.companyName || "Dự án #" + item.id}
                          </small>
                          <span className="freelancer-overview-work-link">
                            Mở workspace →
                          </span>
                        </span>
                        <b className="status freelancer-status-active">
                          {assignmentLabels[item.status]}
                        </b>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="freelancer-work-empty">
                  <span className="freelancer-work-empty-icon">
                    <BriefcaseBusiness size={29} />
                  </span>
                  <p>Bạn chưa có công việc nào đang thực hiện.</p>
                  <button
                    className="secondary-button"
                    onClick={() => navigate("Tìm việc")}
                  >
                    Tìm việc phù hợp
                  </button>
                </div>
              )}
            </section>
            <section
              className="panel freelancer-overview-proposals"
              aria-labelledby="freelancer-proposals-title"
            >
              <div className="panel-heading">
                <h2 id="freelancer-proposals-title">
                  <span className="freelancer-overview-section-icon">
                    <Send size={19} />
                  </span>
                  Đề xuất gần đây
                </h2>
                <button
                  className="text-button"
                  onClick={() => navigate("Đề xuất đã gửi")}
                >
                  Xem tất cả
                  <ArrowRight size={15} />
                </button>
              </div>
              {!proposals ? (
                <ResourceState value={data.proposals} />
              ) : recentProposals.length ? (
                <ul className="freelancer-overview-list">
                  {recentProposals.map((item) => (
                    <li key={item.id}>
                      <button
                        className="freelancer-overview-row"
                        onClick={() => navigate("Đề xuất đã gửi")}
                      >
                        <span>
                          <strong>{item.jobTitle}</strong>
                          <small>
                            Đề xuất ngày {dateLabel(item.submittedAt)}
                          </small>
                        </span>
                        <b
                          className={
                            "status freelancer-status-" +
                            item.status.toLowerCase()
                          }
                        >
                          {proposalLabels[item.status]}
                        </b>
                        <ArrowRight
                          className="freelancer-proposal-arrow"
                          size={15}
                        />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="freelancer-overview-empty">
                  Bạn chưa gửi đề xuất nào. Tìm việc phù hợp để bắt đầu.
                </p>
              )}
            </section>
          </div>
        </div>
      </div>
    );
  };
  const assignmentPage =
    role === "Freelancer"
      ? "Công việc của tôi"
      : role === "Admin"
        ? "Quản lý công việc"
        : "Không gian dự án";
  const journey =
    role === "Freelancer"
      ? [
          ["Tìm việc", "Tìm việc"],
          ["Theo dõi đề xuất", "Đề xuất đã gửi"],
          ["Công việc của tôi", "Công việc của tôi"],
          ["Làm việc & bàn giao", "Không gian dự án"],
        ]
      : [
          ["Job & đề xuất", "Quản lý công việc"],
          ["Chất lượng tin", "Chất lượng tin"],
          ["Theo dõi dự án", "Không gian dự án"],
          ["Làm việc & nghiệm thu", "Không gian dự án"],
        ];
  const cards =
    role === "Client"
      ? [
          {
            label: "Tổng tin tuyển dụng",
            value: metric(data.jobs),
            icon: <BriefcaseBusiness />,
            color: "green",
            page: "Quản lý công việc",
          },
          {
            label: "Đang mở",
            value: count(data.jobs, "OPEN"),
            icon: <Search />,
            color: "blue",
            page: "Quản lý công việc",
          },
          {
            label: "Đang thực hiện",
            value: count(data.jobs, "IN_PROGRESS"),
            icon: <FolderKanban />,
            color: "violet",
            page: "Quản lý công việc",
          },
          {
            label: "Đã hoàn thành",
            value: count(data.assignments, "COMPLETED"),
            icon: <CheckCircle2 />,
            color: "green",
            page: assignmentPage,
          },
          {
            label: "Tổng đề xuất",
            value: metric(data.proposals),
            icon: <FileText />,
            color: "amber",
            page: "Quản lý công việc",
          },
          {
            label: "Tổng dự án",
            value: metric(data.assignments),
            icon: <UsersRound />,
            color: "blue",
            page: assignmentPage,
          },
        ]
      : role === "Freelancer"
        ? [
            {
              label: "Tổng công việc",
              value: metric(data.assignments),
              icon: <BriefcaseBusiness />,
              color: "green",
              page: assignmentPage,
            },
            {
              label: "Đang thực hiện",
              value: count(data.assignments, "ACTIVE"),
              icon: <FolderKanban />,
              color: "blue",
              page: assignmentPage,
            },
            {
              label: "Đã hoàn thành",
              value: count(data.assignments, "COMPLETED"),
              icon: <CheckCircle2 />,
              color: "green",
              page: assignmentPage,
            },
            {
              label: "Đã hủy",
              value: count(data.assignments, "CANCELLED"),
              icon: <X />,
              color: "violet",
              page: assignmentPage,
            },
            {
              label: "Proposal đã gửi",
              value: metric(data.proposals),
              icon: <FileText />,
              color: "blue",
              page: "Đề xuất đã gửi",
            },
            {
              label: "Đề xuất chờ phản hồi",
              value: count(data.proposals, "PENDING"),
              icon: <Clock3 />,
              color: "green",
              page: "Đề xuất đã gửi",
            },
            {
              label: "Dự án chờ nghiệm thu",
              value: count(data.assignments, "AWAITING_ACCEPTANCE"),
              icon: <CheckCircle2 />,
              color: "amber",
              page: "Không gian dự án",
            },
          ]
        : [
            {
              label: "Job đang mở",
              value: count(data.jobs, "OPEN"),
              icon: <BriefcaseBusiness />,
              color: "green",
              page: "Quản lý công việc",
            },
            {
              label: "Tổng người dùng",
              value: unavailable,
              icon: <UsersRound />,
              color: "blue",
              page: "Quản lý người dùng",
            },
            {
              label: "Tổng Job hệ thống",
              value: metric(data.jobs),
              icon: <FolderKanban />,
              color: "violet",
              page: "Quản lý công việc",
            },
            {
              label: "Tài khoản hoạt động",
              value: unavailable,
              icon: <ShieldCheck />,
              color: "amber",
              page: "Quản lý người dùng",
            },
          ];
  const overview = (
    <div className={role === "Admin" ? undefined : "management-dashboard"}>
      {role !== "Admin" && (
        <section className="panel overview-actions">
          <div className="panel-heading">
            <div>
              <h2>
                {role === "Client"
                  ? "Quản lý tuyển dụng, liền mạch hơn"
                  : "Bước tiếp theo trên hành trình của bạn"}
              </h2>
              <p>
                {role === "Client"
                  ? "Từ tin tuyển dụng đến dự án được bàn giao."
                  : "Tìm cơ hội, theo dõi đề xuất và bắt đầu công việc mới."}
              </p>
            </div>
          </div>
          <ol className="work-journey">
            {journey.map(([label, page], index) => (
              <li key={label}>
                <button onClick={() => navigate(page)}>
                  <span>{index + 1}</span>
                  {label}
                </button>
              </li>
            ))}
          </ol>
        </section>
      )}
      <div className="panel-heading">
        <span>
          {role === "Admin"
            ? "Job toàn hệ thống theo quyền ADMIN"
            : "Thống kê trong phạm vi tài khoản của bạn"}
        </span>
        <button
          className="text-button"
          disabled={loading}
          onClick={() => setReload((n) => n + 1)}
        >
          Tải lại thống kê
        </button>
      </div>
      <div
        className={`metrics ${role === "Client" ? "client-metrics" : role === "Freelancer" ? "freelancer-metrics" : ""}`}
        aria-busy={loading}
      >
        {cards.map((card) => (
          <button
            type="button"
            className="metric-card clickable-metric"
            key={card.label}
            onClick={() => navigate(card.page)}
            aria-label={`${card.label}: ${card.value}`}
          >
            <div className={`metric-icon ${card.color}`}>{card.icon}</div>
            <div className="metric-copy">
              <span>{card.label}</span>
              <strong>
                {Number.isFinite(Number(card.value)) ? card.value : "—"}
              </strong>
              {!Number.isFinite(Number(card.value)) && (
                <small className="quality-note">{card.value}</small>
              )}
            </div>
          </button>
        ))}
      </div>
      {role !== "Admin" && <Charts role={role} data={data} />}
      <div
        className={
          role === "Freelancer"
            ? "overview-grid"
            : `content-grid ${role === "Client" ? "client-overview-content" : ""}`
        }
      >
        <section
          className={`panel ${role === "Freelancer" ? "current-work" : "jobs-panel"}`}
        >
          <div className="panel-heading">
            <div>
              <h2>
                {role === "Freelancer"
                  ? "Công việc đang thực hiện"
                  : role === "Admin"
                    ? "Job mới trên hệ thống"
                    : "Công việc đang tuyển"}
              </h2>
              <p>Cập nhật theo tài khoản của bạn</p>
            </div>
            <button
              className="text-button"
              onClick={() =>
                navigate(
                  role === "Freelancer" ? assignmentPage : "Quản lý công việc",
                )
              }
            >
              Xem tất cả
            </button>
          </div>
          {role === "Freelancer" ? (
            <>
              <ResourceState value={data.assignments} />
              {assignments &&
                (assignments.some((a) => a.status === "ACTIVE")
                  ? assignments
                      .filter((a) => a.status === "ACTIVE")
                      .slice(0, 2)
                      .map((a) => (
                        <button key={a.id} onClick={() => openAssignment(a.id)}>
                          <div>
                            <strong>{a.jobTitle}</strong>
                            <span>{a.companyName}</span>
                          </div>
                          <div className="work-progress">
                            <b>{assignmentLabels[a.status]}</b>
                          </div>
                        </button>
                      ))
                  : assignments.length > 0 && (
                      <p>
                        Chưa có dự án đang thực hiện. Xem các dự án chờ thống
                        nhất yêu cầu trong Không gian dự án.
                      </p>
                    ))}
            </>
          ) : (
            <>
              <ResourceState value={data.jobs} />
              <div className="jobs-list">
                {jobs &&
                  (role === "Client"
                    ? jobs.filter((j) => j.status === "OPEN")
                    : jobs
                  )
                    .slice(0, 3)
                    .map((j) =>
                      role === "Client" ? (
                        <button
                          key={j.id}
                          className="next-action overview-job-summary"
                          onClick={() => navigate("Quản lý công việc")}
                        >
                          <span>{j.title || "Bản nháp chưa đặt tên"}</span>
                          <b className="status">{jobLabels[j.status]}</b>
                        </button>
                      ) : (
                        renderJob(j)
                      ),
                    )}
              </div>
              {jobs &&
                jobs.length > 0 &&
                role === "Client" &&
                !jobs.some((j) => j.status === "OPEN") && (
                  <p>
                    Chưa có tin đang tuyển. Bạn có thể tạo tin mới hoặc tiếp tục
                    chỉnh sửa bản nháp.
                  </p>
                )}
            </>
          )}
        </section>
        <aside className="panel next-actions">
          <div className="panel-heading">
            <div>
              <h2>Việc cần theo dõi</h2>
              <p>Ưu tiên công việc cần bạn phản hồi.</p>
            </div>
          </div>
          {role === "Admin" ? (
            <p>Thống kê quản trị chi tiết chưa được cung cấp.</p>
          ) : (
            <>
              {role === "Client" && (
                <button
                  className="next-action"
                  onClick={() => navigate("Quản lý công việc")}
                >
                  <span>Tin đang soạn</span>
                  <strong>{count(data.jobs, "DRAFT")}</strong>
                </button>
              )}
              <button
                className="next-action"
                onClick={() =>
                  navigate(
                    role === "Client" ? "Quản lý công việc" : "Đề xuất đã gửi",
                  )
                }
              >
                <span>
                  {role === "Client"
                    ? "Đề xuất cần xem xét"
                    : "Đề xuất chờ phản hồi"}
                </span>
                <strong>{count(data.proposals, "PENDING")}</strong>
              </button>
              <button
                className="next-action"
                onClick={() => navigate("Không gian dự án")}
              >
                <span>Dự án chờ thống nhất yêu cầu</span>
                <strong>{count(data.assignments, "PENDING_SCOPE")}</strong>
              </button>
              <button
                className="next-action"
                onClick={() => navigate("Không gian dự án")}
              >
                <span>Dự án chờ nghiệm thu</span>
                <strong>
                  {count(data.assignments, "AWAITING_ACCEPTANCE")}
                </strong>
              </button>
              <p className="quality-note">
                {assignments
                  ? assignments.length
                    ? "Đã hoàn thành " +
                      assignments.filter((item) => item.status === "COMPLETED")
                        .length +
                      "/" +
                      assignments.length +
                      " dự án."
                    : "Bắt đầu dự án đầu tiên để theo dõi tiến độ."
                  : "Tiến độ sẽ hiển thị sau khi tải được dữ liệu dự án."}
              </p>
              <button
                className="secondary-button"
                onClick={() => navigate("Không gian dự án")}
              >
                Đến không gian dự án
              </button>
            </>
          )}
        </aside>
        {role === "Freelancer" && (
          <section className="panel recent-activity">
            <div className="panel-heading">
              <div>
                <h2>Hoạt động gần đây</h2>
                <p>Những đề xuất gần nhất của bạn</p>
              </div>
            </div>
            <ResourceState value={data.proposals} />
            {proposals
              ?.slice()
              .sort(
                (a, b) => Date.parse(b.submittedAt) - Date.parse(a.submittedAt),
              )
              .slice(0, 3)
              .map((p) => (
                <div className="activity-row" key={p.id}>
                  <div className="activity-icon blue">
                    <FileText />
                  </div>
                  <div>
                    <strong>{p.jobTitle}</strong>
                    <span>
                      {new Date(p.submittedAt).toLocaleDateString("vi-VN")}
                    </span>
                  </div>
                  <b className="status">{proposalLabels[p.status]}</b>
                </div>
              ))}
          </section>
        )}
      </div>
      {[data.jobs, data.proposals, data.assignments]
        .filter((r) => r.state === "error")
        .map((r, i) => (
          <ResourceState key={i} value={r} />
        ))}
    </div>
  );
  return role === "Client"
    ? renderClientOverview()
    : role === "Freelancer"
      ? renderFreelancerOverview()
      : overview;
}
