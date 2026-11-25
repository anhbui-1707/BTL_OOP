import SupportInbox from "./SupportInbox"
import NotificationBell, {
  NotificationPage,
} from "../notifications/Notifications"
import { useEffect, useMemo, useState, type ReactNode } from "react"
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Mail,
  BriefcaseBusiness,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FileText,
  FolderKanban,
  LayoutDashboard,
  Link2,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  UsersRound,
  X,
} from "lucide-react"
import { jobApi, type Job, type JobSummary, type Page } from "../../api/jobs"
import { assignmentsApi, type Assignment } from "../../api/recruitment"
import type { AuthUser } from "../../api/auth"
import AdminRecords, {
  AdminActivities,
  ProjectMilestones,
  adminLabels,
  adminMoney,
} from "./AdminRecords"
import { adminDashboardApi } from "../../api/admin"
import "./admin.css"

export const adminPages = [
  "Tổng quan",
  "Quản lý người dùng",
  "Quản lý Job",
  "Quản lý Proposal",
  "Quản lý dự án",
  "Báo cáo & thống kê",
  "Yêu cầu liên hệ",
]
const icons = [
  LayoutDashboard,
  UsersRound,
  BriefcaseBusiness,
  Send,
  FolderKanban,
  BarChart3,
  Mail,
]
const labels: Record<string, string> = {
  DRAFT: "Bản nháp",
  OPEN: "Đang tuyển",
  ASSIGNED: "Đã giao",
  IN_PROGRESS: "Đang thực hiện",
  COMPLETED: "Hoàn thành",
  CANCELLED: "Đã hủy",
  CLOSED: "Đã đóng",
  PENDING_SCOPE: "Chờ chốt phạm vi",
  ACTIVE: "Đang thực hiện",
  AWAITING_ACCEPTANCE: "Chờ nghiệm thu",
}
const date = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString("vi-VN") : "Chưa có"
const amount = adminMoney
const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .map((s) => s[0])
    .slice(-2)
    .join("")
    .toUpperCase()
const errorText = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "Không thể kết nối máy chủ. Vui lòng thử lại."
type Resource<T,> = {
  data: T[] | null
  loading: boolean
  error: string | null
}
async function allPages<T>(
  load: (page: number) => Promise<Page<T>>,
): Promise<T[]> {
  const first = await load(0)
  const rows = [...first.content]
  for (let page = 1; page < first.totalPages; page++)
    rows.push(...(await load(page)).content)
  if (rows.length !== first.totalElements)
    throw new Error(
      "Dữ liệu đã thay đổi trong lúc tải. Vui lòng làm mới để xem thống kê chính xác.",
    )
  return rows
}
function useResource<T>(
  load: () => Promise<T[]>,
  enabled: boolean,
  revision: number,
): Resource<T> {
  const [state, setState] = useState<Resource<T>>({
    data: null,
    loading: enabled,
    error: null,
  })
  useEffect(() => {
    let active = true
    if (!enabled) {
      setState({ data: null, loading: false, error: null })
      return
    }
    setState({ data: null, loading: true, error: null })
    load()
      .then((data) => {
        if (active) setState({ data, loading: false, error: null })
      })
      .catch((error) => {
        if (active)
          setState({ data: null, loading: false, error: errorText(error) })
      })
    return () => {
      active = false
    }
  }, [enabled, revision, load])
  return state
}
const loadStats = async () => [await adminDashboardApi.stats()]
const loadJobs = () => allPages((page) => jobApi.search({ page, size: 100 }))
const loadProjects = () =>
  allPages((page) => assignmentsApi.list({ page, size: 100 }))
