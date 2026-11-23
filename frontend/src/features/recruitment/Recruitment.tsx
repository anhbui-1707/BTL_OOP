import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  AlertCircle,
  Inbox,
  LoaderCircle,
  Eye,
  Download,
  Star,
  RefreshCw,
  ArrowUpRight,
  Clock3,
  FolderKanban,
  Layers3,
  Wallet,
  CalendarDays,
  Building2,
  CheckCircle2,
  BriefcaseBusiness,
  FileText,
  Paperclip,
  Trash2,
} from "lucide-react";
import { cvApi } from "../../api/platform";
import {
  publicFreelancersApi,
  type PublicFreelancer,
} from "../../api/publicFreelancers";
import type { AuthUser } from "../../api/auth";
import { jobApi, type Job, type Page } from "../../api/jobs";
import {
  assignmentsApi,
  matchingApi,
  proposalsApi,
  type Assignment,
  type AssignmentStatus,
  type Candidate,
  type Proposal,
  type ProposalStatus,
  type ProposalSummary,
} from "../../api/recruitment";
import { money } from "../jobs/model";
import {
  canSelect,
  canSubmit,
  ownsJob,
  proposalInput,
  proposalRights,
  selectAndReload,
} from "./model";
import { ApiError } from "../../api/http";
import {
  openWorkspace as openAssignmentWorkspace,
  party,
} from "../workspace/productionModel";

const proposalLabels: Record<ProposalStatus, string> = {
  PENDING: "Chờ phản hồi",
  ACCEPTED: "Đã chấp nhận",
  REJECTED: "Đã từ chối",
  WITHDRAWN: "Đã rút",
};
export const assignmentLabels: Record<AssignmentStatus, string> = {
  PENDING_SCOPE: "Chờ thống nhất yêu cầu",
  ACTIVE: "Đang thực hiện",
  AWAITING_ACCEPTANCE: "Chờ nghiệm thu",
  COMPLETED: "Đã hoàn thành",
  CANCELLED: "Đã hủy",
};
const message = (e: unknown) =>
  e instanceof ApiError
    ? [e.message, ...Object.values(e.errors)].join(" · ")
    : e instanceof Error
      ? e.message
      : "Không thể tải dữ liệu.";
const emptyPage = <T,>(): Page<T> => ({
  content: [],
  page: 0,
  size: 20,
  totalElements: 0,
  totalPages: 0,
});
function ErrorView({ error, retry }: { error: string; retry?: () => void }) {
  return error ? (
    <div className="auth-error" role="alert">
      <AlertCircle size={16} />
      {error}
      {retry && (
        <button type="button" className="text-button" onClick={retry}>
          Tải lại
        </button>
      )}
    </div>
  ) : null;
}
function Paging({
  data,
  busy,
  change,
}: {
  data: Page<unknown>;
  busy: boolean;
  change: (page: number) => void;
}) {
  return (
    <div className="pagination">
      <span>
        {data.totalElements} kết quả · Trang{" "}
        {data.totalPages ? data.page + 1 : 0}/{data.totalPages}
      </span>
      <div>
        <button
          disabled={busy || !data.page}
          onClick={() => change(data.page - 1)}
        >
          ‹
        </button>
        <button
          disabled={busy || data.page + 1 >= data.totalPages}
          onClick={() => change(data.page + 1)}
        >
          ›
        </button>
      </div>
    </div>
  );
}
function StatusFilter({
  value,
  change,
}: {
  value: ProposalStatus | "";
  change: (value: ProposalStatus | "") => void;
}) {
  return (
    <label>
      Trạng thái
      <select
        value={value}
        onChange={(e) => change(e.target.value as ProposalStatus | "")}
      >
        <option value="">Tất cả</option>
        {Object.entries(proposalLabels).map(([key, label]) => (
          <option key={key} value={key}>
            {label}
          </option>
        ))}
      </select>
    </label>
  );
}
function Loading() {
  return (
    <p role="status">
      <LoaderCircle size={16} />
      Đang tải...
    </p>
  );
}
function Empty({ text }: { text: string }) {
  return (
    <div className="proposal-empty">
      <Inbox />
      <strong>{text}</strong>
    </div>
  );
}

function FreelancerRating({
  averageRating,
  reviewCount,
  compact = false,
}: {
  averageRating?: number | null;
  reviewCount?: number;
  compact?: boolean;
}) {
  const count = Number(reviewCount || 0);
  const rating =
    averageRating != null &&
    Number.isFinite(averageRating) &&
    averageRating >= 1 &&
    averageRating <= 5 &&
    count > 0
      ? averageRating
      : null;
  if (rating === null)
    return (
      <span
        className={`freelancer-rating is-unrated ${compact ? "is-compact" : ""}`}
        aria-label="0 trên 5 sao, chưa có đánh giá"
      >
        <Star size={compact ? 14 : 16} aria-hidden="true" />
        <strong>
          0<small>/5</small>
        </strong>
        <span className="freelancer-rating-count">· Chưa có đánh giá</span>
      </span>
    );
  return (
    <span
      className={`freelancer-rating ${compact ? "is-compact" : ""}`}
      aria-label={`Đánh giá trung bình ${rating.toFixed(1)} trên 5 sao từ ${count} dự án`}
    >
      <span className="freelancer-rating-stars" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            size={compact ? 14 : 16}
            fill={star <= Math.round(rating) ? "currentColor" : "none"}
          />
        ))}
      </span>
      <strong>
        {rating.toFixed(1)}
        <small>/5</small>
      </strong>
      <span className="freelancer-rating-count">({count} đánh giá)</span>
    </span>
  );
}

