import { useEffect, useRef, useState } from "react";
import {
  Bell,
  Check,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  ArrowUpRight,
  X,
} from "lucide-react";
import type { AuthUser } from "../../api/auth";
import type { Page } from "../../api/jobs";
import {
  notificationsApi,
  type NotificationItem,
} from "../../api/notifications";
import { navigateClientJobs } from "../jobs/navigation";
import "./notifications.css";

const changedEvent = "linkit-notifications-changed";
const message = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "Không thể tải thông báo. Vui lòng thử lại.";
function announce(userId: number) {
  window.dispatchEvent(new CustomEvent(changedEvent, { detail: userId }));
}
function useInbox(
  user: AuthUser | null,
  enabled: boolean,
  unread: boolean,
  page: number,
  compact: boolean,
) {
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<{
    owner: number | null;
    data: Page<NotificationItem> | null;
    count: number | null;
    loading: boolean;
    error: string;
    countError: string;
  }>({
    owner: null,
    data: null,
    count: null,
    loading: false,
    error: "",
    countError: "",
  });
  useEffect(() => {
    const changed = (event: Event) => {
      if ((event as CustomEvent<number>).detail === user?.id)
        setRevision((value) => value + 1);
    };
    window.addEventListener(changedEvent, changed);
    return () => window.removeEventListener(changedEvent, changed);
  }, [user?.id]);
  useEffect(() => {
    if (!user || !compact || enabled) return;
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible")
        setRevision((value) => value + 1);
    }, 60000);
    return () => window.clearInterval(interval);
  }, [user?.id, compact, enabled]);
  useEffect(() => {
    const abort = new AbortController();
    let alive = true;
    const owner = user?.id ?? null;
    if (owner === null) {
      setState({
        owner,
        data: null,
        count: null,
        loading: false,
        error: "",
        countError: "",
      });
      return;
    }
    setState((previous) => ({
      owner,
      data: null,
      count: previous.owner === owner ? previous.count : null,
      loading: enabled,
      error: "",
      countError: "",
    }));
    const tasks = [
      notificationsApi
        .count(abort.signal)
        .then((result) => {
          if (alive)
            setState((previous) => ({
              ...previous,
              count: result.unreadCount,
            }));
        })
        .catch((error) => {
          if (alive)
            setState((previous) => ({
              ...previous,
              count: null,
              countError: message(error),
            }));
        }),
    ];
    if (enabled)
      tasks.push(
        notificationsApi
          .list(unread, page, compact ? 5 : 20, abort.signal)
          .then((data) => {
            if (alive)
              setState((previous) => ({ ...previous, data, loading: false }));
          })
          .catch((error) => {
            if (alive)
              setState((previous) => ({
                ...previous,
                data: null,
                loading: false,
                error: message(error),
              }));
          }),
      );
    void Promise.allSettled(tasks);
    return () => {
      alive = false;
      abort.abort();
    };
  }, [user?.id, enabled, unread, page, compact, revision]);
  return {
    ...(state.owner === (user?.id ?? null)
      ? state
      : {
          owner: user?.id ?? null,
          data: null,
          count: null,
          loading: enabled,
          error: "",
          countError: "",
        }),
    reload: () => setRevision((value) => value + 1),
  };
}
function go(
  item: NotificationItem,
  user: AuthUser,
  navigate: (page: string) => void,
) {
  const id = item.resourceId;
  if (!Number.isSafeInteger(id) || id < 1)
    throw new Error("Thông báo không có mã tài nguyên hợp lệ.");
  if (
    item.resourceType === "JOB_PROPOSAL" &&
    user.roles.includes("CLIENT") &&
    item.jobId
  ) {
    navigateClientJobs({
      jobId: item.jobId,
      proposalId: id,
      invalidId: false,
      tab: "proposals",
      page: 0,
    });
    navigate("Quản lý công việc");
    return;
  }
  let target: string;
  const params = new URLSearchParams();
  if (item.resourceType === "PROPOSAL" && user.roles.includes("FREELANCER")) {
    target = "Đề xuất đã gửi";
    params.set("proposalId", String(id));
  } else if (
    item.resourceType === "ASSIGNMENT" &&
    (user.roles.includes("CLIENT") || user.roles.includes("FREELANCER"))
  ) {
    target = "Không gian dự án";
    params.set("assignmentId", String(id));
    if (["scope", "milestones", "acceptance"].includes(item.section || ""))
      params.set("section", item.section!);
  } else if (item.resourceType === "USER" && user.roles.includes("ADMIN")) {
    target = "Quản lý người dùng";
    params.set("record", String(id));
  } else
    throw new Error(
      "Vai trò hiện tại không hỗ trợ mở tài nguyên của thông báo này.",
    );
  window.history.pushState(
    null,
    "",
    `#/dashboard/${encodeURIComponent(target)}?${params}`,
  );
  navigate(target);
  window.dispatchEvent(new PopStateEvent("popstate"));
}
function Inbox({
  user,
  navigate,
  compact = false,
  close,
}: {
  user: AuthUser;
  navigate: (page: string) => void;
  compact?: boolean;
  close?: () => void;
}) {
  const [unread, setUnread] = useState(false);
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const flight = useRef(false);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const inbox = useInbox(user, true, unread, page, compact);
  useEffect(() => {
    if (inbox.data && page > 0 && page >= inbox.data.totalPages)
      setPage(Math.max(0, inbox.data.totalPages - 1));
  }, [page, inbox.data]);
  const act = async (item?: NotificationItem, open = false) => {
    if (flight.current) return;
    flight.current = true;
    setBusy(true);
    setActionError("");
    try {
      if (!item) await notificationsApi.readAll();
      else if (!item.readAt) await notificationsApi.read(item.id);
      if (!active.current) return;
      announce(user.id);
      if (open && item) {
        go(item, user, navigate);
        close?.();
      }
    } catch (error) {
      if (active.current) setActionError(message(error));
    } finally {
      flight.current = false;
      if (active.current) setBusy(false);
    }
  };
  return (
    <div className={`nt-inbox ${compact ? "nt-compact" : ""}`}>
      <div className="nt-heading">
        <div>
          <h2>{compact ? "Thông báo" : "Hộp thư của bạn"}</h2>
          <small>
            {inbox.count === null
              ? "Chưa tải được số chưa đọc"
              : `${inbox.count} thông báo chưa đọc`}
          </small>
        </div>
        {close && (
          <button
            className="nt-icon"
            aria-label="Đóng thông báo"
            onClick={close}
          >
            <X size={17} />
          </button>
        )}
      </div>
      <div className="nt-toolbar">
        <div className="nt-tabs">
          <button
            aria-pressed={!unread}
            onClick={() => {
              setUnread(false);
              setPage(0);
            }}
          >
            Tất cả
          </button>
          <button
            aria-pressed={unread}
            onClick={() => {
              setUnread(true);
              setPage(0);
            }}
          >
            Chưa đọc
          </button>
        </div>
        <button
          className="nt-text"
          disabled={busy || !inbox.count}
          onClick={() => void act()}
        >
          <CheckCheck size={15} />
          Đánh dấu tất cả đã đọc
        </button>
        <button
          className="nt-icon"
          aria-label="Tải lại thông báo"
          disabled={inbox.loading}
          onClick={() => {
            setActionError("");
            inbox.reload();
          }}
        >
          <RefreshCw size={15} />
        </button>
      </div>
      {(actionError || inbox.error || inbox.countError) && (
        <div className="nt-error" role="alert">
          {actionError || inbox.error || inbox.countError}
          <button className="nt-text" onClick={inbox.reload}>
            Thử tải lại
          </button>
        </div>
      )}
      {inbox.loading ? (
        <div className="nt-empty" role="status">
          Đang tải thông báo…
        </div>
      ) : inbox.data?.content.length ? (
        <div className="nt-list">
          {inbox.data.content.map((item) => (
            <article
              key={item.id}
              className={`nt-item ${item.readAt ? "" : "nt-unread"}`}
            >
              <span className="nt-event-icon">
                <Bell size={17} />
              </span>
              <div>
                <button
                  className="nt-open"
                  disabled={busy}
                  onClick={() => void act(item, true)}
                >
                  <strong>{item.title}</strong>
                  <span>{item.description}</span>
                </button>
                <div className="nt-meta">
                  <time dateTime={item.createdAt}>
                    {new Date(item.createdAt).toLocaleString("vi-VN")}
                  </time>
                  <span>{item.readAt ? "Đã đọc" : "Chưa đọc"}</span>
                  {!item.readAt && (
                    <button
                      className="nt-text"
                      disabled={busy}
                      onClick={() => void act(item)}
                    >
                      <Check size={13} />
                      Đánh dấu đã đọc
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        !inbox.error && (
          <div className="nt-empty">
            <Bell size={28} />
            <strong>
              {unread ? "Bạn đã đọc hết thông báo" : "Chưa có thông báo"}
            </strong>
            <span>Thông báo mới sẽ xuất hiện khi có hoạt động liên quan.</span>
          </div>
        )
      )}
      {inbox.data && inbox.data.totalPages > 1 && (
        <div className="nt-pagination">
          <button
            className="nt-icon"
            disabled={busy || page === 0}
            aria-label="Trang trước"
            onClick={() => setPage((value) => value - 1)}
          >
            <ChevronLeft size={17} />
          </button>
          <span>
            {page + 1}/{inbox.data.totalPages}
          </span>
          <button
            className="nt-icon"
            disabled={busy || page + 1 >= inbox.data.totalPages}
            aria-label="Trang sau"
            onClick={() => setPage((value) => value + 1)}
          >
            <ChevronRight size={17} />
          </button>
        </div>
      )}
      {compact && (
        <button
          className="nt-all"
          onClick={() => {
            navigate("Thông báo");
            close?.();
          }}
        >
          Xem tất cả thông báo
          <ArrowUpRight size={15} />
        </button>
      )}
    </div>
  );
}
export default function NotificationBell({
  user,
  navigate,
}: {
  user: AuthUser | null;
  navigate: (page: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const inbox = useInbox(user, false, false, 0, true);
  useEffect(() => {
    setOpen(false);
  }, [user?.id]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        ref.current?.querySelector<HTMLButtonElement>("button")?.focus();
      }
    };
    document.addEventListener("mousedown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);
  if (!user) return null;
  return (
    <div className="nt-bell" ref={ref}>
      <button
        className="nt-trigger"
        onClick={() => {
          setOpen((value) => !value);
          inbox.reload();
        }}
        aria-expanded={open}
        aria-label={`Thông báo${inbox.count !== null ? `: ${inbox.count} chưa đọc` : ""}`}
        title={inbox.countError || "Thông báo"}
      >
        <Bell size={20} />
        {inbox.count !== null && inbox.count > 0 && (
          <b>{inbox.count > 99 ? "99+" : inbox.count}</b>
        )}
        {inbox.countError && (
          <span
            className="nt-count-error"
            aria-label="Không thể tải số thông báo"
          >
            !
          </span>
        )}
      </button>
      {open && (
        <div className="nt-dropdown">
          <Inbox
            key={user.id}
            user={user}
            navigate={navigate}
            compact
            close={() => setOpen(false)}
          />
        </div>
      )}
    </div>
  );
}
export function NotificationPage({
  user,
  navigate,
}: {
  user: AuthUser | null;
  navigate: (page: string) => void;
}) {
  return (
    <section className="nt-page">
      {user ? (
        <Inbox key={user.id} user={user} navigate={navigate} />
      ) : (
        <div className="nt-empty">Đăng nhập để xem thông báo của bạn.</div>
      )}
    </section>
  );
}