function Badge({ status }: { status: string }) {
  return (
    <span className={`ad-badge ad-status-${status.toLowerCase()}`}>
      <i />
      {labels[status] || status}
    </span>
  )
}
function State({
  title,
  children,
  error = false,
}: {
  title: string
  children?: ReactNode
  error?: boolean
}) {
  return (
    <div
      className={`ad-state ${error ? "ad-error" : ""}`}
      role={error ? "alert" : "status"}
    >
      <span className="ad-state-icon">
        <ShieldCheck size={25} />
      </span>
      <strong>{title}</strong>
      {children && <p>{children}</p>}
    </div>
  )
}
function Panel({
  title,
  icon,
  action,
  children,
}: {
  title: string
  icon: ReactNode
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="ad-panel">
      <div className="ad-panel-head">
        <h2>
          {icon}
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  )
}
function Distribution({
  data,
  empty,
}: {
  data: { label: string ; value: number ; color: string }[]
  empty: string
}) {
  const total = data.reduce((sum, item) => sum + item.value, 0)
  if (!total) return <State title={empty} />
  let offset = 0
  const stops = data
    .map((item) => {
      const start = offset
      offset += (item.value / total) * 100
      return `${item.color} ${start}% ${offset}%`
    })
    .join(",")
  return (
    <div className="ad-distribution">
      <div
        className="ad-donut"
        role="img"
        aria-label={data.map((d) => `${d.label}: ${d.value}`).join(", ")}
        style={{ background: `conic-gradient(${stops})` }}
      >
        <div>
          <strong>{total.toLocaleString("vi-VN")}</strong>
          <span>Tổng cộng</span>
        </div>
      </div>
      <div className="ad-legend">
        {data.map((item) => (
          <div key={item.label}>
            <span>
              <i style={{ background: item.color }} />
              {item.label}
            </span>
            <strong>{Math.round((item.value / total) * 100)}%</strong>
            <small>{item.value.toLocaleString("vi-VN")}</small>
          </div>
        ))}
      </div>
    </div>
  )
}
function Trend({ jobs }: { jobs: JobSummary[] }) {
  const days = useMemo(() => {
    const now = new Date()
    return Array.from({ length: 30 }, (_, index) => {
      const day = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - 29 + index,
      )
      return {
        label: day.toLocaleDateString("vi-VN", {
          day: "2-digit",
          month: "2-digit",
        }),
        count: jobs.filter(
          (job) =>
            new Date(job.createdAt).toDateString() === day.toDateString(),
        ).length,
      }
    })
  }, [jobs])
  const [selected, setSelected] = useState<number | null>(null)
  if (!days.some((day) => day.count))
    return (
      <State title="Chưa có Job mới trong 30 ngày qua">
        Job mới sẽ xuất hiện trên biểu đồ khi được đăng.
      </State>
    )
  const max = Math.max(4, ...days.map((day) => day.count))
  const points = days
    .map((day, i) => `${40 + (i * 500) / 29},${170 - (day.count / max) * 140}`)
    .join(" ")
  return (
    <div className="ad-trend">
      <div className="ad-chart-caption" aria-live="polite">
        {selected === null
          ? `${days.reduce((sum, day) => sum + day.count, 0)} Job mới trong 30 ngày qua`
          : `${days[selected].label}: ${days[selected].count} Job mới`}
      </div>
      <svg
        viewBox="0 0 565 205"
        role="img"
        aria-label="Số Job được tạo mỗi ngày trong 30 ngày qua"
      >
        <defs>
          <linearGradient id="admin-job-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#00b14f" stopOpacity=".22" />
            <stop offset="100%" stopColor="#00b14f" stopOpacity=".02" />
          </linearGradient>
        </defs>
        {[0, 1, 2, 3, 4].map((i) => (
          <g key={i}>
            <line
              x1="40"
              y1={170 - i * 35}
              x2="540"
              y2={170 - i * 35}
              stroke="var(--ad-border)"
            />
            <text x="28" y={174 - i * 35} textAnchor="end">
              {Math.round((max * i) / 4)}
            </text>
          </g>
        ))}
        <polygon
          points={`40,170 ${points} 540,170`}
          fill="url(#admin-job-area)"
        />
        <polyline
          points={points}
          fill="none"
          stroke="#00a94f"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        {days.map((day, i) => (
          <g key={i}>
            {i % 6 === 0 || i === 29 ? (
              <text x={40 + (i * 500) / 29} y="195" textAnchor="middle">
                {day.label}
              </text>
            ) : null}
            <circle
              cx={40 + (i * 500) / 29}
              cy={170 - (day.count / max) * 140}
              r="6"
              fill="transparent"
              tabIndex={0}
              aria-label={`${day.label}: ${day.count} Job`}
              onFocus={() => setSelected(i)}
              onBlur={() => setSelected(null)}
              onMouseEnter={() => setSelected(i)}
              onMouseLeave={() => setSelected(null)}
            >
              <title>
                {day.label}: {day.count} Job
              </title>
            </circle>
          </g>
        ))}
      </svg>
    </div>
  )
}
function RecordDetail({
  type,
  id,
  back,
}: {
  type: "job" | "project"
  id: number
  back: () => void
}) {
  const [value, setValue] = useState<Job | Assignment | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    let active = true
    setValue(null)
    setError(null)
    ;(type === "job" ? jobApi.detail(id) : assignmentsApi.detail(id))
      .then((record) => {
        if (active) setValue(record)
      })
      .catch((e) => {
        if (active) setError(errorText(e))
      })
    return () => {
      active = false
    }
  }, [id, type, retry])
  return (
    <>
      <button className="ad-back" onClick={back}>
        <ArrowLeft size={16} />
        Quay lại danh sách
      </button>
      {error ? (
        <>
          <State title="Không thể tải chi tiết" error>
            {error}
          </State>
          <button
            className="ad-button"
            onClick={() => setRetry((value) => value + 1)}
          >
            <RefreshCw size={15} />
            Thử lại
          </button>
        </>
      ) : !value ? (
        <div className="ad-skeleton" aria-label="Đang tải chi tiết" />
      ) : (
        <>
          <div className="ad-detail-title">
            <span>
              {type === "job" ? "JOB" : "DỰ ÁN"} / #{value.id}
            </span>
            <h1>{"title" in value ? value.title : value.jobTitle}</h1>
            <Badge status={value.status} />
          </div>
          <section className="ad-panel ad-detail">
            <dl>
              <div>
                <dt>Client</dt>
                <dd>{value.companyName || `Client #${value.clientId}`}</dd>
              </div>
              <div>
                <dt>
                  Ngân sách {"agreedBudget" in value ? "thống nhất" : "dự kiến"}
                </dt>
                <dd>
                  {"agreedBudget" in value
                    ? amount(value.agreedBudget, value.currencyCode)
                    : `${amount(value.budgetMin, value.currencyCode)} – ${amount(value.budgetMax, value.currencyCode)}`}
                </dd>
              </div>
              <div>
                <dt>Ngày tạo</dt>
                <dd>{date(value.createdAt)}</dd>
              </div>
              {"freelancerName" in value && (
                <>
                  <div>
                    <dt>Freelancer</dt>
                    <dd>{value.freelancerName}</dd>
                  </div>
                  <div>
                    <dt>Bắt đầu</dt>
                    <dd>{date(value.startedAt)}</dd>
                  </div>
                  <div>
                    <dt>Hoàn thành</dt>
                    <dd>{date(value.completedAt)}</dd>
                  </div>
                </>
              )}
              {"deadline" in value && (
                <div>
                  <dt>Hạn hoàn thành</dt>
                  <dd>{date(value.deadline)}</dd>
                </div>
              )}
            </dl>
            {"description" in value ? (
              <div className="ad-description">
                {[
                  ["Mô tả công việc", value.description],
                  ["Sản phẩm bàn giao", value.deliverables],
                  ["Tiêu chí nghiệm thu", value.acceptanceCriteria],
                ].map(([title, content]) => (
                  <section key={title}>
                    <h2>{title}</h2>
                    <p>{content || "Chưa có thông tin"}</p>
                  </section>
                ))}
                <h2>Kỹ năng yêu cầu</h2>
                <div className="ad-tags">
                  {value.skills.map((skill) => (
                    <span key={skill.skillId}>{skill.name}</span>
                  ))}
                </div>
              </div>
            ) : (
              <ProjectMilestones id={value.id} currency={value.currencyCode} />
            )}
          </section>
        </>
      )}
    </>
  )
}

