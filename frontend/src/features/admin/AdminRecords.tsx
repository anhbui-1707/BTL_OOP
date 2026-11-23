import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import {
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import {
  adminDashboardApi,
  type AdminUser,
  type AdminProposal,
  type AdminProposalDetail,
  type AdminActivity,
} from "../../api/admin";
import type { Page } from "../../api/jobs";
import { resolveAvatarUrl } from "../../api/platform";
import { milestonesApi, type Milestone } from "../../api/workspace";

export const adminLabels: Record<string, string> = {
  CLIENT: "Client",
  FREELANCER: "Freelancer",
  ADMIN: "Admin",
  UNASSIGNED: "Chưa có vai trò",
  ACTIVE: "Đang hoạt động",
  LOCKED: "Đã khóa",
  DISABLED: "Vô hiệu hóa",
  PENDING: "Chờ phản hồi",
  ACCEPTED: "Đã chấp nhận",
  REJECTED: "Đã từ chối",
  WITHDRAWN: "Đã rút",
  PLANNED: "Đã lên kế hoạch",
  IN_PROGRESS: "Đang thực hiện",
  SUBMITTED: "Đã nộp",
  REVISION_REQUIRED: "Cần chỉnh sửa",
  APPROVED: "Đã duyệt",
  CANCELLED: "Đã hủy",
};
const actions: Record<string, string> = {
  ADMIN_USER_LOCKED: "Khóa tài khoản",
  ADMIN_USER_UNLOCKED: "Mở khóa tài khoản",
  USER_REGISTERED: "Đăng ký tài khoản",
  AUTH_LOGIN: "Đăng nhập",
  AUTH_LOGOUT: "Đăng xuất",
  TOKEN_REFRESHED: "Làm mới phiên",
  JOB_CREATED: "Tạo Job",
  JOB_UPDATED: "Cập nhật Job",
  JOB_PUBLISHED: "Đăng tuyển",
  JOB_CANCELLED: "Hủy Job",
  PROPOSAL_SUBMITTED: "Gửi Proposal",
  PROPOSAL_ACCEPTED: "Chọn Freelancer",
  PROPOSAL_REJECTED_AFTER_SELECTION: "Từ chối sau khi chọn ứng viên",
  JOB_ASSIGNED: "Giao Job",
  ASSIGNMENT_CREATED: "Tạo dự án",
  PROPOSAL_REJECTED: "Từ chối Proposal",
  PROPOSAL_WITHDRAWN: "Rút Proposal",
  MILESTONE_CREATED: "Tạo milestone",
  MILESTONE_UPDATED: "Cập nhật milestone",
  MILESTONE_SUBMITTED: "Nộp milestone",
  MILESTONE_APPROVED: "Duyệt milestone",
  SCOPE_LOCKED: "Chốt phạm vi",
  FINAL_ACCEPTANCE_CREATED: "Nghiệm thu dự án",
  ASSIGNMENT_COMPLETED: "Hoàn thành dự án",
  JOB_COMPLETED: "Hoàn thành Job",
  MILESTONE_CANCELLED: "Hủy milestone",
  MILESTONE_REVISION_REQUIRED: "Yêu cầu sửa milestone",
  SCOPE_CREATED: "Tạo phạm vi",
  SCOPE_SUBMITTED: "Gửi phạm vi để duyệt",
  SCOPE_APPROVED: "Duyệt phạm vi",
  SCOPE_SUPERSEDED: "Thay phiên bản phạm vi",
};
const stamp = (value: string) => new Date(value).toLocaleString("vi-VN");
const day = (value: string) => new Date(value).toLocaleDateString("vi-VN");
const message = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "Không thể tải dữ liệu. Vui lòng thử lại.";

export function adminMoney(value: number | string, currency: string): string {
  const [whole, decimal] = String(value).split(".");
  return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ".")}${decimal && /[1-9]/.test(decimal) ? `,${decimal}` : ""} ${currency}`;
}
export function AdminBadge({ status }: { status: string }) {
  return (
    <span className={`ad-badge ad-status-${status.toLowerCase()}`}>
      <i />
      {adminLabels[status] || status}
    </span>
  );
}
function Feedback({
  loading,
  error,
  empty,
  retry,
}: {
  loading?: boolean;
  error?: string | null;
  empty?: string;
  retry?: () => void;
}) {
  return loading ? (
    <div className="ad-skeleton" role="status" aria-label="Đang tải dữ liệu" />
  ) : (
    <div className="ad-state" role={error ? "alert" : "status"}>
      <span className="ad-state-icon">
        <ShieldCheck size={25} />
      </span>
      <strong>
        {error ? "Không thể tải dữ liệu" : empty || "Chưa có dữ liệu"}
      </strong>
      {error && <p>{error}</p>}
      {retry && error && (
        <button className="ad-button" onClick={retry}>
          <RefreshCw size={15} />
          Thử lại
        </button>
      )}
    </div>
  );
}
function usePage<T>(
  load: (
    keyword: string,
    status: string,
    role: string,
    page: number,
  ) => Promise<Page<T>>,
  enabled: boolean,
  keyword: string,
  status: string,
  role: string,
  page: number,
  revision: number,
) {
  const [result, setResult] = useState<Page<T> | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    setResult(null);
    setError(null);
    setLoading(enabled);
    if (!enabled) return;
    const timer = window.setTimeout(() => {
      load(keyword, status, role, page)
        .then((data) => {
          if (active) {
            setResult(data);
            setLoading(false);
          }
        })
        .catch((e) => {
          if (active) {
            setError(message(e));
            setLoading(false);
          }
        });
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [load, enabled, keyword, status, role, page, revision]);
  return { result, loading, error };
}
function Pagination({
  page,
  data,
  change,
}: {
  page: number;
  data: { totalPages: number; totalElements: number; size: number };
  change: (page: number) => void;
}) {
  return (
    <div className="ad-pagination">
      <span>
        {data.totalElements
          ? `${page * data.size + 1}–${Math.min((page + 1) * data.size, data.totalElements)} / ${data.totalElements}`
          : "0 kết quả"}
      </span>
      <div>
        <button
          aria-label="Trang trước"
          disabled={page === 0}
          onClick={() => change(page - 1)}
        >
          <ChevronLeft size={16} />
        </button>
        <span>
          Trang {page + 1} / {Math.max(1, data.totalPages)}
        </span>
        <button
          aria-label="Trang sau"
          disabled={page + 1 >= data.totalPages}
          onClick={() => change(page + 1)}
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
function Modal({
  title,
  close,
  busy = false,
  children,
}: {
  title: string;
  close: () => void;
  busy?: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const previous =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const previousOverflow = document.body.style.overflow;
    const dialog = ref.current;
    dialog?.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      dialog?.close();
      document.body.style.overflow = previousOverflow;
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  return (
    <dialog
      className="ad-dialog"
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) close();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) {
          const box = event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < box.left ||
            event.clientX > box.right ||
            event.clientY < box.top ||
            event.clientY > box.bottom
          )
            close();
        }
      }}
    >
      <div className="ad-dialog-head">
        <div>
          <small>LINKIT · QUẢN TRỊ</small>
          <h2 id={titleId}>{title}</h2>
        </div>
        <button
          className="ad-icon-button"
          disabled={busy}
          aria-label="Đóng chi tiết"
          onClick={close}
        >
          <X size={18} />
        </button>
      </div>
      <div className="ad-dialog-content">{children}</div>
    </dialog>
  );
}
function UserDialog({
  id,
  close,
  changed,
  actorId,
}: {
  id: number;
  close: () => void;
  changed: () => void;
  actorId?: number;
}) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const flight = useRef(false);
  const [confirm, setConfirm] = useState(false);
  const [success, setSuccess] = useState("");
  useEffect(() => {
    let active = true;
    setUser(null);
    setError(null);
    adminDashboardApi
      .user(id)
      .then((data) => {
        if (active) setUser(data);
      })
      .catch((e) => {
        if (active) setError(message(e));
      });
    return () => {
      active = false;
    };
  }, [id, revision]);
  const changeStatus = async () => {
    if (!user || flight.current) return;
    flight.current = true;
    setBusy(true);
    setError(null);
    setSuccess("");
    try {
      const updated = await adminDashboardApi.setLocked(
        user,
        user.status === "ACTIVE",
      );
      setUser(updated);
      setConfirm(false);
      setSuccess(
        updated.status === "LOCKED"
          ? "Đã khóa tài khoản và thu hồi các phiên đăng nhập."
          : "Đã mở khóa tài khoản.",
      );
      changed();
    } catch (e) {
      setError(message(e));
      setConfirm(false);
    } finally {
      flight.current = false;
      setBusy(false);
    }
  };
  return (
    <Modal title="Chi tiết người dùng" close={close} busy={busy}>
      {!user ? (
        <Feedback
          loading={!error}
          error={error}
          retry={() => setRevision((value) => value + 1)}
        />
      ) : (
        <>
          <div className="ad-user-profile">
            <Avatar user={user} />
            <div>
              <h3>{user.fullName}</h3>
              <span>{user.email}</span>
            </div>
            <AdminBadge status={user.status} />
          </div>
          <dl className="ad-modal-facts">
            <div>
              <dt>Mã người dùng</dt>
              <dd>#{user.id}</dd>
            </div>
            <div>
              <dt>Vai trò</dt>
              <dd>{user.roles.map((role) => adminLabels[role]).join(", ")}</dd>
            </div>
            <div>
              <dt>Ngày đăng ký</dt>
              <dd>{stamp(user.createdAt)}</dd>
            </div>
          </dl>
          {error && (
            <div className="ad-inline-error" role="alert">
              <p>{error}</p>
              <button
                className="ad-text-button"
                disabled={busy}
                onClick={() => {
                  setRevision((value) => value + 1);
                  setConfirm(false);
                }}
              >
                Tải lại thông tin
              </button>
            </div>
          )}
          {success && (
            <p className="ad-success" role="status">
              {success}
            </p>
          )}
          {confirm && (
            <div className="ad-confirm" role="alert">
              <strong>
                {user.status === "ACTIVE"
                  ? "Khóa tài khoản này?"
                  : "Mở khóa tài khoản này?"}
              </strong>
              <p>
                {user.status === "ACTIVE"
                  ? "Người dùng sẽ bị đăng xuất và không thể đăng nhập cho đến khi được mở khóa."
                  : "Người dùng có thể đăng nhập lại. Các phiên đã thu hồi sẽ không được khôi phục."}
              </p>
            </div>
          )}
          <div className="ad-dialog-actions">
            <button
              className="ad-button"
              disabled={busy}
              onClick={() => (confirm ? setConfirm(false) : close())}
            >
              {confirm ? "Hủy thao tác" : "Đóng"}
            </button>
            {user.id !== actorId &&
              !user.roles.includes("ADMIN") &&
              user.status !== "DISABLED" && (
                <button
                  className={`ad-button ${user.status === "ACTIVE" ? "ad-danger-button" : "ad-primary-button"}`}
                  disabled={busy}
                  onClick={() => {
                    setSuccess("");
                    if (confirm) void changeStatus();
                    else setConfirm(true);
                  }}
                >
                  {busy
                    ? "Đang cập nhật…"
                    : confirm
                      ? "Xác nhận"
                      : user.status === "ACTIVE"
                        ? "Khóa tài khoản"
                        : "Mở khóa tài khoản"}
                </button>
              )}
          </div>
        </>
      )}
    </Modal>
  );
}
function Avatar({ user }: { user: AdminUser }) {
  const url = resolveAvatarUrl(user.avatarUrl);
  const [failed, setFailed] = useState(false);
  return (
    <span className="ad-avatar">
      {url && !failed ? (
        <img src={url} alt="" onError={() => setFailed(true)} />
      ) : (
        user.fullName
          .trim()
          .split(/\s+/)
          .slice(-2)
          .map((part) => part[0])
          .join("")
          .toUpperCase()
      )}
    </span>
  );
}
const loadUsers = (
  keyword: string,
  status: string,
  role: string,
  page: number,
) => adminDashboardApi.users({ keyword, status, role, page, size: 10 });
const loadProposals = (
  keyword: string,
  status: string,
  _role: string,
  page: number,
) => adminDashboardApi.proposals({ keyword, status, page, size: 10 });
export default function AdminRecords({
  kind,
  enabled,
  revision,
  changed,
  actorId,
  initialId,
}: {
  kind: "users" | "proposals";
  enabled: boolean;
  revision: number;
  changed: () => void;
  actorId?: number;
  initialId?: number;
}) {
  const [keyword, setKeyword] = useState("");
  const [status, setStatus] = useState("");
  const [role, setRole] = useState("");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<number | null>(initialId ?? null);
  useEffect(() => {
    const sync = () => {
      const raw = new URLSearchParams(
        window.location.hash.split("?")[1] || "",
      ).get("record");
      setSelected(
        raw && /^[1-9]\d*$/.test(raw) && Number.isSafeInteger(Number(raw))
          ? Number(raw)
          : (initialId ?? null),
      );
    };
    sync();
    window.addEventListener("popstate", sync);
    window.addEventListener("hashchange", sync);
    return () => {
      window.removeEventListener("popstate", sync);
      window.removeEventListener("hashchange", sync);
    };
  }, [initialId]);
  const [retry, setRetry] = useState(0);
  const users = kind === "users";
  const data = usePage<AdminUser | AdminProposal>(
    users ? loadUsers : loadProposals,
    enabled,
    keyword,
    status,
    role,
    page,
    revision + retry,
  );
  const filter = (set: (value: string) => void, value: string) => {
    set(value);
    setPage(0);
  };
  useEffect(() => {
    if (data.result && page > 0 && page >= data.result.totalPages)
      setPage(Math.max(0, data.result.totalPages - 1));
  }, [data.result, page]);
  return (
    <>
      <section className="ad-panel ad-data-panel">
        <div className="ad-table-toolbar ad-records-toolbar">
          <div>
            <strong>
              {users ? "Client & Freelancer" : "Đề xuất ứng tuyển"}
            </strong>
            <span>
              {data.result
                ? `${data.result.totalElements} kết quả`
                : "Đang tải dữ liệu"}
            </span>
          </div>
          <div className="ad-filters">
            <label className="ad-search">
              <Search size={17} />
              <input
                maxLength={200}
                aria-label="Tìm kiếm"
                placeholder={
                  users
                    ? "Tìm theo tên hoặc email…"
                    : "Tìm Job, Client, Freelancer…"
                }
                value={keyword}
                onChange={(e) => filter(setKeyword, e.target.value)}
              />
            </label>
            {users && (
              <select
                aria-label="Lọc vai trò"
                value={role}
                onChange={(e) => filter(setRole, e.target.value)}
              >
                <option value="">Tất cả vai trò</option>
                <option value="CLIENT">Client</option>
                <option value="FREELANCER">Freelancer</option>
              </select>
            )}
            <select
              aria-label="Lọc trạng thái"
              value={status}
              onChange={(e) => filter(setStatus, e.target.value)}
            >
              <option value="">Tất cả trạng thái</option>
              {(users
                ? ["ACTIVE", "LOCKED", "DISABLED"]
                : ["PENDING", "ACCEPTED", "REJECTED", "WITHDRAWN"]
              ).map((value) => (
                <option key={value} value={value}>
                  {adminLabels[value]}
                </option>
              ))}
            </select>
          </div>
        </div>
        {data.loading || data.error || !data.result?.content.length ? (
          <Feedback
            loading={data.loading}
            error={data.error}
            empty={
              enabled
                ? keyword || status || role
                  ? "Không có kết quả phù hợp"
                  : "Chưa có dữ liệu"
                : "Đăng nhập Admin để xem dữ liệu"
            }
            retry={() => setRetry((value) => value + 1)}
          />
        ) : (
          <div className="ad-table-scroll">
            <table>
              <thead>
                <tr>
                  {(users
                    ? [
                        "Người dùng",
                        "Vai trò",
                        "Ngày đăng ký",
                        "Trạng thái",
                        "Thao tác",
                      ]
                    : [
                        "Freelancer",
                        "Job / Client",
                        "Ngân sách đề xuất",
                        "Thời gian",
                        "Ngày gửi",
                        "Trạng thái",
                        "Thao tác",
                      ]
                  ).map((label) => (
                    <th key={label}>{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.result.content.map((row) =>
                  "email" in row ? (
                    <tr key={row.id}>
                      <td>
                        <div className="ad-user-cell">
                          <Avatar user={row} />
                          <div>
                            <button
                              className="ad-record-link"
                              onClick={() => setSelected(row.id)}
                            >
                              {row.fullName}
                            </button>
                            <small>{row.email}</small>
                          </div>
                        </div>
                      </td>
                      <td>
                        {row.roles.map((value) => (
                          <span className="ad-role-tag" key={value}>
                            {adminLabels[value]}
                          </span>
                        ))}
                      </td>
                      <td className="ad-nowrap">{day(row.createdAt)}</td>
                      <td>
                        <AdminBadge status={row.status} />
                      </td>
                      <td>
                        <button
                          className="ad-view"
                          onClick={() => setSelected(row.id)}
                        >
                          Xem chi tiết
                        </button>
                      </td>
                    </tr>
                  ) : (
                    <tr key={row.id}>
                      <td>
                        {row.freelancerName}
                        <small>#{row.freelancerId}</small>
                      </td>
                      <td>
                        <button
                          className="ad-record-link"
                          onClick={() => setSelected(row.id)}
                        >
                          {row.jobTitle}
                        </button>
                        <small>{row.clientName}</small>
                      </td>
                      <td className="ad-money">
                        {adminMoney(row.proposedBudget, row.currencyCode)}
                      </td>
                      <td className="ad-nowrap">{row.estimatedDays} ngày</td>
                      <td className="ad-nowrap">{day(row.submittedAt)}</td>
                      <td>
                        <AdminBadge status={row.status} />
                      </td>
                      <td>
                        <button
                          className="ad-view"
                          onClick={() => setSelected(row.id)}
                        >
                          Xem
                        </button>
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        )}
        {data.result && (
          <Pagination page={page} data={data.result} change={setPage} />
        )}
      </section>
      {selected !== null &&
        enabled &&
        (users ? (
          <UserDialog
            key={selected}
            id={selected}
            close={() => setSelected(null)}
            changed={changed}
            actorId={actorId}
          />
        ) : (
          <ProposalDialog
            key={selected}
            id={selected}
            close={() => setSelected(null)}
          />
        ))}
    </>
  );
}
function ProposalDialog({ id, close }: { id: number; close: () => void }) {
  const [record, setRecord] = useState<AdminProposalDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setRecord(null);
    setError(null);
    adminDashboardApi
      .proposal(id)
      .then((data) => {
        if (active) setRecord(data);
      })
      .catch((e) => {
        if (active) setError(message(e));
      });
    return () => {
      active = false;
    };
  }, [id, retry]);
  const value = record?.summary;
  return (
    <Modal title={`Chi tiết Proposal #${id}`} close={close}>
      {!record || !value ? (
        <Feedback
          loading={!error}
          error={error}
          retry={() => setRetry((value) => value + 1)}
        />
      ) : (
        <>
          <div className="ad-proposal-heading">
            <h3>{value.jobTitle}</h3>
            <AdminBadge status={value.status} />
          </div>
          <dl className="ad-modal-facts">
            <div>
              <dt>Freelancer</dt>
              <dd>{value.freelancerName}</dd>
            </div>
            <div>
              <dt>Client</dt>
              <dd>{value.clientName}</dd>
            </div>
            <div>
              <dt>Ngân sách đề xuất</dt>
              <dd>{adminMoney(value.proposedBudget, value.currencyCode)}</dd>
            </div>
            <div>
              <dt>Thời gian dự kiến</dt>
              <dd>{value.estimatedDays} ngày</dd>
            </div>
            <div>
              <dt>Ngày gửi</dt>
              <dd>{stamp(value.submittedAt)}</dd>
            </div>
          </dl>
          <section className="ad-cover-letter">
            <h3>Thư ứng tuyển</h3>
            <p>{record.coverLetter}</p>
          </section>
          <div className="ad-dialog-actions">
            <small>Admin chỉ xem và giám sát Proposal.</small>
            <button className="ad-button" onClick={close}>
              Đóng
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
const loadActivities = (
  keyword: string,
  action: string,
  _role: string,
  page: number,
) => adminDashboardApi.activities({ keyword, action, page, size: 10 });
export function AdminActivities({
  enabled,
  revision,
  compact = false,
}: {
  enabled: boolean;
  revision: number;
  compact?: boolean;
}) {
  const [keyword, setKeyword] = useState("");
  const [action, setAction] = useState("");
  const [page, setPage] = useState(0);
  const [retry, setRetry] = useState(0);
  const data = usePage<AdminActivity>(
    loadActivities,
    enabled,
    keyword,
    action,
    "",
    page,
    revision + retry,
  );
  if (compact)
    return data.loading || data.error || !data.result?.content.length ? (
      <Feedback
        loading={data.loading}
        error={data.error}
        empty="Chưa có hoạt động nào"
        retry={() => setRetry((value) => value + 1)}
      />
    ) : (
      <div className="ad-activity-list">
        {data.result.content.slice(0, 5).map((item) => (
          <div className="ad-activity-row" key={item.id}>
            <span className="ad-activity-icon">
              <ShieldCheck size={17} />
            </span>
            <span>
              <strong>
                {item.actorName} · {actions[item.action] || item.action}
              </strong>
              <small>
                {item.entityType} #{item.entityId}
              </small>
            </span>
            <time title={stamp(item.createdAt)}>{day(item.createdAt)}</time>
          </div>
        ))}
      </div>
    );
  return (
    <section className="ad-panel">
      <div className="ad-table-toolbar ad-records-toolbar">
        <div>
          <strong>Nhật ký hoạt động</strong>
          <span>{data.result?.totalElements ?? "—"} bản ghi</span>
        </div>
        <div className="ad-filters">
          <label className="ad-search">
            <Search size={17} />
            <input
              maxLength={200}
              aria-label="Tìm nhật ký"
              placeholder="Người thực hiện, hành động, mã…"
              value={keyword}
              onChange={(e) => {
                setKeyword(e.target.value);
                setPage(0);
              }}
            />
          </label>
          <select
            aria-label="Lọc hành động"
            value={action}
            onChange={(e) => {
              setAction(e.target.value);
              setPage(0);
            }}
          >
            <option value="">Tất cả hành động</option>
            {Object.entries(actions).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>
      {data.loading || data.error || !data.result?.content.length ? (
        <Feedback
          loading={data.loading}
          error={data.error}
          empty="Chưa có hoạt động phù hợp"
          retry={() => setRetry((value) => value + 1)}
        />
      ) : (
        <div className="ad-table-scroll">
          <table>
            <thead>
              <tr>
                <th>Thời gian</th>
                <th>Người thực hiện</th>
                <th>Hành động</th>
                <th>Đối tượng</th>
              </tr>
            </thead>
            <tbody>
              {data.result.content.map((item) => (
                <tr key={item.id}>
                  <td className="ad-nowrap">{stamp(item.createdAt)}</td>
                  <td>
                    {item.actorName}
                    <small>
                      {item.actorId ? `#${item.actorId}` : "Tự động"}
                    </small>
                  </td>
                  <td>{actions[item.action] || item.action}</td>
                  <td>
                    {item.entityType} #{item.entityId}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data.result && (
        <Pagination page={page} data={data.result} change={setPage} />
      )}
    </section>
  );
}
export function ProjectMilestones({
  id,
  currency,
}: {
  id: number;
  currency: string;
}) {
  const [items, setItems] = useState<Milestone[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setItems(null);
    setError(null);
    (async () => {
      const first = await milestonesApi.list(id, 0, 100);
      const rows = [...first.content];
      for (let page = 1; page < first.totalPages; page++)
        rows.push(...(await milestonesApi.list(id, page, 100)).content);
      if (rows.length !== first.totalElements)
        throw new Error("Danh sách milestone đã thay đổi. Vui lòng tải lại.");
      if (active) setItems(rows);
    })().catch((e) => {
      if (active) setError(message(e));
    });
    return () => {
      active = false;
    };
  }, [id, retry]);
  const relevant = items?.filter((item) => item.status !== "CANCELLED") || [];
  const approved = relevant.filter((item) => item.status === "APPROVED").length;
  return (
    <section className="ad-milestones">
      <div className="ad-section-title">
        <div>
          <h2>Milestone</h2>
          <p>Theo dõi tiến độ bàn giao của dự án.</p>
        </div>
        <span className="ad-mini-label">Chỉ xem</span>
      </div>
      {!items ? (
        <Feedback
          loading={!error}
          error={error}
          retry={() => setRetry((value) => value + 1)}
        />
      ) : !items.length ? (
        <Feedback empty="Dự án chưa có milestone" />
      ) : (
        <>
          {relevant.length > 0 && (
            <div className="ad-project-progress">
              <div>
                <span>
                  {approved}/{relevant.length} milestone đã duyệt
                </span>
                <strong>
                  {Math.round((approved / relevant.length) * 100)}%
                </strong>
              </div>
              <progress
                max={relevant.length}
                value={approved}
                aria-label="Tiến độ milestone đã duyệt"
              />
              <small>
                Tiến độ theo số milestone, không bao gồm milestone đã hủy.
              </small>
            </div>
          )}
          <div className="ad-table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Milestone</th>
                  <th>Hạn bàn giao</th>
                  <th>Ngân sách</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.title}</strong>
                      <small>{item.isRequired ? "Bắt buộc" : "Tùy chọn"}</small>
                      <p className="ad-milestone-description">
                        {item.description}
                      </p>
                    </td>
                    <td className="ad-nowrap">{day(item.dueDate)}</td>
                    <td className="ad-money">
                      {adminMoney(item.amount, currency)}
                    </td>
                    <td>
                      <AdminBadge status={item.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