function ProposalCvAttachment({ value }: { value: Proposal }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const url = useRef<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  const flight = useRef(false);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      controller.current?.abort();
      if (url.current) URL.revokeObjectURL(url.current);
    };
  }, []);
  const open = async (download: boolean) => {
    if (flight.current || value.cvId == null) return;
    flight.current = true;
    setBusy(true);
    setError("");
    controller.current = new AbortController();
    try {
      const blob = await proposalsApi.cvBlob(
        value.id,
        controller.current.signal,
      );
      if (!active.current) return;
      const next = URL.createObjectURL(blob);
      if (download) {
        window.setTimeout(() => URL.revokeObjectURL(next), 30000);
        const link = document.createElement("a");
        link.href = next;
        link.download = value.cvFileName || "CV.pdf";
        document.body.appendChild(link);
        try {
          link.click();
        } finally {
          link.remove();
        }
      } else {
        if (url.current) URL.revokeObjectURL(url.current);
        url.current = next;
        setPreview(next);
      }
    } catch (cause) {
      if (active.current) setError(message(cause));
    } finally {
      flight.current = false;
      if (active.current) setBusy(false);
    }
  };
  if (value.cvId == null)
    return <p className="business-note">Không có CV đính kèm</p>;
  return (
    <section className="proposal-cv-field" aria-label="CV đính kèm Proposal">
      <h3>CV đính kèm</h3>
      <p>
        {value.cvFileName || "CV.pdf"}
        {value.cvByteSize
          ? " · " + Math.ceil(value.cvByteSize / 1024) + " KB"
          : ""}
      </p>
      <div className="proposal-actions">
        <button
          type="button"
          className="secondary-button"
          disabled={busy}
          onClick={() => (preview ? setPreview(null) : void open(false))}
        >
          <Eye size={15} />
          {busy ? "Đang tải CV…" : preview ? "Ẩn CV" : "Xem CV"}
        </button>
        <button
          type="button"
          className="secondary-button"
          disabled={busy}
          onClick={() => void open(true)}
        >
          <Download size={15} />
          Tải CV
        </button>
      </div>
      <ErrorView error={error} />
      {preview && (
        <iframe
          src={preview}
          title={value.cvFileName || "CV đính kèm"}
          style={{
            width: "100%",
            height: "min(50vh, 480px)",
            border: "1px solid var(--border-default)",
            borderRadius: 10,
            marginTop: 12,
          }}
        />
      )}
    </section>
  );
}
function ProposalView({
  value,
  user,
  changed,
}: {
  value: Proposal;
  user: AuthUser;
  changed: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const flight = useRef(false);
  const [error, setError] = useState("");
  const rights = proposalRights(user, value);
  const act = async (withdraw: boolean) => {
    if (
      flight.current ||
      !window.confirm(withdraw ? "Rút Proposal này?" : "Từ chối Proposal này?")
    )
      return;
    flight.current = true;
    setBusy(true);
    setError("");
    try {
      if (withdraw) await proposalsApi.withdraw(value.id, value.etag);
      else await proposalsApi.reject(value.id, value.etag);
      changed();
    } catch (e) {
      setError(message(e));
    } finally {
      flight.current = false;
      setBusy(false);
    }
  };
  return (
    <div className="sent-proposal-view">
      <div className="sent-proposal-job-heading">
        <div>
          <h3>{value.jobTitle}</h3>
          <span>
            Gửi ngày {new Date(value.submittedAt).toLocaleDateString("vi-VN")}
          </span>
        </div>
        <b className={`status proposal-status-${value.status.toLowerCase()}`}>
          {proposalLabels[value.status]}
        </b>
      </div>
      <dl className="sent-proposal-facts">
        <div>
          <span className="sent-proposal-fact-icon">
            <Wallet size={21} aria-hidden="true" />
          </span>
          <dt>Ngân sách đề xuất</dt>
          <dd>{money(value.proposedBudget, value.currencyCode)}</dd>
        </div>
        <div>
          <span className="sent-proposal-fact-icon">
            <CalendarDays size={21} aria-hidden="true" />
          </span>
          <dt>Thời gian dự kiến</dt>
          <dd>{value.estimatedDays} ngày</dd>
        </div>
      </dl>
      <section className="sent-proposal-letter">
        <h3>
          <FileText size={19} aria-hidden="true" />
          Nội dung đề xuất
        </h3>
        <p>{value.coverLetter}</p>
      </section>
      <section className="sent-proposal-cv">
        <h3>
          <Paperclip size={19} aria-hidden="true" />
          CV đính kèm
        </h3>
        <ProposalCvAttachment key={value.id} value={value} />
      </section>
      <ErrorView error={error} retry={changed} />
      {rights.withdraw || rights.reject ? (
        <div className="proposal-actions">
          {rights.withdraw && (
            <button
              className="secondary-button"
              disabled={busy}
              onClick={() => void act(true)}
            >
              <Trash2 size={16} aria-hidden="true" />
              Rút đề xuất
            </button>
          )}
          {rights.reject && (
            <button
              className="danger-button"
              disabled={busy}
              onClick={() => void act(false)}
            >
              Từ chối đề xuất
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}
function ClientProposalModal({
  proposalId,
  job,
  user,
  close,
  changed,
}: {
  proposalId: number;
  job: Job;
  user: AuthUser;
  close: () => void;
  changed: () => void;
}) {
  const [value, setValue] = useState<Proposal | null>(null);
  const [publicProfile, setPublicProfile] = useState<PublicFreelancer | null>(
    null,
  );
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileRetry, setProfileRetry] = useState(0);
  const [tab, setTab] = useState<"profile" | "proposal" | "cv">("profile");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const dialog = useRef<HTMLDivElement>(null);
  const flight = useRef(false);
  const mounted = useRef(true);
  const refreshOnClose = useRef(false);
  const selectionCommitted = useRef(false);
  const dismiss = () => {
    if (flight.current) return;
    close();
    if (refreshOnClose.current) changed();
  };
  useEffect(() => {
    mounted.current = true;
    const focused = document.activeElement as HTMLElement | null;
    const appRoot = document.getElementById("root");
    const wasInert = appRoot?.inert;
    const overflow = document.body.style.overflow;
    const padding = document.body.style.paddingRight;
    const gutter = window.innerWidth - document.documentElement.clientWidth;
    if (gutter > 0)
      document.body.style.paddingRight = `${parseFloat(getComputedStyle(document.body).paddingRight) + gutter}px`;
    document.body.style.overflow = "hidden";
    if (appRoot) appRoot.inert = true;
    dialog.current?.focus();
    return () => {
      mounted.current = false;
      document.body.style.overflow = overflow;
      document.body.style.paddingRight = padding;
      if (appRoot) appRoot.inert = wasInert ?? false;
      focused?.focus({ preventScroll: true });
    };
  }, []);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    proposalsApi
      .detail(proposalId)
      .then((proposal) => {
        if (
          proposal.id !== proposalId ||
          proposal.jobId !== job.id ||
          proposal.clientId !== user.id ||
          !ownsJob(user, job)
        )
          throw new Error("Bạn không có quyền xem đề xuất này.");
        if (active) setValue(proposal);
      })
      .catch((e) => {
        if (active) setError(message(e));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [proposalId, job.id, user.id, retry]);
  useEffect(() => {
    if (!value?.freelancerId) {
      setPublicProfile(null);
      setProfileError("");
      setProfileLoading(false);
      return;
    }
    let active = true;
    setPublicProfile(null);
    setProfileError("");
    setProfileLoading(true);
    publicFreelancersApi
      .detail(value.freelancerId)
      .then((profile) => {
        if (active) setPublicProfile(profile);
      })
      .catch((cause) => {
        if (active) setProfileError(message(cause));
      })
      .finally(() => {
        if (active) setProfileLoading(false);
      });
    return () => {
      active = false;
    };
  }, [value?.freelancerId, profileRetry]);
  const permitted = Boolean(
    value &&
      ownsJob(user, job) &&
      proposalRights(user, value).reject &&
      !selectionCommitted.current &&
      !error,
  );
  const act = async (accept: boolean) => {
    if (
      flight.current ||
      !value ||
      !permitted ||
      !window.confirm(
        accept
          ? `Chấp nhận đề xuất của ${value.freelancerName}? Hệ thống sẽ tạo dự án và từ chối các đề xuất PENDING còn lại.`
          : "Từ chối đề xuất này?",
      )
    )
      return;
    flight.current = true;
    setBusy(true);
    setError("");
    try {
      if (accept) {
        let candidate: Candidate | undefined;
        for (let page = 0; !candidate; page++) {
          const result = await matchingApi.candidates(job.id, {
            page,
            size: 100,
            status: "PENDING",
          });
          if (
            !Array.isArray(result.content) ||
            !Number.isSafeInteger(result.totalPages) ||
            result.totalPages < 0
          )
            throw new Error(
              "Không thể xác nhận điều kiện tuyển chọn. Vui lòng tải lại.",
            );
          candidate = result.content.find(
            (item) => item.proposalId === value.id,
          );
          if (
            !candidate &&
            (!result.content.length || page + 1 >= result.totalPages)
          )
            throw new Error(
              "Đề xuất không còn trong danh sách chờ xử lý. Vui lòng tải lại.",
            );
        }
        if (!canSelect(user, job, candidate))
          throw new Error(
            candidate.ineligibilityReasons.join(" · ") ||
              "Đề xuất chưa đủ điều kiện tuyển chọn.",
          );
        if (candidate.proposalVersion !== value.version)
          throw new Error(
            "Đề xuất đã thay đổi. Vui lòng tải lại và kiểm tra trước khi chấp nhận.",
          );
        refreshOnClose.current = true;
        const result = await selectAndReload(value.id, value.etag, () => {
          selectionCommitted.current = true;
        });
        if (mounted.current) setValue(result.proposal);
      } else {
        refreshOnClose.current = true;
        const result = await proposalsApi.reject(value.id, value.etag);
        if (mounted.current) setValue(result);
      }
    } catch (e) {
      if (mounted.current)
        setError(
          (selectionCommitted.current
            ? "Đã chấp nhận đề xuất; chưa tải đủ dữ liệu. Không gửi lại thao tác. "
            : "") + message(e),
        );
    } finally {
      flight.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  const amount = value
    ? value.currencyCode === "VND"
      ? money(String(value.proposedBudget).replace(/\.0+$/, ""), "₫")
      : money(value.proposedBudget, value.currencyCode)
    : "";
  const label = value
    ? value.status === "PENDING"
      ? "Chờ xử lý"
      : proposalLabels[value.status]
    : "";
  return createPortal(
    <div
      className="modal-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) dismiss();
      }}
    >
      <div
        ref={dialog}
        tabIndex={-1}
        className="modal-content proposal-submit-modal client-proposal-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="client-proposal-title"
        aria-busy={busy || loading}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            dismiss();
          }
          if (event.key === "Tab") {
            const controls = dialog.current?.querySelectorAll<HTMLElement>(
              'button:not(:disabled), [href], [tabindex="0"]',
            );
            const first = controls?.[0];
            const last = controls?.[controls.length - 1];
            if (!first) {
              event.preventDefault();
              dialog.current?.focus();
            }
            if (
              first &&
              last &&
              event.shiftKey &&
              (document.activeElement === first ||
                document.activeElement === dialog.current)
            ) {
              event.preventDefault();
              last.focus();
            } else if (
              first &&
              last &&
              !event.shiftKey &&
              (document.activeElement === last ||
                document.activeElement === dialog.current)
            ) {
              event.preventDefault();
              first.focus();
            }
          }
        }}
      >
        <div className="modal-header proposal-modal-header">
          <div>
            <h2 id="client-proposal-title">Chi tiết đề xuất</h2>
            {value && (
              <div className="client-proposal-identity">
                <div>
                  <strong>{value.freelancerName}</strong>
                  {value.freelancerHeadline && (
                    <p>{value.freelancerHeadline}</p>
                  )}
                  <FreelancerRating
                    averageRating={value.averageRating}
                    reviewCount={value.reviewCount}
                    compact
                  />
                </div>
                <b
                  className={`status proposal-status-${value.status.toLowerCase()}`}
                >
                  {label}
                </b>
              </div>
            )}
          </div>
          <button
            className="proposal-modal-close"
            aria-label="Đóng chi tiết đề xuất"
            disabled={busy}
            onClick={dismiss}
          >
            ×
          </button>
        </div>
        <div className="client-proposal-body">
          {loading ? (
            <Loading />
          ) : (
            value && (
              <>
                <div
                  className="client-applicant-tabs"
                  role="tablist"
                  aria-label="Thông tin Freelancer"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={tab === "profile"}
                    className={tab === "profile" ? "active" : ""}
                    onClick={() => setTab("profile")}
                  >
                    Hồ sơ Freelancer
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={tab === "proposal"}
                    className={tab === "proposal" ? "active" : ""}
                    onClick={() => setTab("proposal")}
                  >
                    Nội dung đề xuất
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={tab === "cv"}
                    className={tab === "cv" ? "active" : ""}
                    onClick={() => setTab("cv")}
                  >
                    CV đính kèm
                  </button>
                </div>
                {tab === "profile" && (
                  <div className="client-applicant-profile" role="tabpanel">
                    {value.contactPhone || value.contactEmail ? (
                      <section
                        className="client-applicant-contact"
                        aria-label="Thông tin liên hệ Freelancer"
                      >
                        <div className="client-applicant-contact-title">
                          <h3>Thông tin liên hệ</h3>
                          <span>Dành cho Client</span>
                        </div>
                        <div className="client-applicant-contact-items">
                          {value.contactPhone && (
                            <div className="client-applicant-contact-card">
                              <span className="client-applicant-contact-label">
                                Số điện thoại
                              </span>
                              <strong>{value.contactPhone}</strong>
                              <div className="client-applicant-contact-actions">
                                <button
                                  type="button"
                                  onClick={() =>
                                    void navigator.clipboard.writeText(
                                      value.contactPhone!,
                                    )
                                  }
                                >
                                  Sao chép
                                </button>
                              </div>
                            </div>
                          )}
                          {value.contactEmail && (
                            <div className="client-applicant-contact-card">
                              <span className="client-applicant-contact-label">
                                Email
                              </span>
                              <strong>{value.contactEmail}</strong>
                              <div className="client-applicant-contact-actions">
                                <a href={`mailto:${value.contactEmail}`}>
                                  Gửi email
                                </a>
                                <button
                                  type="button"
                                  onClick={() =>
                                    void navigator.clipboard.writeText(
                                      value.contactEmail!,
                                    )
                                  }
                                >
                                  Sao chép
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </section>
                    ) : (
                      <p className="client-applicant-privacy">
                        Freelancer chưa cập nhật thông tin liên hệ.
                      </p>
                    )}
                    <dl className="client-applicant-profile-facts">
                      <div>
                        <dt>Kinh nghiệm</dt>
                        <dd>
                          {value.freelancerYearsExperience == null
                            ? "Chưa cập nhật"
                            : `${value.freelancerYearsExperience} năm`}
                        </dd>
                      </div>
                      <div>
                        <dt>Ngân sách đề xuất</dt>
                        <dd>{amount}</dd>
                      </div>
                      <div>
                        <dt>Thời gian dự kiến</dt>
                        <dd>{value.estimatedDays} ngày</dd>
                      </div>
                    </dl>
                    <section>
                      <h3 className="client-applicant-section-heading">
                        Giới thiệu bản thân
                      </h3>
                      <p className="client-applicant-bio">
                        {value.freelancerBio?.trim() ||
                          "Freelancer chưa cập nhật giới thiệu bản thân."}
                      </p>
                    </section>
                    <section>
                      <h3 className="client-applicant-section-heading">
                        Kỹ năng chuyên môn
                      </h3>
                      {value.freelancerSkills?.length ? (
                        <div className="client-applicant-skills">
                          {value.freelancerSkills.map((skill) => (
                            <span key={skill}>{skill}</span>
                          ))}
                        </div>
                      ) : (
                        <p className="client-applicant-bio">
                          Chưa có kỹ năng được khai báo.
                        </p>
                      )}
                    </section>
                    <section className="client-applicant-history-section">
                      <h3 className="client-applicant-section-heading">
                        Kinh nghiệm làm việc
                      </h3>
                      {profileLoading ? (
                        <p className="client-applicant-bio" role="status">
                          Đang tải kinh nghiệm làm việc...
                        </p>
                      ) : profileError ? (
                        <div
                          className="client-applicant-history-notice"
                          role="alert"
                        >
                          Không thể tải kinh nghiệm và Portfolio.{" "}
                          <button
                            type="button"
                            className="text-button"
                            onClick={() =>
                              setProfileRetry((retry) => retry + 1)
                            }
                          >
                            Thử lại
                          </button>
                        </div>
                      ) : publicProfile?.workExperiences?.length ? (
                        <div className="client-applicant-history-items">
                          {[...publicProfile.workExperiences]
                            .sort((a, b) =>
                              (b.startDate || "").localeCompare(
                                a.startDate || "",
                              ),
                            )
                            .map((work) => (
                              <article
                                className="client-applicant-history-item"
                                key={work.id}
                              >
                                <strong>
                                  {work.position} · {work.companyName}
                                </strong>
                                <span className="client-applicant-history-date">
                                  {work.startDate || "Chưa cập nhật"} –{" "}
                                  {work.isCurrent
                                    ? "Hiện tại"
                                    : work.endDate || "Chưa cập nhật"}
                                </span>
                                {work.description && <p>{work.description}</p>}
                                {work.achievements && (
                                  <p>
                                    <b>Thành tựu:</b> {work.achievements}
                                  </p>
                                )}
                              </article>
                            ))}
                        </div>
                      ) : (
                        <p className="client-applicant-bio">
                          {publicProfile &&
                          !Array.isArray(publicProfile.workExperiences)
                            ? "Máy chủ chưa trả dữ liệu kinh nghiệm. Vui lòng cập nhật backend."
                            : "Chưa có kinh nghiệm làm việc trong hồ sơ."}
                        </p>
                      )}
                    </section>
                    <section className="client-applicant-history-section">
                      <h3 className="client-applicant-section-heading">
                        Portfolio · Dự án nổi bật
                      </h3>
                      {profileLoading ? (
                        <p className="client-applicant-bio" role="status">
                          Đang tải Portfolio...
                        </p>
                      ) : profileError ? (
                        <p className="client-applicant-bio">
                          Không thể tải Portfolio.
                        </p>
                      ) : publicProfile?.portfolioProjects?.length ? (
                        <div className="client-applicant-history-items">
                          {publicProfile.portfolioProjects.map((project) => (
                            <article
                              className="client-applicant-history-item"
                              key={project.id}
                            >
                              <strong>{project.title}</strong>
                              {project.role && (
                                <span className="client-applicant-history-date">
                                  Vai trò: {project.role}
                                </span>
                              )}
                              {project.description && (
                                <p>{project.description}</p>
                              )}
                              {project.technologies && (
                                <div className="client-applicant-skills">
                                  {[
                                    ...new Set(
                                      project.technologies
                                        .split(/[,;]+/)
                                        .map((tech) => tech.trim())
                                        .filter(Boolean),
                                    ),
                                  ].map((tech) => (
                                    <span key={tech}>{tech}</span>
                                  ))}
                                </div>
                              )}
                              <div className="client-applicant-project-links">
                                {project.projectUrl?.startsWith("https://") && (
                                  <a
                                    href={project.projectUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    Xem dự án <ArrowUpRight size={14} />
                                  </a>
                                )}
                                {project.githubUrl?.startsWith("https://") && (
                                  <a
                                    href={project.githubUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    GitHub <ArrowUpRight size={14} />
                                  </a>
                                )}
                              </div>
                            </article>
                          ))}
                        </div>
                      ) : (
                        <p className="client-applicant-bio">
                          {publicProfile &&
                          !Array.isArray(publicProfile.portfolioProjects)
                            ? "Máy chủ chưa trả dữ liệu Portfolio. Vui lòng cập nhật backend."
                            : "Chưa có dự án Portfolio trong hồ sơ."}
                        </p>
                      )}
                    </section>
                  </div>
                )}
                {tab === "proposal" && (
                  <div role="tabpanel">
                    <dl className="client-proposal-facts">
                      <div>
                        <dt>Ngân sách đề xuất</dt>
                        <dd>{amount}</dd>
                      </div>
                      <div>
                        <dt>Thời gian dự kiến</dt>
                        <dd>{value.estimatedDays} ngày</dd>
                      </div>
                    </dl>
                    <dl className="client-proposal-meta">
                      <div>
                        <dt>Ngày gửi</dt>
                        <dd>
                          {new Date(value.submittedAt).toLocaleString("vi-VN")}
                        </dd>
                      </div>
                      <div>
                        <dt>Job liên quan</dt>
                        <dd>{value.jobTitle}</dd>
                      </div>
                    </dl>
                    <section className="client-proposal-letter">
                      <h3>Thư ứng tuyển</h3>
                      <p>{value.coverLetter}</p>
                    </section>
                  </div>
                )}
                {tab === "cv" && (
                  <div role="tabpanel">
                    <ProposalCvAttachment key={value.id} value={value} />
                  </div>
                )}
              </>
            )
          )}
          <ErrorView
            error={error}
            retry={busy ? undefined : () => setRetry((number) => number + 1)}
          />
        </div>
        <div className="form-actions proposal-modal-actions">
          <button
            className="secondary-button"
            disabled={busy}
            onClick={dismiss}
          >
            Đóng
          </button>
          {!loading && permitted && (
            <>
              <button
                className="secondary-button"
                disabled={busy}
                onClick={() => void act(false)}
              >
                Từ chối
              </button>
              <button
                className="primary-button"
                disabled={busy}
                onClick={() => void act(true)}
              >
                {busy ? "Đang xử lý..." : "Chấp nhận"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
export function SubmitProposal({
  job,
  user,
  cvs = [],
  uploadCvFile,
  initialOpen = false,
  onDismiss,
  onSubmitted,
}: {
  job: Job;
  user: AuthUser;
  cvs?: { id: string; title: string }[];
  uploadCvFile?: (file: File) => Promise<{ id: string; title: string } | null>;
  initialOpen?: boolean;
  onDismiss?: () => void;
  onSubmitted?: (proposal: Proposal) => void;
}) {
  const [open, setOpen] = useState(initialOpen);
  const [cover, setCover] = useState("");
  const [budget, setBudget] = useState("");
  const [days, setDays] = useState("");
  const [cvList, setCvList] = useState(cvs);
  const [selectedCv, setSelectedCv] = useState("");
  const [cvBusy, setCvBusy] = useState(false);
  const [cvError, setCvError] = useState("");
  const [cvReload, setCvReload] = useState(0);
  const [uploadingCv, setUploadingCv] = useState(false);
  const cvInput = useRef<HTMLInputElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const flight = useRef(false);
  const uploadFlight = useRef(false);
  const [saved, setSaved] = useState<Proposal | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const dismiss = () => {
    if (!flight.current && !uploadFlight.current) {
      setOpen(false);
      onDismiss?.();
    }
  };
  useEffect(() => {
    if (!open) return;
    let alive = true;
    setCvBusy(true);
    setCvError("");
    cvApi
      .mine()
      .then((items) => {
        if (!alive) return;
        const values = items.map((cv) => ({
          id: String(cv.id),
          title: cv.fileName,
        }));
        setCvList(values);
        setSelectedCv((previous) =>
          values.some((cv) => cv.id === previous) ? previous : "",
        );
      })
      .catch((e) => {
        if (alive) setCvError(message(e));
      })
      .finally(() => {
        if (alive) setCvBusy(false);
      });
    return () => {
      alive = false;
    };
  }, [open, user.id, cvReload]);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    const padding = document.body.style.paddingRight;
    const gap = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (gap > 0)
      document.body.style.paddingRight =
        parseFloat(getComputedStyle(document.body).paddingRight) + gap + "px";
    const root = document.getElementById("root");
    const inert = root?.inert;
    if (root) root.inert = true;
    dialog.current?.focus();
    const keys = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        dismiss();
      }
      if (event.key !== "Tab") return;
      const nodes = Array.from(
        dialog.current?.querySelectorAll<HTMLElement>(
          "button:not(:disabled), input:not(:disabled):not([hidden]), select:not(:disabled), textarea:not(:disabled), a[href]",
        ) || [],
      );
      const first = nodes[0],
        last = nodes[nodes.length - 1];
      if (!first) {
        event.preventDefault();
        return;
      }
      if (
        event.shiftKey &&
        (document.activeElement === first ||
          document.activeElement === dialog.current)
      ) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last ||
          document.activeElement === dialog.current)
      ) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", keys);
    return () => {
      document.removeEventListener("keydown", keys);
      document.body.style.overflow = overflow;
      document.body.style.paddingRight = padding;
      if (root) root.inert = inert ?? false;
      previous?.focus({ preventScroll: true });
    };
  }, [open]);
  const onCvChange = async (file?: File) => {
    if (!file || uploadFlight.current) return;
    if (
      !file.name.toLowerCase().endsWith(".pdf") ||
      (file.type && file.type !== "application/pdf") ||
      !file.size ||
      file.name.length > 255 ||
      file.size > 2 * 1024 * 1024
    ) {
      setCvError(
        "Vui lòng chọn CV PDF không rỗng, không quá 2 MB; tên tệp tối đa 255 ký tự.",
      );
      if (cvInput.current) cvInput.current.value = "";
      return;
    }
    uploadFlight.current = true;
    setUploadingCv(true);
    setCvError("");
    try {
      const result = uploadCvFile
        ? await uploadCvFile(file)
        : await cvApi
            .upload(file)
            .then((cv) => ({ id: String(cv.id), title: cv.fileName }));
      if (!result) throw new Error("Không thể tải CV lên. Vui lòng thử lại.");
      setCvList((items) => [
        ...items.filter((cv) => cv.id !== result.id),
        result,
      ]);
      setSelectedCv(result.id);
      setCvReload((value) => value + 1);
    } catch (e) {
      setCvError(message(e));
    } finally {
      uploadFlight.current = false;
      setUploadingCv(false);
      if (cvInput.current) cvInput.current.value = "";
    }
  };
  const submit = async () => {
    if (flight.current || saved || uploadFlight.current || cvBusy) return;
    flight.current = true;
    setBusy(true);
    setError("");
    try {
      if (selectedCv && !cvList.some((cv) => cv.id === selectedCv))
        throw new Error(
          "CV đang chọn không còn trong danh sách. Vui lòng tải lại.",
        );
      const input = proposalInput(cover, budget, days, selectedCv);
      const result = await proposalsApi.submit(job.id, input);
      setSaved(result);
      setOpen(false);
      onSubmitted?.(result);
    } catch (e) {
      setError(message(e));
    } finally {
      flight.current = false;
      setBusy(false);
    }
  };
  const cvName = (title: string, index: number) =>
    /^[0-9a-f]{8}-[0-9a-f-]{27,}/i.test(title)
      ? "CV đã lưu " + (index + 1) + ".pdf"
      : title.length > 55
        ? title.slice(0, 48) + "… .pdf"
        : title;
  if (saved)
    return (
      <div className="business-note" role="status">
        <strong>
          Đã gửi Proposal #{saved.id} · {proposalLabels[saved.status]}
        </strong>
        <p>Bạn có thể xem hoặc rút tại “Đề xuất đã gửi”.</p>
      </div>
    );
  if (!canSubmit(user, job)) return null;
  return (
    <>
      {!initialOpen && (
        <button
          type="button"
          className="primary-button proposal-cta"
          onClick={() => setOpen(true)}
        >
          Gửi Proposal
        </button>
      )}
      {open &&
        createPortal(
          <div
            className="modal-overlay"
            role="presentation"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) dismiss();
            }}
          >
            <div
              ref={dialog}
              tabIndex={-1}
              className="modal-content proposal-submit-modal proposal-compose-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="proposal-submit-title"
            >
              <div className="modal-header proposal-modal-header">
                <div>
                  <h2 id="proposal-submit-title">Gửi Proposal ứng tuyển</h2>
                  <p>{job.title}</p>
                </div>
                <button
                  type="button"
                  className="proposal-modal-close"
                  aria-label="Đóng"
                  disabled={busy || uploadingCv}
                  onClick={dismiss}
                >
                  ×
                </button>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void submit();
                }}
              >
                <div className="proposal-compose-body">
                  <div className="form-grid">
                    <div className="full proposal-cv-field">
                      <label htmlFor="proposal-cv-select">
                        CV trong hồ sơ (PDF)
                      </label>
                      <div className="proposal-cv-controls">
                        <select
                          id="proposal-cv-select"
                          value={selectedCv}
                          onChange={(e) => setSelectedCv(e.target.value)}
                          disabled={busy || uploadingCv || cvBusy}
                        >
                          <option value="">
                            {cvBusy ? "Đang tải CV..." : "Không đính kèm CV"}
                          </option>
                          {cvList.map((cv, index) => (
                            <option key={cv.id} value={cv.id}>
                              {cvName(cv.title, index)}
                            </option>
                          ))}
                        </select>
                        <input
                          ref={cvInput}
                          type="file"
                          accept=".pdf,application/pdf"
                          hidden
                          onChange={(e) => void onCvChange(e.target.files?.[0])}
                        />
                        <button
                          type="button"
                          className="secondary-button"
                          disabled={busy || uploadingCv || cvBusy}
                          onClick={() => cvInput.current?.click()}
                        >
                          {uploadingCv ? "Đang tải..." : "Tải CV mới"}
                        </button>
                      </div>
                      <ErrorView
                        error={cvError}
                        retry={
                          uploadingCv
                            ? undefined
                            : () => setCvReload((value) => value + 1)
                        }
                      />
                      {!cvBusy && !cvError && !cvList.length && (
                        <small>
                          Chưa có CV. Tải PDF mới hoặc cập nhật tại{" "}
                          <a href="#/dashboard/Hồ sơ của tôi">
                            Hồ sơ Freelancer
                          </a>
                          .
                        </small>
                      )}
                      <small>
                        CV là tùy chọn. CV được chọn sẽ được gắn cố định với
                        Proposal và chỉ chia sẻ cho Client chủ Job. CV đã đính
                        kèm được giữ lại, không thể xóa trong hồ sơ; tải CV mới
                        sẽ không thay đổi Proposal cũ.
                      </small>
                    </div>
                    <label className="full">
                      Thư ứng tuyển *
                      <textarea
                        required
                        maxLength={20000}
                        disabled={busy}
                        value={cover}
                        onChange={(e) => setCover(e.target.value)}
                      />
                    </label>
                    <label>
                      Ngân sách đề xuất ({job.currencyCode}) *
                      <input
                        required
                        inputMode="decimal"
                        disabled={busy}
                        value={budget}
                        onChange={(e) => setBudget(e.target.value)}
                        placeholder="15000000"
                      />
                    </label>
                    <label>
                      Số ngày dự kiến *
                      <input
                        required
                        inputMode="numeric"
                        disabled={busy}
                        value={days}
                        onChange={(e) => setDays(e.target.value)}
                      />
                    </label>
                  </div>
                  <ErrorView error={error} />
                </div>
                <div className="form-actions proposal-modal-actions">
                  <button
                    className="secondary-button"
                    type="button"
                    disabled={busy || uploadingCv}
                    onClick={dismiss}
                  >
                    Hủy
                  </button>
                  <button
                    className="primary-button"
                    disabled={busy || uploadingCv || cvBusy}
                  >
                    {busy ? "Đang gửi..." : "Gửi Proposal"}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
function SentProposalDialog({
  close,
  children,
  title = "Chi tiết đề xuất",
}: {
  close: () => void;
  children: ReactNode;
  title?: string;
}) {
  const dialog = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusBack =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    dialog.current?.focus();
    return () => {
      document.body.style.overflow = previous;
      focusBack?.focus();
    };
  }, []);
  return createPortal(
    <div
      className="sent-proposal-backdrop"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        className="sent-proposal-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        ref={dialog}
        tabIndex={-1}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            close();
          }
        }}
      >
        <header className="sent-proposal-dialog-header">
          <div>
            <h2>{title}</h2>
          </div>
          <button
            type="button"
            className="sent-proposal-close"
            onClick={close}
            aria-label="Đóng cửa sổ"
          >
            ×
          </button>
        </header>
        <div className="sent-proposal-dialog-body">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
export function SentJobDetailContent({ jobId }: { jobId: number }) {
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    jobApi
      .detail(jobId)
      .then((value) => {
        if (active) setJob(value);
      })
      .catch((cause) => {
        if (active) setError(message(cause));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [jobId]);
  return (
    <div className="sent-job-detail">
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorView
          error={
            "Không thể xem thông tin công việc này. Bạn có thể không còn quyền xem dự án này. " +
            error
          }
        />
      ) : (
        job && (
          <>
            <div className="sent-job-detail-heading">
              <h2>{job.title}</h2>
              <p>{job.companyName || "Doanh nghiệp trên LinkIT"}</p>
            </div>
            <dl className="sent-job-detail-facts">
              <div>
                <dt>Ngân sách dự án</dt>
                <dd>
                  {money(job.budgetMin, job.currencyCode)} –{" "}
                  {money(job.budgetMax, job.currencyCode)}
                </dd>
              </div>
              <div>
                <dt>Hạn dự án</dt>
                <dd>
                  {job.deadline
                    ? new Date(job.deadline).toLocaleDateString("vi-VN")
                    : "Chưa cập nhật"}
                </dd>
              </div>
            </dl>
            <section>
              <h3>Mô tả dự án</h3>
              <p>{job.description || "Chưa có mô tả."}</p>
            </section>
            <section>
              <h3>Kỹ năng yêu cầu</h3>
              <div className="sent-job-detail-skills">
                {job.skills.length
                  ? job.skills.map((skill) => (
                      <span key={skill.skillId}>{skill.name}</span>
                    ))
                  : "Chưa có kỹ năng yêu cầu."}
              </div>
            </section>
            <section>
              <h3>Sản phẩm cần bàn giao</h3>
              <p>{job.deliverables || "Chưa cập nhật."}</p>
            </section>
            <section>
              <h3>Tiêu chí nghiệm thu</h3>
              <p>{job.acceptanceCriteria || "Chưa cập nhật."}</p>
            </section>
          </>
        )
      )}
    </div>
  );
}
function SentJobDetailDialog({
  jobId,
  close,
}: {
  jobId: number;
  close: () => void;
}) {
  return (
    <SentProposalDialog close={close} title="Thông tin dự án">
      <SentJobDetailContent jobId={jobId} />
    </SentProposalDialog>
  );
}
export default function Proposals({
  user,
  job,
  changed,
}: {
  user: AuthUser;
  job?: Job;
  changed?: () => void;
}) {
  const [status, setStatus] = useState<ProposalStatus | "">("");
  const [page, setPage] = useState(0);
  const [reload, setReload] = useState(0);
  const [data, setData] = useState<Page<ProposalSummary>>(emptyPage);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [jobPreviewId, setJobPreviewId] = useState<number | null>(null);
  const [id, setId] = useState<number | null>(null);
  const [detail, setDetail] = useState<Proposal | null>(null);
  const [detailError, setDetailError] = useState("");
  const allowed = job ? ownsJob(user, job) : user.roles.includes("FREELANCER");
  const clientModal = Boolean(job && ownsJob(user, job));
  const readTarget = () => {
    const query = new URLSearchParams(window.location.hash.split("?")[1] || "");
    if (job && query.get("jobId") !== String(job.id)) return null;
    const raw = query.get("proposalId");
    return raw && /^[1-9]\d*$/.test(raw) && Number.isSafeInteger(Number(raw))
      ? Number(raw)
      : null;
  };
  const target = useRef<number | null>(readTarget());
  const [modalOpen, setModalOpen] = useState(!!target.current);
  const [sentModalOpen, setSentModalOpen] = useState(
    !clientModal && !!target.current,
  );
  useEffect(() => {
    const sync = () => {
      target.current = readTarget();
      if (target.current) {
        setId(target.current);
        if (clientModal) setModalOpen(true);
        else setSentModalOpen(true);
      }
    };
    sync();
    window.addEventListener("popstate", sync);
    window.addEventListener("hashchange", sync);
    return () => {
      window.removeEventListener("popstate", sync);
      window.removeEventListener("hashchange", sync);
    };
  }, [job?.id, user.id]);
  useEffect(() => {
    if (!allowed) return;
    let alive = true;
    setBusy(true);
    setError("");
    setData(emptyPage());
    const filter = { page, size: 20, status: status || undefined };
    (job ? proposalsApi.forJob(job.id, filter) : proposalsApi.mine(filter))
      .then((value) => {
        if (alive) {
          setData(value);
          setId(
            (previous) =>
              target.current ??
              (value.content.some((p) => p.id === previous)
                ? previous
                : clientModal
                  ? (value.content[0]?.id ?? null)
                  : null),
          );
        }
      })
      .catch((e) => {
        if (alive) setError(message(e));
      })
      .finally(() => {
        if (alive) setBusy(false);
      });
    return () => {
      alive = false;
    };
  }, [allowed, job?.id, job?.version, user.id, status, page, reload]);
  useEffect(() => {
    if (clientModal) return;
    let alive = true;
    setDetail(null);
    setDetailError("");
    if (allowed && id)
      proposalsApi
        .detail(id)
        .then((value) => {
          if (alive) setDetail(value);
        })
        .catch((e) => {
          if (alive) setDetailError(message(e));
        });
    return () => {
      alive = false;
    };
  }, [allowed, id, reload, user.id, job?.version, clientModal]);
  if (!allowed)
    return <ErrorView error="Bạn không có quyền xem Proposal này." />;
  const refresh = () => {
    setDetail(null);
    setReload((n) => n + 1);
    changed?.();
  };
  const openDetail = (proposalId: number) => {
    target.current = proposalId;
    const query = new URLSearchParams(window.location.hash.split("?")[1] || "");
    query.set("proposalId", String(proposalId));
    window.history.replaceState(
      window.history.state,
      "",
      window.location.hash.split("?")[0] + "?" + query,
    );
    setId(proposalId);
    if (clientModal) setModalOpen(true);
    else setSentModalOpen(true);
  };
  const list = (
    <>
      {clientModal ? (
        <div className="proposal-client-heading">
          <h2>Danh sách đề xuất</h2>
        </div>
      ) : (
        <div className="management-head">
          <h2>Đề xuất đã gửi</h2>
        </div>
      )}
      <div className="proposal-rank-toolbar">
        <StatusFilter
          value={status}
          change={(v) => {
            setStatus(v);
            setPage(0);
          }}
        />

        <button className="secondary-button" disabled={busy} onClick={refresh}>
          <RefreshCw size={15} /> Tải lại
        </button>
      </div>
      <ErrorView error={error} retry={refresh} />
      {busy ? (
        <Loading />
      ) : (
        !error && (
          <>
            {data.content.length ? (
              clientModal ? (
                <div className="proposal-ranking-table-wrap">
                  <table className="proposal-ranking-table">
                    <caption className="sr-only">
                      Danh sách ứng viên xếp hạng theo sao trung bình và số đánh
                      giá
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col">Ứng viên</th>
                        <th scope="col">Đánh giá</th>
                        <th scope="col">Ngân sách đề xuất</th>
                        <th scope="col">Thời gian</th>
                        <th scope="col">Trạng thái</th>
                        <th scope="col">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.content.map((value, index) => (
                        <tr key={value.id}>
                          <td data-label="Ứng viên">
                            <div className="proposal-table-person">
                              <span className="proposal-table-rank">
                                {String(page * 20 + index + 1).padStart(2, "0")}
                              </span>
                              <span
                                className="proposal-ranked-avatar"
                                aria-hidden="true"
                              >
                                {value.freelancerName
                                  .trim()
                                  .charAt(0)
                                  .toUpperCase() || "F"}
                              </span>
                              <div>
                                <button
                                  type="button"
                                  className="proposal-table-name"
                                  onClick={() => openDetail(value.id)}
                                >
                                  {value.freelancerName}
                                </button>
                                <small>Đề xuất #{value.id}</small>
                              </div>
                            </div>
                          </td>
                          <td data-label="Đánh giá">
                            <FreelancerRating
                              averageRating={value.averageRating}
                              reviewCount={value.reviewCount}
                              compact
                            />
                          </td>
                          <td data-label="Ngân sách">
                            <strong className="proposal-table-value">
                              {money(
                                value.proposedBudget,
                                job?.currencyCode || "",
                              )}
                            </strong>
                          </td>
                          <td data-label="Thời gian">
                            <span className="proposal-table-value">
                              {value.estimatedDays} ngày
                            </span>
                          </td>
                          <td data-label="Trạng thái">
                            <b
                              className={`status proposal-status-${value.status.toLowerCase()}`}
                            >
                              {proposalLabels[value.status]}
                            </b>
                          </td>
                          <td data-label="Thao tác">
                            <div className="proposal-table-actions">
                              <button
                                className="secondary-button"
                                type="button"
                                onClick={() => openDetail(value.id)}
                              >
                                Xem hồ sơ & đề xuất <ArrowUpRight size={15} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <table className="management-table sent-proposal-table">
                  <caption className="sr-only">Các đề xuất đã gửi</caption>
                  <thead>
                    <tr>
                      <th scope="col">Công việc</th>
                      <th scope="col">Ngân sách đề xuất</th>
                      <th scope="col">Dự kiến</th>
                      <th scope="col">Ngày gửi</th>
                      <th scope="col">Trạng thái</th>
                      <th scope="col">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.content.map((value) => (
                      <tr key={value.id}>
                        <td data-label="Công việc">
                          <button
                            type="button"
                            className="table-title"
                            title="Xem thông tin dự án"
                            onClick={() => setJobPreviewId(value.jobId)}
                          >
                            {value.jobTitle}
                          </button>
                        </td>
                        <td data-label="Ngân sách đề xuất">
                          <span className="table-number">
                            {money(value.proposedBudget, "").trim()}
                          </span>
                        </td>
                        <td data-label="Dự kiến">
                          <span className="table-number">
                            {value.estimatedDays} ngày
                          </span>
                        </td>
                        <td data-label="Ngày gửi">
                          <time
                            className="table-number"
                            dateTime={value.submittedAt}
                          >
                            {new Date(value.submittedAt).toLocaleDateString(
                              "vi-VN",
                            )}
                          </time>
                        </td>
                        <td data-label="Trạng thái">
                          <b
                            className={`status proposal-status-${value.status.toLowerCase()}`}
                          >
                            {proposalLabels[value.status]}
                          </b>
                        </td>
                        <td data-label="Thao tác">
                          <button
                            className="secondary-button"
                            onClick={() => openDetail(value.id)}
                          >
                            Chi tiết
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            ) : (
              <Empty text="Chưa có đề xuất phù hợp bộ lọc" />
            )}
            <Paging
              data={data}
              busy={busy}
              change={(next) => {
                setPage(next);
                if (!clientModal) {
                  setId(null);
                  setSentModalOpen(false);
                }
              }}
            />
          </>
        )
      )}
    </>
  );
  const view = (
    <>
      <ErrorView error={detailError} retry={refresh} />
      {!busy &&
        !error &&
        (detail ? (
          <ProposalView
            key={detail.id + ":" + detail.version}
            value={detail}
            user={user}
            changed={refresh}
          />
        ) : id && !detailError ? (
          <Loading />
        ) : null)}
    </>
  );
  return (
    <div
      className={
        "management-page proposals-browser" +
        (!clientModal ? " sent-proposals-page" : "")
      }
    >
      <section
        className={job ? "management-inline" : "panel management-surface"}
      >
        {list}
      </section>
      {!clientModal && jobPreviewId != null && (
        <SentJobDetailDialog
          key={jobPreviewId}
          jobId={jobPreviewId}
          close={() => setJobPreviewId(null)}
        />
      )}
      {!clientModal && sentModalOpen && id && (
        <SentProposalDialog
          close={() => {
            setSentModalOpen(false);
            setId(null);
            target.current = null;
            const query = new URLSearchParams(
              window.location.hash.split("?")[1] || "",
            );
            query.delete("proposalId");
            const queryString = query.toString();
            window.history.replaceState(
              window.history.state,
              "",
              window.location.hash.split("?")[0] +
                (queryString ? "?" + queryString : ""),
            );
          }}
        >
          {view}
        </SentProposalDialog>
      )}
      {clientModal && modalOpen && id && job && (
        <ClientProposalModal
          key={id}
          proposalId={id}
          user={user}
          job={job}
          close={() => setModalOpen(false)}
          changed={refresh}
        />
      )}
    </div>
  );
}

export function Candidates({
  job,
  user,
  changed,
}: {
  job: Job;
  user: AuthUser;
  changed: (job?: Job) => void;
}) {
  const [data, setData] = useState<Page<Candidate>>(emptyPage);
  const [page, setPage] = useState(0);
  const [status, setStatus] = useState<ProposalStatus | "">("");
  const [reload, setReload] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [actionBusy, setActionBusy] = useState(false);
  const [proposalToView, setProposalToView] = useState<number | null>(null);
  const flight = useRef(false);
  const selected = useRef(false);
  const allowed = ownsJob(user, job);
  useEffect(() => {
    if (!allowed) return;
    let alive = true;
    setBusy(true);
    setError("");
    setData(emptyPage());
    matchingApi
      .candidates(job.id, { page, size: 20, status: status || undefined })
      .then((value) => {
        if (alive) setData(value);
      })
      .catch((e) => {
        if (alive) setError(message(e));
      })
      .finally(() => {
        if (alive) setBusy(false);
      });
    return () => {
      alive = false;
    };
  }, [allowed, job.id, job.version, user.id, page, status, reload]);
  const select = async (candidate: Candidate) => {
    if (
      flight.current ||
      selected.current ||
      !canSelect(user, job, candidate) ||
      !window.confirm(
        `Chọn ${candidate.fullName}? Các đề xuất đang chờ khác sẽ bị từ chối.`,
      )
    )
      return;
    flight.current = true;
    setActionBusy(true);
    setError("");
    try {
      const result = await selectAndReload(
        candidate.proposalId,
        `"${candidate.proposalVersion}"`,
        (id) => {
          selected.current = true;
          setSuccess(`Đã tạo dự án #${id}. Đang cập nhật dữ liệu...`);
        },
      );
      setSuccess(
        `Đã chọn Freelancer. Dự án #${result.assignment.id}: ${assignmentLabels[result.assignment.status]}.`,
      );
      changed(result.job);
    } catch (e) {
      setError(
        (selected.current
          ? "Đã chọn ứng viên; chưa tải lại đủ dữ liệu. Không chọn lại. "
          : "") + message(e),
      );
    } finally {
      flight.current = false;
      setActionBusy(false);
    }
  };
  if (!allowed) return null;
  return (
    <section className="candidate-rank-page">
      <div className="proposal-client-head">
        <div>
          <span className="proposal-eyebrow">SO SÁNH ỨNG VIÊN</span>
          <h2>Ứng viên nổi bật theo đánh giá</h2>
          <p>
            Sắp xếp theo sao trung bình từ các dự án hoàn thành, sau đó theo số
            lượt đánh giá.
          </p>
        </div>
        <div className="proposal-client-total">
          <strong>{data.totalElements}</strong>
          <span>Ứng viên</span>
        </div>
      </div>
      <div className="proposal-rank-toolbar">
        <StatusFilter
          value={status}
          change={(value) => {
            setStatus(value);
            setPage(0);
          }}
        />
        <p>
          <Star size={15} fill="currentColor" /> Đánh giá thực tế · Ưu tiên cao
          nhất
        </p>
      </div>
      {success && (
        <p role="status" className="quality-note">
          {success}
        </p>
      )}
      <ErrorView
        error={error}
        retry={() => {
          setReload((n) => n + 1);
          changed();
        }}
      />
      {busy ? (
        <Loading />
      ) : (
        !error && (
          <>
            <div className="candidate-rank-grid">
              {data.content.map((value, index) => (
                <article className="candidate-rank-card" key={value.proposalId}>
                  <div className="candidate-rank-card-header">
                    <span className="candidate-rank-position">
                      #{page * 20 + index + 1}
                    </span>
                    <b
                      className={`status proposal-status-${value.proposalStatus.toLowerCase()}`}
                    >
                      {proposalLabels[value.proposalStatus]}
                    </b>
                  </div>
                  <div className="candidate-rank-identity">
                    <span className="candidate-rank-avatar" aria-hidden="true">
                      {value.fullName.trim().charAt(0).toUpperCase() || "F"}
                    </span>
                    <div>
                      <h3>{value.fullName}</h3>
                      <p>{value.headline || "Freelancer"}</p>
                    </div>
                  </div>
                  <div className="candidate-rank-rating">
                    <span>Đánh giá từ dự án đã hoàn thành</span>
                    <FreelancerRating
                      averageRating={value.averageRating}
                      reviewCount={value.reviewCount}
                    />
                  </div>
                  <div className="candidate-rank-facts">
                    <div>
                      <span>Ngân sách đề xuất</span>
                      <strong>
                        {money(value.proposedBudget, value.currencyCode)}
                      </strong>
                    </div>
                    <div>
                      <span>Thời gian dự kiến</span>
                      <strong>
                        <Clock3 size={15} />
                        {value.estimatedDays} ngày
                      </strong>
                    </div>
                  </div>
                  <div className="candidate-rank-actions">
                    <button
                      className="secondary-button"
                      onClick={() => setProposalToView(value.proposalId)}
                    >
                      Xem đề xuất <ArrowUpRight size={15} />
                    </button>
                    {canSelect(user, job, value) && (
                      <button
                        className="primary-button"
                        disabled={actionBusy || selected.current}
                        onClick={() => void select(value)}
                      >
                        Chọn ứng viên
                      </button>
                    )}
                  </div>
                  {!value.selectable &&
                    value.ineligibilityReasons.length > 0 && (
                      <small className="quality-note">
                        Không thể chọn: {value.ineligibilityReasons.join(", ")}
                      </small>
                    )}
                </article>
              ))}
            </div>
            {!data.content.length && (
              <Empty text="Chưa có ứng viên phù hợp bộ lọc" />
            )}
            <Paging data={data} busy={busy || actionBusy} change={setPage} />
          </>
        )
      )}
      {proposalToView !== null && (
        <ClientProposalModal
          key={proposalToView}
          proposalId={proposalToView}
          job={job}
          user={user}
          close={() => setProposalToView(null)}
          changed={() => {
            setReload((n) => n + 1);
            changed();
          }}
        />
      )}
    </section>
  );
}
export function Assignments({
  user,
  openWorkspace = openAssignmentWorkspace,
  navigate,
  viewRole,
  listMode = "work",
}: {
  user: AuthUser;
  openWorkspace?: (id: number) => void;
  navigate?: (page: string) => void;
  viewRole?: "Client" | "Freelancer" | "Admin";
  listMode?: "work" | "workspace";
}) {
  const [data, setData] = useState<Page<Assignment>>(emptyPage);
  const [page, setPage] = useState(0);
  const [status, setStatus] = useState<AssignmentStatus | "">("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);
  const [reload, setReload] = useState(0);
  const freelancer = viewRole
    ? viewRole === "Freelancer"
    : user.roles.includes("FREELANCER") && !user.roles.includes("CLIENT");
  const clientView = viewRole
    ? viewRole === "Client"
    : user.roles.includes("CLIENT") && !user.roles.includes("ADMIN");
  const [summary, setSummary] = useState<{
    total: number;
    active: number;
    completed: number;
  } | null>(null);
  useEffect(() => {
    if (!freelancer || listMode !== "workspace") return;
    let mounted = true;
    const count = (status?: AssignmentStatus) =>
      assignmentsApi
        .list({ page: 0, size: 1, status })
        .then((result) => result.totalElements);
    Promise.all([
      count(),
      count("ACTIVE"),
      count("AWAITING_ACCEPTANCE"),
      count("COMPLETED"),
    ])
      .then(([total, active, awaiting, completed]) => {
        if (mounted)
          setSummary({ total, active: active + awaiting, completed });
      })
      .catch(() => {
        if (mounted) setSummary(null);
      });
    return () => {
      mounted = false;
    };
  }, [freelancer, listMode, user.id, reload]);

  useEffect(() => {
    let alive = true;
    setBusy(true);
    setError("");
    setData(emptyPage());
    assignmentsApi
      .list({ page, size: 20, status: status || undefined })
      .then((value) => {
        if (
          !value ||
          !Array.isArray(value.content) ||
          value.content.some((a) => !a || typeof a.id !== "number")
        ) {
          throw new Error(
            "Dữ liệu danh sách dự án không hợp lệ. Vui lòng tải lại.",
          );
        }
        if (
          clientView &&
          value.content.some((item) => item.clientId !== user.id)
        )
          throw new Error("Danh sách dự án không thuộc quyền sở hữu của bạn.");
        if (alive) setData(value);
      })
      .catch((e) => {
        if (alive) setError(message(e));
      })
      .finally(() => {
        if (alive) setBusy(false);
      });
    return () => {
      alive = false;
    };
  }, [page, status, user.id, reload, clientView]);
  const empty = !busy && !error && !data.content.length;
  const filtered = !!status || page > 0;
  if (clientView)
    return (
      <div className="management-page client-project-list">
        <section className="panel management-surface">
          <div className="management-head">
            <div>
              <h1>Không gian dự án</h1>
            </div>
            <button
              className="secondary-button"
              disabled={busy}
              onClick={() => setReload((value) => value + 1)}
            >
              Tải lại
            </button>
          </div>
          <div className="management-toolbar">
            <label>
              Trạng thái
              <select
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value as AssignmentStatus | "");
                  setPage(0);
                }}
              >
                {[
                  ["", "Tất cả dự án"],
                  ...Object.entries(assignmentLabels),
                ].map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <ErrorView
            error={error}
            retry={() => setReload((value) => value + 1)}
          />
          {busy ? (
            <Loading />
          ) : (
            !error &&
            (data.content.length ? (
              <>
                <table className="management-table linkit-client-data-table">
                  <caption className="sr-only">
                    Danh sách dự án Client sở hữu
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Tên dự án</th>
                      <th scope="col">Freelancer</th>
                      <th scope="col">Trạng thái</th>
                      <th scope="col">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.content.map((project) => (
                      <tr key={project.id}>
                        <td data-label="Tên dự án">
                          <button
                            className="table-title"
                            onClick={() => openWorkspace(project.id)}
                          >
                            {project.jobTitle}
                          </button>
                        </td>
                        <td data-label="Freelancer">
                          {project.freelancerName}
                        </td>
                        <td data-label="Trạng thái">
                          <b
                            className={
                              "status assignment-status-" +
                              project.status.toLowerCase()
                            }
                          >
                            {assignmentLabels[project.status]}
                          </b>
                        </td>
                        <td data-label="Thao tác">
                          <button
                            className="secondary-button"
                            onClick={() => openWorkspace(project.id)}
                          >
                            Mở dự án
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <Paging data={data} busy={busy} change={setPage} />
              </>
            ) : (
              <div className="proposal-empty">
                <Inbox />
                <strong>
                  {filtered
                    ? "Không có dự án phù hợp bộ lọc"
                    : "Bạn chưa có dự án nào"}
                </strong>
                <span>
                  {filtered
                    ? "Chọn trạng thái khác để xem các dự án của bạn."
                    : "Dự án sẽ được tạo sau khi bạn chọn Freelancer từ đề xuất ứng tuyển."}
                </span>
                {filtered ? (
                  <button
                    className="secondary-button"
                    onClick={() => {
                      setStatus("");
                      setPage(0);
                    }}
                  >
                    Xem tất cả
                  </button>
                ) : (
                  navigate && (
                    <button
                      className="primary-button"
                      onClick={() => navigate("Quản lý công việc")}
                    >
                      Quản lý Job & đề xuất
                    </button>
                  )
                )}
              </div>
            ))
          )}
        </section>
      </div>
    );
  const projectTabs: { label: string; value: AssignmentStatus | "" }[] =
    listMode === "workspace"
      ? [
          { label: "Tất cả", value: "" },
          { label: "Đang thực hiện", value: "ACTIVE" },
          { label: "Chờ nghiệm thu", value: "AWAITING_ACCEPTANCE" },
          { label: "Đã hoàn thành", value: "COMPLETED" },
        ]
      : [
          { label: "Tất cả", value: "" },
          { label: "Chờ bắt đầu", value: "PENDING_SCOPE" },
          { label: "Đang thực hiện", value: "ACTIVE" },
          { label: "Đã hoàn thành", value: "COMPLETED" },
        ];

  if (
    status === "CANCELLED" &&
    !projectTabs.some((tab) => tab.value === status)
  )
    projectTabs.push({ label: "Đã hủy", value: "CANCELLED" });
  return (
    <div
      className={`linkit-project-screen ${listMode === "workspace" ? "linkit-project-workspace" : "linkit-project-work"}`}
    >
      <header className="linkit-project-heading">
        <span className="linkit-project-heading-icon" aria-hidden="true">
          {listMode === "workspace" ? (
            <BriefcaseBusiness size={25} />
          ) : (
            <FolderKanban size={25} />
          )}
        </span>
        <h1>
          {listMode === "workspace" ? "Không gian dự án" : "Công việc của tôi"}
        </h1>
      </header>
      {listMode === "workspace" && (
        <div className="linkit-project-stat-grid" aria-label="Tổng quan dự án">
          {[
            { label: "Tổng dự án", value: summary?.total, icon: Layers3 },
            { label: "Đang thực hiện", value: summary?.active, icon: Clock3 },
            {
              label: "Đã hoàn thành",
              value: summary?.completed,
              icon: CheckCircle2,
            },
          ].map((item) => (
            <div className="linkit-project-stat" key={item.label}>
              <span className="linkit-project-stat-icon" aria-hidden="true">
                <item.icon size={23} />
              </span>
              <div>
                <span>{item.label}</span>
                <strong>{item.value ?? "—"}</strong>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="linkit-project-toolbar">
        <div
          className="linkit-project-tabs"
          role="group"
          aria-label="Lọc trạng thái"
        >
          {projectTabs.map((tab) => (
            <button
              type="button"
              key={tab.label}
              className={status === tab.value ? "is-active" : ""}
              aria-pressed={status === tab.value}
              disabled={busy}
              onClick={() => {
                setStatus(tab.value);
                setPage(0);
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="linkit-project-reload"
          disabled={busy}
          onClick={() => setReload((n) => n + 1)}
        >
          <RefreshCw size={16} aria-hidden="true" />
          Tải lại
        </button>
      </div>
      <ErrorView error={error} retry={() => setReload((n) => n + 1)} />
      {busy ? (
        <Loading />
      ) : empty ? (
        <div className="linkit-project-empty">
          <span className="linkit-project-empty-icon">
            <Inbox size={28} />
          </span>
          <h2>
            {filtered ? "Không có dự án ở trạng thái này" : "Chưa có dự án"}
          </h2>
          <p>
            {filtered
              ? "Chọn trạng thái khác để xem các dự án."
              : "Dự án sẽ xuất hiện khi Client chấp nhận đề xuất của bạn."}
          </p>
          {filtered ? (
            <button
              type="button"
              className="linkit-project-reload"
              onClick={() => {
                setStatus("");
                setPage(0);
              }}
            >
              Xem tất cả
            </button>
          ) : (
            navigate && (
              <button
                type="button"
                className="linkit-project-primary"
                onClick={() => navigate("Tìm việc")}
              >
                Khám phá công việc <ArrowUpRight size={15} />
              </button>
            )
          )}
        </div>
      ) : (
        !error && (
          <>
            <div className="linkit-project-cards">
              {data.content.map((value) => (
                <article className="linkit-project-card" key={value.id}>
                  <div className="linkit-project-card-icon" aria-hidden="true">
                    <Layers3 size={24} />
                  </div>
                  <div className="linkit-project-card-info">
                    <h2>{value.jobTitle}</h2>
                    <div className="linkit-project-company">
                      <Building2 size={15} aria-hidden="true" />
                      <span>{value.companyName || "Client trên LinkIT"}</span>
                    </div>
                    {listMode === "work" && (
                      <div className="linkit-project-card-metrics">
                        <span>
                          <Wallet size={16} aria-hidden="true" />
                          <b>{money(value.agreedBudget, value.currencyCode)}</b>
                        </span>
                        {value.startedAt && (
                          <span>
                            <CalendarDays size={16} aria-hidden="true" />
                            <span>
                              Bắt đầu{" "}
                              {new Date(value.startedAt).toLocaleDateString(
                                "vi-VN",
                              )}
                            </span>
                          </span>
                        )}
                        <span>
                          <Clock3 size={16} aria-hidden="true" />
                          <span>
                            Tạo{" "}
                            {new Date(value.createdAt).toLocaleDateString(
                              "vi-VN",
                            )}
                          </span>
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="linkit-project-card-actions">
                    <span
                      className={`linkit-project-badge is-${value.status.toLowerCase()}`}
                    >
                      {value.status === "COMPLETED" && (
                        <CheckCircle2 size={15} aria-hidden="true" />
                      )}
                      {assignmentLabels[value.status]}
                    </span>
                    <button
                      type="button"
                      className="linkit-project-primary"
                      onClick={() => openWorkspace(value.id)}
                      aria-label={`Mở dự án ${value.jobTitle}`}
                    >
                      Mở dự án <ArrowUpRight size={17} aria-hidden="true" />
                    </button>
                  </div>
                </article>
              ))}
            </div>
            {data.totalPages > 1 && (
              <Paging data={data} busy={busy} change={setPage} />
            )}
          </>
        )
      )}
    </div>
  );
}