export default function AdminDashboard({
  page,
  navigate,
  onPublic,
  onLogout,

  theme,
  toggleTheme,
  user,

  settings,
}: {
  page: string
  navigate: (page: string) => void
  onPublic: () => void
  onLogout: () => void

  theme: "light" | "dark"
  toggleTheme: () => void
  user: AuthUser | null

  settings: ReactNode
}) {
  const [mobile, setMobile] = useState(false)
  const [collapsed, setCollapsed] = useState(
    () => sessionStorage.getItem("itlink-admin-sidebar-collapsed") === "true",
  )
  useEffect(
    () =>
      sessionStorage.setItem(
        "itlink-admin-sidebar-collapsed",
        String(collapsed),
      ),
    [collapsed],
  )
  const [accountOpen, setAccountOpen] = useState(false)
  const [revision, setRevision] = useState(0)
  const [query, setQuery] = useState("")
  const [reportView, setReportView] = useState(() =>
    new URLSearchParams(window.location.hash.split("?")[1] || "").get(
      "view",
    ) === "activity"
      ? "activity"
      : "stats",
  )
  const [status, setStatus] = useState("")
  const [current, setCurrent] = useState(0)
  const readId = () => {
    const raw = new URLSearchParams(
      window.location.hash.split("?")[1] || "",
    ).get("record")
    return raw &&
      /^\d+$/.test(raw) &&
      Number.isSafeInteger(Number(raw)) &&
      Number(raw) > 0
      ? Number(raw)
      : null
  }
  const [recordId, setRecordId] = useState<number | null>(readId)
  useEffect(() => {
    const sync = () => {
      setRecordId(readId())
      setReportView(
        new URLSearchParams(window.location.hash.split("?")[1] || "").get(
          "view",
        ) === "activity"
          ? "activity"
          : "stats",
      )
      setStatus(
        new URLSearchParams(window.location.hash.split("?")[1] || "").get(
          "status",
        ) || "",
      )
    }
    window.addEventListener("hashchange", sync)
    window.addEventListener("popstate", sync)
    return () => {
      window.removeEventListener("hashchange", sync)
      window.removeEventListener("popstate", sync)
    }
  }, [])
  useEffect(() => {
    setQuery("")
    setReportView(
      new URLSearchParams(window.location.hash.split("?")[1] || "").get(
        "view",
      ) === "activity"
        ? "activity"
        : "stats",
    )
    setStatus(
      new URLSearchParams(window.location.hash.split("?")[1] || "").get(
        "status",
      ) || "",
    )
    setCurrent(0)
    setMobile(false)
    setRecordId(readId())
  }, [page])
  useEffect(() => {
    setCurrent(0)
  }, [query, status])
  useEffect(() => {
    if (!mobile && !accountOpen) return
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobile(false)
        setAccountOpen(false)
      }
    }
    window.addEventListener("keydown", escape)
    return () => window.removeEventListener("keydown", escape)
  }, [mobile, accountOpen])
  const authorized = !!user?.roles.includes("ADMIN")
  const jobs = useResource(
    loadJobs,
    authorized && ["Tổng quan", "Quản lý Job"].includes(page),
    revision,
  )
  const projects = useResource(
    loadProjects,
    authorized && ["Tổng quan", "Quản lý dự án"].includes(page),
    revision,
  )
  const summary = useResource(
    loadStats,
    authorized && ["Tổng quan", "Báo cáo & thống kê"].includes(page),
    revision,
  )
  const stats = summary.data?.[0]
  const refresh = () => setRevision((value) => value + 1)
  const changeReport = (view: string) => {
    const params = new URLSearchParams()
    params.set("view", view)
    window.history.pushState(
      null,
      "",
      `#/dashboard/${encodeURIComponent("Báo cáo & thống kê")}?${params}`,
    )
    setReportView(view)
  }
  const counted = (values?: Record<string, number>) => {
    const order = [
      "FREELANCER",
      "CLIENT",
      "ADMIN",
      "UNASSIGNED",
      "DRAFT",
      "OPEN",
      "ASSIGNED",
      "PENDING_SCOPE",
      "ACTIVE",
      "IN_PROGRESS",
      "AWAITING_ACCEPTANCE",
      "PENDING",
      "ACCEPTED",
      "COMPLETED",
      "REJECTED",
      "WITHDRAWN",
      "CLOSED",
      "CANCELLED",
    ]
    const colors: Record<string, string> = {
      FREELANCER: "#00a94f",
      CLIENT: "#77d69c",
      ADMIN: "#d5dce5",
      OPEN: "#00a94f",
      ACTIVE: "#00a94f",
      IN_PROGRESS: "#00a94f",
      ACCEPTED: "#77d69c",
      COMPLETED: "#77d69c",
      PENDING: "#e4b96b",
      PENDING_SCOPE: "#e4b96b",
      AWAITING_ACCEPTANCE: "#e4b96b",
    }
    return Object.entries(values || {})
      .sort(([a], [b]) => order.indexOf(a) - order.indexOf(b))
      .map(([key, value]) => ({
        label: labels[key] || adminLabels[key] || key,
        value,
        color: colors[key] || "#a0afbf",
      }))
  }
  const go = (target: string, id?: number, filter?: string, view?: string) => {
    const params = new URLSearchParams()
    if (id) params.set("record", String(id))
    if (filter) params.set("status", filter)
    if (view) params.set("view", view)
    if (target === "Báo cáo & thống kê")
      setReportView(view === "activity" ? "activity" : "stats")
    const hash = `#/dashboard/${encodeURIComponent(target)}${
      params.size ? `?${params}` : ""
    }`
    if (window.location.hash !== hash) window.history.pushState(null, "", hash)
    setRecordId(id || null)
    setStatus(filter || "")
    setMobile(false)
    navigate(target)
  }
  const openRecord = (id: number | null) => {
    const base = window.location.hash.split("?")[0]
    window.history.pushState(null, "", `${base}${id ? `?record=${id}` : ""}`)
    setRecordId(id)
  }
  const isJobs = page === "Quản lý Job"
  const isProjects = page === "Quản lý dự án"
  const selectedResource = isProjects ? projects : jobs
  const filtered = (isProjects ? projects.data || [] : jobs.data || []).filter(
    (row) =>
      (!status || row.status === status) &&
      `${
        "title" in row ? row.title : row.jobTitle
      } ${row.companyName || ""} ${row.clientId} ${
        "freelancerName" in row ? row.freelancerName : ""
      }`
        .toLocaleLowerCase("vi-VN")
        .includes(query.trim().toLocaleLowerCase("vi-VN")),
  )
  const pageCount = Math.max(1, Math.ceil(filtered.length / 10))
  const safePage = Math.min(current, pageCount - 1)
  const resourceContent = (resource: Resource<unknown>, children: ReactNode) =>
    resource.loading ? (
      <div className="ad-skeleton" aria-label="Đang tải dữ liệu" />
    ) : resource.error ? (
      <State title="Không thể tải dữ liệu" error>
        {resource.error}
      </State>
    ) : (
      children
    )
  const fullName = user?.fullName || "Admin"
  const link = (target: string) => (
    <button className="ad-text-button" onClick={() => go(target)}>
      Xem tất cả <ArrowRight size={15} />
    </button>
  )
  return (
    <div className={`ad-shell ${collapsed ? "ad-sidebar-collapsed" : ""}`}>
      {mobile && (
        <button
          className="ad-nav-overlay"
          aria-label="Đóng điều hướng"
          onClick={() => setMobile(false)}
        />
      )}
      <aside
        className={`ad-sidebar ${mobile ? "ad-sidebar-open" : ""}`}
        aria-label="Điều hướng quản trị"
      >
        <div className="ad-brand-row">
          <button
            className="ad-brand"
            onClick={() => go("Tổng quan")}
            aria-label="LinkIT — Tổng quan"
            title="LinkIT"
          >
            <img
              className="ad-brand-wordmark"
              src="/linkit-figma-exact.png"
              alt="LinkIT"
            />
            <span className="ad-brand-compact" aria-hidden="true">
              <Link2 size={22} />
            </span>
          </button>
          <button
            type="button"
            className="ad-collapse-toggle"
            onClick={() => setCollapsed((value) => !value)}
            aria-label={collapsed ? "Mở rộng sidebar" : "Thu gọn sidebar"}
            aria-expanded={!collapsed}
            title={collapsed ? "Mở rộng sidebar" : "Thu gọn sidebar"}
          >
            {collapsed ? (
              <PanelLeftOpen size={18} />
            ) : (
              <PanelLeftClose size={18} />
            )}
          </button>
        </div>
        <nav>
          {adminPages.map((item, i) => {
            const Icon = icons[i]
            return (
              <button
                key={item}
                className={page === item ? "ad-nav-active" : ""}
                onClick={() => go(item)}
                aria-current={page === item ? "page" : undefined}
              >
                <Icon size={20} />
                <span>{item}</span>
              </button>
            )
          })}
        </nav>
        <div className="ad-sidebar-bottom">
          <span className="ad-avatar">{initials(fullName)}</span>
          <div>
            <strong>{fullName}</strong>
            <small>Quản trị hệ thống</small>
          </div>
          <ShieldCheck size={17} />
        </div>
      </aside>
      <div className="ad-body">
        <header className="ad-topbar">
          <button
            className="ad-icon-button ad-mobile-toggle"
            aria-label="Mở điều hướng"
            aria-expanded={mobile}
            onClick={() => setMobile(!mobile)}
          >
            {mobile ? <X /> : <Menu />}
          </button>
          {(isJobs || isProjects) && !recordId ? (
            <label className="ad-search">
              <Search size={19} />
              <input
                aria-label="Tìm kiếm danh sách"
                placeholder={
                  isJobs ? "Tìm Job, Client…" : "Tìm dự án, Client, Freelancer…"
                }
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {query && (
                <button aria-label="Xóa tìm kiếm" onClick={() => setQuery("")}>
                  <X size={15} />
                </button>
              )}
            </label>
          ) : (
            <span className="ad-topbar-context">
              <ShieldCheck size={17} />
              Không gian quản trị
            </span>
          )}
          <div className="ad-topbar-actions">
            <NotificationBell user={user} navigate={navigate} />

            <button className="ad-website" onClick={onPublic}>
              Xem website <ExternalLink size={14} />
            </button>
            <div
              className="ad-account"
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node))
                  setAccountOpen(false)
              }}
            >
              <button
                className="ad-account-trigger"
                onClick={() => setAccountOpen(!accountOpen)}
                aria-expanded={accountOpen}
              >
                <span className="ad-avatar">{initials(fullName)}</span>
                <strong>Admin</strong>
                <ChevronDown size={15} />
              </button>
              {accountOpen && (
                <div className="ad-account-menu">
                  <span>{fullName}</span>
                  <button
                    onClick={() => {
                      go("Cài đặt tài khoản")
                      setAccountOpen(false)
                    }}
                  >
                    Cài đặt tài khoản
                  </button>
                  <button onClick={onLogout}>
                    <LogOut size={15} />
                    Đăng xuất
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        <main className="ad-main">
          {authorized && recordId && (isJobs || isProjects) ? (
            <RecordDetail
              key={`${page}-${recordId}`}
              type={isJobs ? "job" : "project"}
              id={recordId}
              back={() => openRecord(null)}
            />
          ) : page === "Cài đặt tài khoản" ? (
            settings
          ) : (
            <>
              <div className="ad-page-heading">
                <div>
                  <h1>{page === "Tổng quan" ? "Tổng quan hệ thống" : page}</h1>
                  <p>
                    {page === "Tổng quan"
                      ? "Theo dõi hoạt động và tình hình chung của LinkIT."
                      : page === "Báo cáo & thống kê"
                        ? "Theo dõi cơ cấu công việc và tình hình triển khai dự án."
                        : "Theo dõi và tra cứu thông tin trên nền tảng LinkIT."}
                  </p>
                </div>
                {page !== "Thông báo" && (
                  <button
                    className="ad-button"
                    disabled={
                      jobs.loading ||
                      projects.loading ||
                      summary.loading ||
                      !authorized
                    }
                    onClick={refresh}
                  >
                    <RefreshCw
                      size={15}
                      className={
                        jobs.loading || projects.loading || summary.loading
                          ? "ad-spin"
                          : ""
                      }
                    />
                    Làm mới
                  </button>
                )}
              </div>

              {page === "Yêu cầu liên hệ" ? (
                <SupportInbox />
              ) : page === "Thông báo" ? (
                <NotificationPage user={user} navigate={navigate} />
              ) : page === "Tổng quan" ? (
                <>
                  <div className="ad-kpis">
                    {[
                      {
                        label: "Tổng người dùng",
                        icon: UsersRound,
                        value: stats?.totalUsers,
                        note: summary.loading
                          ? "Đang tải…"
                          : summary.error
                            ? "Không thể tải"
                            : "Tất cả tài khoản",
                      },
                      {
                        label: "Tổng Job",
                        icon: BriefcaseBusiness,
                        value: stats?.totalJobs,
                        note: "Toàn bộ công việc",
                      },
                      {
                        label: "Tổng Proposal",
                        icon: Send,
                        value: stats?.totalProposals,
                        note: "Toàn bộ đề xuất",
                      },
                      {
                        label: "Dự án đang thực hiện",
                        icon: FolderKanban,
                        value: stats?.activeProjects,
                        note: "Trạng thái đang thực hiện",
                      },
                    ].map(({ label, icon: Icon, value, note }) => (
                      <section className="ad-kpi" key={label}>
                        <span className="ad-kpi-icon">
                          <Icon size={28} strokeWidth={1.7} />
                        </span>
                        <div>
                          <span>{label}</span>
                          <strong>
                            {value == null
                              ? "—"
                              : value.toLocaleString("vi-VN")}
                          </strong>
                          <small>{note}</small>
                        </div>
                      </section>
                    ))}
                  </div>
                  {summary.error && (
                    <div className="ad-inline-error" role="alert">
                      Không thể tải thống kê: {summary.error}
                    </div>
                  )}
                  <div className="ad-overview-grid">
                    <Panel
                      title="Theo dõi dự án"
                      icon={<FolderKanban />}
                      action={link("Quản lý dự án")}
                    >
                      {resourceContent(
                        projects,
                        <div className="ad-task-list">
                          {[
                            {
                              key: "PENDING_SCOPE",
                              title: "Dự án chờ chốt phạm vi",
                              desc: "Hai bên cần thống nhất phạm vi công việc.",
                            },
                            {
                              key: "AWAITING_ACCEPTANCE",
                              title: "Dự án chờ nghiệm thu",
                              desc: "Chờ Client xác nhận kết quả bàn giao.",
                            },
                            {
                              key: "ACTIVE",
                              title: "Dự án đang thực hiện",
                              desc: "Theo dõi các dự án đang triển khai.",
                            },
                          ].map((item) => (
                            <button
                              key={item.key}
                              onClick={() => {
                                go("Quản lý dự án", undefined, item.key)
                              }}
                            >
                              <span className="ad-task-icon">
                                <FileText size={20} />
                              </span>
                              <span>
                                <strong>{item.title}</strong>
                                <small>{item.desc}</small>
                              </span>
                              <b>
                                {projects.data
                                  ? projects.data.filter(
                                      (row) => row.status === item.key,
                                    ).length
                                  : "—"}
                              </b>
                              <ChevronRight size={17} />
                            </button>
                          ))}
                        </div>,
                      )}
                    </Panel>
                    <Panel
                      title="Thống kê nhanh"
                      icon={<BarChart3 />}
                      action={<span className="ad-mini-label">Người dùng</span>}
                    >
                      {resourceContent(
                        summary,
                        <Distribution
                          data={counted(stats?.usersByRole)}
                          empty="Chưa có người dùng để thống kê"
                        />,
                      )}
                    </Panel>
                    <Panel
                      title="Hoạt động gần đây"
                      icon={<Activity />}
                      action={
                        <button
                          className="ad-text-button"
                          onClick={() =>
                            go(
                              "Báo cáo & thống kê",
                              undefined,
                              undefined,
                              "activity",
                            )
                          }
                        >
                          Xem tất cả <ArrowRight size={15} />
                        </button>
                      }
                    >
                      <AdminActivities
                        enabled={authorized}
                        revision={revision}
                        compact
                      />
                    </Panel>
                    <Panel
                      title="Xu hướng Job (30 ngày qua)"
                      icon={<Activity />}
                    >
                      {resourceContent(jobs, <Trend jobs={jobs.data || []} />)}
                    </Panel>
                  </div>
                </>
              ) : page === "Quản lý người dùng" ||
                page === "Quản lý Proposal" ? (
                <AdminRecords
                  key={page}
                  kind={page === "Quản lý người dùng" ? "users" : "proposals"}
                  enabled={authorized}
                  revision={revision}
                  changed={refresh}
                  actorId={user?.id}
                  initialId={recordId ?? undefined}
                />
              ) : page === "Báo cáo & thống kê" ? (
                <>
                  <div
                    className="ad-report-tabs"
                    role="group"
                    aria-label="Loại báo cáo"
                  >
                    <button
                      aria-pressed={reportView === "stats"}
                      onClick={() => changeReport("stats")}
                    >
                      Thống kê tổng hợp
                    </button>
                    <button
                      aria-pressed={reportView === "activity"}
                      onClick={() => changeReport("activity")}
                    >
                      Nhật ký hoạt động
                    </button>
                  </div>
                  {reportView === "activity" ? (
                    <AdminActivities enabled={authorized} revision={revision} />
                  ) : (
                    <>
                      <div className="ad-overview-grid">
                        <Panel
                          title="Người dùng theo vai trò"
                          icon={<UsersRound />}
                        >
                          {resourceContent(
                            summary,
                            <Distribution
                              data={counted(stats?.usersByRole)}
                              empty="Chưa có người dùng"
                            />,
                          )}
                        </Panel>
                        <Panel
                          title="Job theo trạng thái"
                          icon={<BriefcaseBusiness />}
                        >
                          {resourceContent(
                            summary,
                            <Distribution
                              data={counted(stats?.jobsByStatus)}
                              empty="Chưa có Job"
                            />,
                          )}
                        </Panel>
                        <Panel title="Proposal theo trạng thái" icon={<Send />}>
                          {resourceContent(
                            summary,
                            <Distribution
                              data={counted(stats?.proposalsByStatus)}
                              empty="Chưa có Proposal"
                            />,
                          )}
                        </Panel>
                        <Panel
                          title="Dự án theo trạng thái"
                          icon={<FolderKanban />}
                        >
                          {resourceContent(
                            summary,
                            <Distribution
                              data={counted(stats?.projectsByStatus)}
                              empty="Chưa có dự án"
                            />,
                          )}
                        </Panel>
                      </div>
                      <p className="ad-report-footnote">
                        Mỗi tài khoản được tính một lần theo vai trò ưu tiên
                        Admin → Client → Freelancer. Tiến độ dự án được tính từ
                        milestone đã duyệt.
                      </p>
                    </>
                  )}
                </>
              ) : (
                (isJobs || isProjects) && (
                  <section className="ad-panel ad-data-panel">
                    <div className="ad-table-toolbar">
                      <div>
                        <strong>
                          {isJobs ? "Danh sách Job" : "Danh sách dự án"}
                        </strong>
                        <span>
                          {selectedResource.data
                            ? `${filtered.length.toLocaleString("vi-VN")} kết quả`
                            : "Chưa có dữ liệu"}
                        </span>
                      </div>
                      <label>
                        <span className="ad-sr-only">Lọc trạng thái</span>
                        <select
                          value={status}
                          onChange={(e) => setStatus(e.target.value)}
                        >
                          <option value="">Tất cả trạng thái</option>
                          {(isJobs
                            ? [
                                "DRAFT",
                                "OPEN",
                                "ASSIGNED",
                                "IN_PROGRESS",
                                "COMPLETED",
                                "CLOSED",
                                "CANCELLED",
                              ]
                            : [
                                "PENDING_SCOPE",
                                "ACTIVE",
                                "AWAITING_ACCEPTANCE",
                                "COMPLETED",
                                "CANCELLED",
                              ]
                          ).map((key) => (
                            <option key={key} value={key}>
                              {labels[key]}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    {resourceContent(
                      selectedResource,
                      filtered.length ? (
                        <>
                          <div className="ad-table-scroll">
                            <table>
                              <thead>
                                <tr>
                                  <th>{isJobs ? "Tên Job" : "Tên dự án"}</th>
                                  <th>Client</th>
                                  <th>{isJobs ? "Ngân sách" : "Freelancer"}</th>
                                  <th>Ngày tạo</th>
                                  <th>Trạng thái</th>
                                  <th>
                                    <span className="ad-sr-only">Thao tác</span>
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {filtered
                                  .slice(safePage * 10, safePage * 10 + 10)
                                  .map((row) => (
                                    <tr key={row.id}>
                                      <td>
                                        <button
                                          className="ad-record-link"
                                          onClick={() => openRecord(row.id)}
                                        >
                                          {"title" in row
                                            ? row.title
                                            : row.jobTitle}
                                        </button>
                                        <small>#{row.id}</small>
                                      </td>
                                      <td>
                                        {row.companyName ||
                                          `Client #${row.clientId}`}
                                      </td>
                                      <td>
                                        {"budgetMin" in row ? (
                                          <span className="ad-money">
                                            {amount(
                                              row.budgetMin,
                                              row.currencyCode,
                                            )}
                                            <small>
                                              đến{" "}
                                              {amount(
                                                row.budgetMax,
                                                row.currencyCode,
                                              )}
                                            </small>
                                          </span>
                                        ) : (
                                          row.freelancerName
                                        )}
                                      </td>
                                      <td className="ad-nowrap">
                                        {date(row.createdAt)}
                                      </td>
                                      <td>
                                        <Badge status={row.status} />
                                      </td>
                                      <td>
                                        <button
                                          className="ad-view"
                                          aria-label={`Xem chi tiết #${row.id}`}
                                          onClick={() => openRecord(row.id)}
                                        >
                                          Xem
                                          <ChevronRight size={14} />
                                        </button>
                                      </td>
                                    </tr>
                                  ))}
                              </tbody>
                            </table>
                          </div>
                          <div className="ad-pagination">
                            <span>
                              Hiển thị {safePage * 10 + 1}–
                              {Math.min((safePage + 1) * 10, filtered.length)} /{" "}
                              {filtered.length}
                            </span>
                            <div>
                              <button
                                aria-label="Trang trước"
                                disabled={safePage === 0}
                                onClick={() => setCurrent(safePage - 1)}
                              >
                                <ChevronLeft size={16} />
                              </button>
                              <span>
                                Trang {safePage + 1} / {pageCount}
                              </span>
                              <button
                                aria-label="Trang sau"
                                disabled={safePage + 1 >= pageCount}
                                onClick={() => setCurrent(safePage + 1)}
                              >
                                <ChevronRight size={16} />
                              </button>
                            </div>
                          </div>
                        </>
                      ) : (
                        <State
                          title={
                            query || status
                              ? "Không tìm thấy kết quả phù hợp"
                              : isJobs
                                ? "Chưa có Job nào"
                                : "Chưa có dự án nào"
                          }
                        >
                          {query || status
                            ? "Thử thay đổi từ khóa hoặc bộ lọc trạng thái."
                            : "Dữ liệu sẽ xuất hiện khi có hoạt động trên nền tảng."}
                        </State>
                      ),
                    )}
                  </section>
                )
              )}
            </>
          )}
        </main>
        <div className="ad-page-footer">
          <span>LinkIT · Không gian quản trị</span>
          <span>
            <ShieldCheck size={13} />
            Chế độ giám sát
          </span>
        </div>
      </div>
    </div>
  )
}
