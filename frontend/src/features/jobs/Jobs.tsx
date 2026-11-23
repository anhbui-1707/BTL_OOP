import Proposals, {
  SubmitProposal,
  SentJobDetailContent,
} from "../recruitment/Recruitment";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertCircle,
  Search,
  Plus,
  Inbox,
  LoaderCircle,
  CircleDollarSign,
  Clock3,
  BriefcaseBusiness,
  Bookmark,
} from "lucide-react";
import { ApiError } from "../../api/http";
import {
  clientCompanyApi,
  type PublicClientCompanyProfile,
  type PublicClientOpenJob,
} from "../../api/clientCompany";
import { proposalsApi } from "../../api/recruitment";
import {
  backToClientJobList,
  navigateClientJobs,
  readClientJobRoute,
  type JobTab,
} from "./navigation";
import {
  jobApi,
  type Job,
  type JobSummary,
  type JobFilters,
  type JobStatus,
  type Page,
} from "../../api/jobs";
import { skillsApi, type CatalogSkill } from "../../api/skills";
import type { AuthUser } from "../../api/auth";
import {
  emptyJobForm,
  formFromJob,
  saveJob,
  money,
  chooseSkill,
  type JobForm,
  type SkillChoice,
} from "./model";

const isJobExpired = (deadline: string | null | undefined) => {
  if (!deadline) return false;
  const today = new Date();
  const localDate = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  ].join("-");
  return deadline.slice(0, 10) < localDate;
};

const statuses: Record<JobStatus, string> = {
  DRAFT: "Bản nháp",
  OPEN: "Đang mở",
  ASSIGNED: "Đã giao",
  IN_PROGRESS: "Đang thực hiện",
  COMPLETED: "Đã hoàn thành",
  CANCELLED: "Đã hủy",
  CLOSED: "Đã đóng",
};

const errorMessage = (e: unknown) =>
  e instanceof Error ? e.message : "Không thể tải dữ liệu.";

const emptyPage = <T,>(): Page<T> => ({
  content: [],
  page: 0,
  size: 20,
  totalElements: 0,
  totalPages: 0,
});

function PublicClientCardModal({
  id,
  currentJobId,
  close,
  chooseJob,
}: {
  id: number;
  currentJobId: number;
  close: () => void;
  chooseJob: (id: number) => void;
}) {
  const [previewJobId, setPreviewJobId] = useState<number | null>(null);
  const [profile, setProfile] = useState<PublicClientCompanyProfile | null>(
    null,
  );
  const [jobs, setJobs] = useState<PublicClientOpenJob[]>([]);
  const [error, setError] = useState("");
  const [jobsError, setJobsError] = useState("");
  const [jobsLoading, setJobsLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const dialog = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setJobsError("");
    setJobs([]);
    setJobsLoading(true);
    clientCompanyApi
      .publicDetail(id)
      .then((data) => {
        if (active) setProfile(data);
      })
      .catch((cause) => {
        if (active) setError(errorMessage(cause));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    clientCompanyApi
      .publicJobs(id)
      .then((data) => {
        if (active) setJobs(data.filter((job) => job.id !== currentJobId));
      })
      .catch((cause) => {
        if (active) setJobsError(errorMessage(cause));
      })
      .finally(() => {
        if (active) setJobsLoading(false);
      });
    dialog.current?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      active = false;
      document.body.style.overflow = overflow;
    };
  }, [id, currentJobId]);

  return createPortal(
    <div
      className="modal-overlay public-client-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div
        className={`modal-content public-client-modal${previewJobId != null ? " public-client-modal-job-active" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label="Hồ sơ doanh nghiệp công khai"
        tabIndex={-1}
        ref={dialog}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.stopPropagation();
            close();
          }
        }}
      >
        <div className="public-client-modal-head">
          {previewJobId != null && (
            <button
              type="button"
              className="public-client-job-back"
              onClick={() => setPreviewJobId(null)}
            >
              ← Quay lại danh sách công việc
            </button>
          )}
          {previewJobId == null && (
            <div>
              <span>HỒ SƠ DOANH NGHIỆP</span>
              <h2>{profile?.companyName || "Thông tin doanh nghiệp"}</h2>
              <p>{profile?.industry || "Khách hàng tuyển dụng trên LinkIT"}</p>
            </div>
          )}
          <button
            type="button"
            className="public-client-close"
            onClick={close}
            aria-label="Đóng hồ sơ"
          >
            ×
          </button>
        </div>
        {previewJobId != null ? (
          <div className="public-client-job-preview">
            <SentJobDetailContent key={previewJobId} jobId={previewJobId} />
          </div>
        ) : loading ? (
          <p role="status">Đang tải hồ sơ doanh nghiệp...</p>
        ) : error ? (
          <p role="alert" className="auth-error">
            {error}
          </p>
        ) : (
          profile && (
            <div className="public-client-modal-content">
              <p className="public-client-disclaimer">
                Thông tin do Client tự cung cấp, LinkIT chưa xác minh doanh
                nghiệp.
              </p>
              <dl>
                <div>
                  <dt>Người đại diện</dt>
                  <dd>{profile.representativeName || "Chưa cập nhật"}</dd>
                </div>
                <div>
                  <dt>Chức danh</dt>
                  <dd>{profile.jobTitle || "Chưa cập nhật"}</dd>
                </div>
                <div>
                  <dt>Lĩnh vực hoạt động</dt>
                  <dd>{profile.industry || "Chưa cập nhật"}</dd>
                </div>
                <div>
                  <dt>Địa chỉ / Khu vực</dt>
                  <dd>{profile.location || "Chưa cập nhật"}</dd>
                </div>
                <div>
                  <dt>Website</dt>
                  <dd>
                    {profile.companyWebsite &&
                    /^https?:\/\//i.test(profile.companyWebsite) ? (
                      <a
                        href={profile.companyWebsite}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {profile.companyWebsite}
                      </a>
                    ) : (
                      "Chưa cập nhật"
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Email liên hệ</dt>
                  <dd>
                    {profile.contactEmail ? (
                      <span className="public-client-email">
                        <a href={`mailto:${profile.contactEmail}`}>
                          {profile.contactEmail}
                        </a>
                        <button
                          type="button"
                          onClick={() =>
                            void navigator.clipboard.writeText(
                              profile.contactEmail!,
                            )
                          }
                        >
                          Sao chép
                        </button>
                      </span>
                    ) : (
                      "Chưa cập nhật"
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Điện thoại liên hệ công khai</dt>
                  <dd>
                    {profile.publicContactPhone ? (
                      <span>{profile.publicContactPhone}</span>
                    ) : (
                      "Client chưa công khai số liên hệ"
                    )}
                  </dd>
                </div>
              </dl>
              <section className="public-client-bio">
                <h3>Giới thiệu doanh nghiệp</h3>
                <p>{profile.description || "Chưa cập nhật phần giới thiệu."}</p>
              </section>
              <section className="public-client-open-jobs">
                <h3>
                  Các công việc đang mở{" "}
                  <span>{!jobsError ? jobs.length : ""}</span>
                </h3>
                {jobsLoading ? (
                  <p role="status">Đang tải các công việc khác...</p>
                ) : jobsError ? (
                  <p role="alert">
                    Không thể tải danh sách công việc: {jobsError}
                  </p>
                ) : jobs.length ? (
                  <div className="public-client-job-list">
                    {jobs.map((job) => (
                      <button
                        type="button"
                        key={job.id}
                        onClick={() => setPreviewJobId(job.id)}
                      >
                        <span>
                          <strong>{job.title}</strong>
                          <small>
                            Ngân sách: {money(job.budgetMin, job.currencyCode)}{" "}
                            – {money(job.budgetMax, job.currencyCode)}
                          </small>
                        </span>
                        <span aria-hidden="true">→</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p>Chưa có công việc đang mở khác.</p>
                )}
              </section>
            </div>
          )
        )}
      </div>
    </div>,
    document.body,
  );
}

function SaveJobButton({
  saved,
  pending,
  disabled,
  compact = false,
  toggle,
}: {
  saved: boolean;
  pending: boolean;
  disabled: boolean;
  compact?: boolean;
  toggle: () => void;
}) {
  const label = saved ? "Bỏ lưu" : "Lưu việc";
  return (
    <button
      type="button"
      className={
        compact
          ? "freelancer-save-job"
          : "secondary-button freelancer-save-action"
      }
      title={label}
      aria-label={label}
      aria-pressed={saved}
      aria-busy={pending}
      disabled={disabled || pending}
      onClick={(event) => {
        event.stopPropagation();
        toggle();
      }}
    >
      {pending ? (
        <LoaderCircle size={compact ? 18 : 16} className="saved-job-spinner" />
      ) : (
        <Bookmark
          size={compact ? 18 : 16}
          fill={saved ? "currentColor" : "none"}
        />
      )}
      {!compact && <span>{pending ? "Đang cập nhật…" : label}</span>}
    </button>
  );
}

function ErrorState({ error, retry }: { error: string; retry?: () => void }) {
  if (!error) return null;

  return (
    <div className="auth-error" role="alert">
      <AlertCircle size={16} />
      {error}
      {retry && (
        <button type="button" className="text-button" onClick={retry}>
          Thử lại
        </button>
      )}
    </div>
  );
}

function Pagination({
  data,
  busy,
  change,
}: {
  data: {
    page: number;
    totalPages: number;
    totalElements: number;
  };
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
          type="button"
          disabled={busy || data.page === 0}
          onClick={() => change(data.page - 1)}
        >
          ‹
        </button>
        <button
          type="button"
          disabled={busy || data.page + 1 >= data.totalPages}
          onClick={() => change(data.page + 1)}
        >
          ›
        </button>
      </div>
    </div>
  );
}

export function QualityView({
  job,
  layout = "default",
}: {
  job: Job;
  layout?: "default" | "client";
}) {
  const quality = job.quality;
  const criteria = [
    ["title", "Tiêu đề rõ ràng", 10],
    ["description", "Mô tả công việc", 20],
    ["deliverables", "Sản phẩm bàn giao", 20],
    ["acceptanceCriteria", "Yêu cầu đối với ứng viên", 20],
    ["budget", "Ngân sách", 10],
    ["deadline", "Thời hạn", 10],
    ["skills", "Kỹ năng yêu cầu", 10],
  ] as const;
  const breakdown =
    quality?.breakdown &&
    typeof quality.breakdown === "object" &&
    !Array.isArray(quality.breakdown)
      ? (quality.breakdown as Record<string, unknown>)
      : null;
  const recommendations = Array.isArray(quality?.recommendations)
    ? quality.recommendations.filter(
        (item): item is string => typeof item === "string" && !!item.trim(),
      )
    : null;
  if (layout === "client") {
    const score =
      typeof quality?.score === "number" &&
      Number.isFinite(quality.score) &&
      quality.score >= 0 &&
      quality.score <= 100
        ? quality.score
        : null;
    const evaluated =
      quality?.rulesVersion === "job-quality-v1" && breakdown
        ? criteria.flatMap(([key, label, maximum]) => {
            const points = breakdown[key];
            return typeof points === "number" &&
              Number.isFinite(points) &&
              points >= 0 &&
              points <= maximum
              ? [{ key, label, maximum, points }]
              : [];
          })
        : [];
    const label =
      score === null
        ? "Chưa đánh giá"
        : evaluated.some((item) => item.points < item.maximum)
          ? "Còn tiêu chí cần cải thiện"
          : evaluated.length === criteria.length
            ? "Đã đạt các tiêu chí"
            : "Đã đánh giá";
    return (
      <section
        className="quality-review quality-review-client"
        aria-label="Kết quả đánh giá chất lượng tin"
      >
        <div className="quality-client-score">
          <div
            className="quality-score-ring"
            role="img"
            aria-label={
              score === null
                ? "Chưa có điểm chất lượng"
                : `Điểm chất lượng ${score} trên 100`
            }
          >
            <svg viewBox="0 0 180 180" aria-hidden="true">
              <circle className="quality-ring-track" cx="90" cy="90" r="74" />
              {score !== null && score > 0 && (
                <circle
                  className="quality-ring-value"
                  cx="90"
                  cy="90"
                  r="74"
                  pathLength="100"
                  strokeDasharray={`${score} ${100 - score}`}
                  transform="rotate(-90 90 90)"
                />
              )}
            </svg>
            <div className="quality-score-center">
              <strong>{score ?? "—"}</strong>
              <span>/100</span>
            </div>
          </div>
          <h2>{label}</h2>
          <p>
            {score === null
              ? "Job này chưa có kết quả đánh giá từ hệ thống."
              : "Kết quả đánh giá nội dung Job do hệ thống cung cấp."}
          </p>
        </div>
        <div className="quality-client-breakdown">
          <h2>Đánh giá theo tiêu chí</h2>
          {evaluated.length ? (
            <div className="quality-criteria">
              {evaluated.map((item) => (
                <div key={item.key}>
                  <div>
                    <span>{item.label}</span>
                    <strong
                      title={
                        item.points === item.maximum
                          ? "Đã đạt điểm tối đa"
                          : "Cần cải thiện"
                      }
                    >
                      {item.points}/{item.maximum}
                    </strong>
                  </div>
                  <progress
                    value={item.points}
                    max={item.maximum}
                    aria-label={item.label}
                  />
                </div>
              ))}
            </div>
          ) : (
            <p className="quality-note">
              Chưa có phân tích chi tiết phù hợp từ hệ thống.
            </p>
          )}
        </div>
        <aside className="quality-client-advice">
          <h2>Gợi ý cải thiện</h2>
          {recommendations?.length ? (
            <ul>
              {recommendations.map((advice, index) => (
                <li key={index}>{advice}</li>
              ))}
            </ul>
          ) : (
            <p className="quality-note">
              {recommendations
                ? "Không có gợi ý bổ sung trong lần đánh giá này."
                : "Chưa có gợi ý từ hệ thống."}
            </p>
          )}
        </aside>
      </section>
    );
  }
  return (
    <section className="quality-review">
      <div className="score-summary">
        <div>
          <span>Chất lượng tin tuyển dụng</span>
          <strong>
            {quality ? quality.score : "—"}
            <small>/100</small>
          </strong>
        </div>
        <p>
          {quality
            ? "Điểm đánh giá của tin đã lưu. Xem từng tiêu chí để giúp ứng viên hiểu rõ công việc và kỳ vọng của bạn."
            : "Tin này chưa có kết quả đánh giá. Sau khi lưu hoặc cập nhật tin, kết quả được hệ thống cung cấp sẽ hiển thị tại đây."}
        </p>
      </div>
      <div className="quality-columns">
        <div>
          <h3>Phân tích theo tiêu chí</h3>
          {quality?.rulesVersion === "job-quality-v1" && breakdown ? (
            <div className="quality-criteria">
              {criteria.map(([key, label, maximum]) => {
                const raw = breakdown[key];
                const points =
                  typeof raw === "number" &&
                  Number.isFinite(raw) &&
                  raw >= 0 &&
                  raw <= maximum
                    ? raw
                    : null;
                return (
                  <div key={key}>
                    <div>
                      <span>{label}</span>
                      <strong>
                        {points === null
                          ? "Chưa có dữ liệu"
                          : `${points}/${maximum}`}
                      </strong>
                    </div>
                    {points !== null && (
                      <progress
                        value={points}
                        max={maximum}
                        aria-label={label}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="quality-note">
              Chưa có phân tích chi tiết phù hợp để hiển thị. Điểm tổng, nếu có,
              vẫn là kết quả do hệ thống trả về.
            </p>
          )}
        </div>
        <aside>
          <h3>Gợi ý cải thiện</h3>
          {recommendations?.length ? (
            <ul>
              {recommendations.map((advice, index) => (
                <li key={index}>{advice}</li>
              ))}
            </ul>
          ) : (
            <p className="quality-note">
              {recommendations
                ? "Không có gợi ý bổ sung trong lần đánh giá này."
                : "Chưa có gợi ý từ hệ thống."}
            </p>
          )}
          <p className="quality-note">
            Bạn có thể chỉnh sửa tin trong mục Quản lý công việc. Các thay đổi
            chỉ được lưu khi bạn xác nhận.
          </p>
        </aside>
      </div>
    </section>
  );
}

function SkillPicker({
  value,
  change,
  disabled,
}: {
  value: SkillChoice[];
  change: (value: SkillChoice[]) => void;
  disabled: boolean;
}) {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [data, setData] = useState<Page<CatalogSkill>>(emptyPage);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const abort = new AbortController();
    let alive = true;
    setBusy(true);
    setError("");

    const timer = setTimeout(() => {
      skillsApi
        .list(q, page, 10, abort.signal)
        .then((result) => {
          if (alive) setData(result);
        })
        .catch((e) => {
          if (alive) setError(errorMessage(e));
        })
        .finally(() => {
          if (alive) setBusy(false);
        });
    }, 180);

    return () => {
      alive = false;
      clearTimeout(timer);
      abort.abort();
    };
  }, [q, page, reload]);

  const update = (skillId: number, patch: Partial<SkillChoice>) => {
    change(value.map((s) => (s.skillId === skillId ? { ...s, ...patch } : s)));
  };

  return (
    <div className="full">
      <label className="job-editor-skill-search">
        Tìm kiếm trong danh mục (tùy chọn)
        <input
          placeholder="Nhập tên để lọc, hoặc chọn ngay từ gợi ý phía dưới"
          maxLength={100}
          value={q}
          disabled={disabled}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(0);
          }}
        />
      </label>

      <ErrorState error={error} retry={() => setReload((n) => n + 1)} />

      {busy ? (
        <p role="status">
          <LoaderCircle size={16} />
          Đang tải kỹ năng...
        </p>
      ) : (
        !error && (
          <>
            <label>
              Kỹ năng có sẵn
              <select
                value=""
                disabled={disabled || value.length >= 50}
                onChange={(e) => {
                  if (e.target.value) {
                    change(
                      chooseSkill(value, data.content, Number(e.target.value)),
                    );
                  }
                }}
              >
                <option value="">
                  {data.content.length
                    ? "Chọn kỹ năng từ danh mục"
                    : "Không có kỹ năng phù hợp"}
                </option>
                {data.content
                  .filter((s) => !value.some((v) => v.skillId === s.id))
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                      {s.category ? ` · ${s.category}` : ""}
                    </option>
                  ))}
              </select>
            </label>
            <Pagination data={data} busy={busy} change={setPage} />
          </>
        )
      )}

      {value.map((s) => (
        <div className="form-grid" key={s.skillId}>
          <strong className="full">{s.name}</strong>

          <label>
            Bắt buộc
            <select
              disabled={disabled}
              value={s.isRequired}
              onChange={(e) =>
                update(s.skillId, {
                  isRequired: e.target.value as SkillChoice["isRequired"],
                })
              }
            >
              <option value="">Chọn yêu cầu</option>
              <option value="true">Có</option>
              <option value="false">Không</option>
            </select>
          </label>

          <button
            type="button"
            className="text-button"
            disabled={disabled}
            onClick={() => change(value.filter((v) => v.skillId !== s.skillId))}
          >
            Bỏ kỹ năng
          </button>
        </div>
      ))}
    </div>
  );
}

function JobEditor({
  initial,
  onSaved,
  onDone,
  close,
}: {
  initial: Job | null;
  onSaved: (job: Job) => void;
  onDone: (job: Job) => void;
  close: () => void;
}) {
  const [form, setForm] = useState<JobForm>(() =>
    initial ? formFromJob(initial) : emptyJobForm(),
  );
  const [current, setCurrent] = useState<Job | null>(initial);
  const currentRef = useRef(initial);
  const [busy, setBusy] = useState(false);
  const flight = useRef(false);
  const [error, setError] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [conflict, setConflict] = useState(false);
  const [showCatalogSkills, setShowCatalogSkills] = useState(() =>
    Boolean(initial?.skills.length),
  );
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, []);

  const change = (patch: Partial<JobForm>) => {
    setForm((prev) => ({ ...prev, ...patch }));
  };

  const saved = (job: Job) => {
    currentRef.current = job;
    setCurrent(job);
    onSaved(job);
  };

  const submit = async (publish: boolean) => {
    if (flight.current) return;

    flight.current = true;
    setBusy(true);
    setError("");
    setFields({});
    setConflict(false);

    try {
      const result = await saveJob(form, currentRef.current, publish, saved);
      if (initial || publish || result.status === "OPEN") {
        onDone(result);
      }
    } catch (e) {
      setError(errorMessage(e));
      if (e instanceof ApiError) {
        setFields(e.errors);
        setConflict(e.status === 409 || e.status === 412);
      }
    } finally {
      flight.current = false;
      setBusy(false);
    }
  };

  const reload = async () => {
    if (
      !currentRef.current ||
      flight.current ||
      !window.confirm(
        "Đọc lại bản máy chủ và thay thế nội dung chưa lưu trong form?",
      )
    ) {
      return;
    }

    flight.current = true;
    setBusy(true);

    try {
      const job = await jobApi.detail(currentRef.current.id);
      saved(job);
      setForm(formFromJob(job));
      setError("");
      setFields({});
      setConflict(false);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      flight.current = false;
      setBusy(false);
    }
  };

  const text = (
    name: "title" | "description" | "deliverables" | "acceptanceCriteria",
    label: string,
    rows?: number,
  ) => (
    <label className="full">
      {label}
      {rows ? (
        <textarea
          rows={rows}
          maxLength={20000}
          placeholder={
            name === "acceptanceCriteria"
              ? "Ví dụ: Có kinh nghiệm React/TypeScript, từng xây dựng website bán hàng; biết Git, giao tiếp và cập nhật tiến độ định kỳ."
              : undefined
          }
          value={form[name]}
          disabled={busy}
          onChange={(e) => change({ [name]: e.target.value })}
        />
      ) : (
        <input
          maxLength={200}
          value={form[name]}
          disabled={busy}
          onChange={(e) => change({ [name]: e.target.value })}
        />
      )}
      {fields[name] && <span className="auth-error">{fields[name]}</span>}
    </label>
  );

  return createPortal(
    <div className="modal-overlay" role="presentation">
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="modal-content proposal-submit-modal job-editor-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="job-editor-title"
        onKeyDown={(event) => {
          if (event.key === "Escape" && !flight.current) {
            event.stopPropagation();
            close();
          }
          if (event.key === "Tab") {
            const controls = dialogRef.current?.querySelectorAll<HTMLElement>(
              'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex="0"]',
            );
            const first = controls?.[0];
            const last = controls?.[controls.length - 1];
            if (
              first &&
              last &&
              event.shiftKey &&
              (document.activeElement === first ||
                document.activeElement === dialogRef.current)
            ) {
              event.preventDefault();
              last.focus();
            } else if (
              first &&
              last &&
              !event.shiftKey &&
              (document.activeElement === last ||
                document.activeElement === dialogRef.current)
            ) {
              event.preventDefault();
              first.focus();
            }
          }
        }}
      >
        <div className="modal-header proposal-modal-header">
          <div>
            <h2 id="job-editor-title">
              {current ? "Chỉnh sửa công việc" : "Đăng công việc mới"}
            </h2>
            {current && (
              <p>
                Job #{current.id} · {statuses[current.status]}
              </p>
            )}
          </div>
          <button
            type="button"
            className="proposal-modal-close"
            aria-label="Đóng"
            disabled={busy}
            onClick={close}
          >
            ×
          </button>
        </div>

        <div className="job-editor-body">
          <div className="form-grid">
            {text("title", "Tiêu đề")}

            {(
              [
                ["budgetMin", "Ngân sách tối thiểu"],
                ["budgetMax", "Ngân sách tối đa"],
              ] as const
            ).map(([name, label]) => (
              <label key={name}>
                {label} *
                <input
                  inputMode="decimal"
                  value={form[name]}
                  disabled={busy}
                  onChange={(e) => change({ [name]: e.target.value })}
                />
                {fields[name] && (
                  <span className="auth-error">{fields[name]}</span>
                )}
              </label>
            ))}

            <label>
              Tiền tệ *
              <input
                maxLength={3}
                value={form.currencyCode}
                disabled={busy}
                onChange={(e) =>
                  change({
                    currencyCode: e.target.value.toUpperCase(),
                  })
                }
              />
            </label>

            <label>
              Deadline *
              <input
                type="date"
                value={form.deadline}
                disabled={busy}
                onChange={(e) => change({ deadline: e.target.value })}
              />
            </label>

            {text("description", "Mô tả công việc", 7)}
            {text("deliverables", "Sản phẩm bàn giao", 4)}
            <div className="job-editor-applicant-requirements">
              <div className="job-editor-requirements-heading">
                <strong>Yêu cầu đối với ứng viên</strong>
                <span>
                  Nêu rõ kinh nghiệm, năng lực, điều kiện và cách phối hợp mong
                  đợi.
                </span>
              </div>
              {text("acceptanceCriteria", "Điều kiện ứng viên cần đáp ứng", 4)}
              <p className="job-editor-requirements-note">
                Tiêu chí nghiệm thu sản phẩm sẽ được thống nhất ở bước Phạm vi &
                xác nhận sau khi chọn Freelancer.
              </p>
            </div>

            <section
              className="job-editor-skills-section full"
              aria-label="Kỹ năng kỹ thuật"
            >
              <div className="job-editor-skills-intro">
                <div>
                  <strong>Kỹ năng kỹ thuật</strong>
                  <p>
                    Không bắt buộc chọn trong danh mục. Bạn có thể ghi kỹ năng
                    chưa có trong mục “Yêu cầu đối với ứng viên” phía trên.
                  </p>
                </div>
                <button
                  type="button"
                  className="job-editor-skill-toggle"
                  aria-expanded={showCatalogSkills}
                  disabled={busy}
                  onClick={() => setShowCatalogSkills((value) => !value)}
                >
                  {showCatalogSkills
                    ? "Thu gọn"
                    : form.skills.length
                      ? `Đã chọn ${form.skills.length} kỹ năng · Chỉnh sửa`
                      : "Chọn kỹ năng gợi ý"}
                </button>
              </div>
              {showCatalogSkills && (
                <SkillPicker
                  value={form.skills}
                  change={(skills) => change({ skills })}
                  disabled={busy}
                />
              )}
            </section>
          </div>

          <ErrorState error={error} />

          {Object.entries(fields)
            .filter(
              ([key]) =>
                ![
                  "title",
                  "description",
                  "deliverables",
                  "acceptanceCriteria",
                  "budgetMin",
                  "budgetMax",
                ].includes(key),
            )
            .map(([key, value]) => (
              <p className="auth-error" key={key}>
                {key}: {value}
              </p>
            ))}

          {conflict && (
            <button
              type="button"
              className="secondary-button"
              disabled={busy}
              onClick={() => void reload()}
            >
              Đọc lại bản máy chủ
            </button>
          )}
        </div>
        <div className="form-actions proposal-modal-actions">
          <button
            type="button"
            className="secondary-button"
            disabled={busy}
            onClick={close}
          >
            Hủy
          </button>
          <button
            type="button"
            className={initial ? "primary-button" : "secondary-button"}
            disabled={busy}
            onClick={() => void submit(false)}
          >
            {busy
              ? "Đang lưu..."
              : initial || current?.status === "OPEN"
                ? "Lưu thay đổi"
                : "Lưu nháp"}
          </button>

          {(!current || current.status === "DRAFT") && (
            <button
              type="button"
              className="primary-button"
              disabled={busy}
              onClick={() => void submit(true)}
            >
              Đăng tuyển
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default function Jobs({
  manage = false,
  admin = false,
  user,
  authPending = false,
  onLogin,
  initialId,
  initialQuery = "",
  initialPanel = "details",
  initialCreate = false,
  savedJobIds = [],
  savedJobsLoading = false,
  savedJobsError = "",
  savedJobsReady = true,
  savedJobPendingIds = [],
  onRetrySavedJobs,
  onToggleSave,
  renderDescription,
}: {
  manage?: boolean;
  admin?: boolean;
  user: AuthUser | null;
  authPending?: boolean;
  onLogin: () => void;
  initialId?: number;
  initialQuery?: string;
  initialPanel?: "details" | "proposals" | "matching" | "quality";
  initialCreate?: boolean;
  savedJobIds?: string[];
  savedJobsLoading?: boolean;
  savedJobsError?: string;
  savedJobsReady?: boolean;
  savedJobPendingIds?: string[];
  onRetrySavedJobs?: () => void;
  onToggleSave?: (id: number) => void;
  renderDescription: (text: string) => React.ReactNode;
}) {
  const freelancerSearch = !manage && !admin;
  const [filterGroup, setFilterGroup] = useState("");
  const clientManagement =
    manage && !admin && Boolean(user?.roles.includes("CLIENT"));
  const [clientRoute, setClientRoute] = useState(readClientJobRoute);
  const [panel, setPanel] = useState<JobTab>(
    initialPanel === "matching" ? "proposals" : initialPanel,
  );

  useEffect(() => {
    if (!clientManagement)
      setPanel(initialPanel === "matching" ? "proposals" : initialPanel);
  }, [initialId, initialPanel, clientManagement]);

  const [filters, setFilters] = useState<JobFilters>({
    q: initialQuery,
    page: clientManagement ? clientRoute.page : 0,
    size: !manage && !admin ? 8 : 20,
    status: clientManagement ? clientRoute.status : undefined,
    mine: manage && !admin,
  });

  const [data, setData] = useState<Page<JobSummary>>(emptyPage);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [proposalCounts, setProposalCounts] = useState<
    Record<number, number | null>
  >({});

  const [selected, setSelected] = useState<number | null>(
    clientManagement ? clientRoute.jobId : (initialId ?? null),
  );
  const [detail, setDetail] = useState<Job | null>(null);
  const [clientProfileId, setClientProfileId] = useState<number | null>(null);
  const [detailError, setDetailError] = useState("");
  const [detailBusy, setDetailBusy] = useState(false);

  const [editing, setEditing] = useState(initialCreate);
  const [editorInitial, setEditorInitial] = useState<Job | null>(null);
  const [editorKey, setEditorKey] = useState(0);
  const [mobile, setMobile] = useState(!!initialId);

  useEffect(() => {
    if (!freelancerSearch) return;
    const selectFromRoute = () => {
      const raw = new URLSearchParams(
        window.location.hash.split("?")[1] || "",
      ).get("jobId");
      const id = raw && /^[1-9]\d*$/.test(raw) ? Number(raw) : NaN;
      if (Number.isSafeInteger(id)) {
        setSelected(id);
        setMobile(true);
      }
    };
    selectFromRoute();
    window.addEventListener("popstate", selectFromRoute);
    window.addEventListener("hashchange", selectFromRoute);
    return () => {
      window.removeEventListener("popstate", selectFromRoute);
      window.removeEventListener("hashchange", selectFromRoute);
    };
  }, [freelancerSearch]);

  const [actionBusy, setActionBusy] = useState(false);
  const actionFlight = useRef(false);

  const [skillPage, setSkillPage] = useState<Page<CatalogSkill>>(emptyPage);
  const [skillQ, setSkillQ] = useState("");
  const [skillPageIndex, setSkillPageIndex] = useState(0);
  const [skillError, setSkillError] = useState("");
  const [skillLoading, setSkillLoading] = useState(false);
  const [filterSkill, setFilterSkill] = useState<CatalogSkill | null>(null);

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [search, setSearch] = useState(initialQuery);

  useEffect(() => {
    if (!clientManagement) return;
    const changed = () => {
      const next = readClientJobRoute();
      setClientRoute(next);
      setPanel(next.tab);
      if (
        next.jobId !== clientRoute.jobId ||
        next.invalidId !== clientRoute.invalidId
      ) {
        setDetail(null);
        setDetailError("");
        setDetailBusy(Boolean(next.jobId));
        setEditing(false);
      }
    };
    window.addEventListener("popstate", changed);
    window.addEventListener("hashchange", changed);
    return () => {
      window.removeEventListener("popstate", changed);
      window.removeEventListener("hashchange", changed);
    };
  }, [clientManagement, clientRoute.jobId, clientRoute.invalidId]);

  useEffect(() => {
    if (!clientManagement) return;
    setPanel(clientRoute.tab);
    if (clientRoute.jobId || clientRoute.invalidId)
      window.scrollTo({ top: 0, behavior: "instant" });
  }, [clientManagement, clientRoute]);

  useEffect(() => {
    if (
      !clientManagement ||
      clientRoute.jobId ||
      clientRoute.invalidId ||
      loading
    )
      return;
    const scroll = window.history.state?.linkitJobListScroll;
    if (typeof scroll !== "number") return;
    const frame = requestAnimationFrame(() =>
      window.scrollTo({ top: scroll, behavior: "instant" }),
    );
    return () => cancelAnimationFrame(frame);
  }, [clientManagement, clientRoute.jobId, clientRoute.invalidId, loading]);

  useEffect(() => {
    if (clientManagement) return;
    setSearch(initialQuery);
    setFilters((prev) => ({
      ...prev,
      q: initialQuery,
      page: 0,
    }));
  }, [initialQuery, clientManagement]);

  useEffect(() => {
    if (initialId && !clientManagement) setSelected(initialId);
  }, [initialId, clientManagement]);

  useEffect(() => {
    if (!user && manage) return;
    if (clientManagement && (clientRoute.jobId || clientRoute.invalidId)) {
      setLoading(false);
      return;
    }

    let alive = true;
    setLoading(true);
    setError("");

    (user
      ? jobApi.search(
          clientManagement
            ? { ...filters, status: clientRoute.status, page: clientRoute.page }
            : filters,
        )
      : jobApi.publicSearch(filters)
    )
      .then((result) => {
        if (alive) {
          setData(result);
          setSelected((prev) => prev ?? result.content[0]?.id ?? null);
        }
      })
      .catch((e) => {
        if (alive) {
          setError(errorMessage(e));
          setData(emptyPage());
        }
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [
    filters,
    reload,
    user,
    manage,
    clientManagement,
    clientRoute.jobId,
    clientRoute.invalidId,
    clientRoute.status,
    clientRoute.page,
  ]);

  useEffect(() => {
    if (
      !manage ||
      admin ||
      !user?.roles.includes("CLIENT") ||
      clientRoute.jobId ||
      clientRoute.invalidId ||
      loading ||
      error
    )
      return;
    let active = true;
    setProposalCounts({});

    void Promise.all(
      data.content.map(async (job) => {
        if (job.clientId !== user.id) return;
        try {
          const result = await proposalsApi.forJob(job.id, {
            page: 0,
            size: 1,
          });
          if (active)
            setProposalCounts((previous) => ({
              ...previous,
              [job.id]: result.totalElements,
            }));
        } catch {
          if (active)
            setProposalCounts((previous) => ({ ...previous, [job.id]: null }));
        }
      }),
    );
    return () => {
      active = false;
    };
  }, [
    data,
    loading,
    error,
    manage,
    admin,
    initialPanel,
    user,
    reload,
    clientRoute.jobId,
    clientRoute.invalidId,
  ]);

  useEffect(() => {
    const requestedId = clientManagement ? clientRoute.jobId : selected;
    if ((!user && manage) || !requestedId || editing) {
      if (!requestedId) {
        setDetail(null);
        setDetailBusy(false);
      }
      return;
    }

    let alive = true;
    setDetailBusy(true);
    setDetailError("");
    setDetail(null);

    (user ? jobApi.detail(requestedId) : jobApi.publicDetail(requestedId))
      .then((result) => {
        if (clientManagement && result.clientId !== user?.id)
          throw new Error("Bạn không có quyền truy cập công việc này.");
        if (alive) setDetail(result);
      })
      .catch((e) => {
        if (alive)
          setDetailError(
            freelancerSearch && e instanceof ApiError && e.status === 404
              ? "Job đã ngừng tuyển dụng, bị xóa hoặc bạn không còn quyền xem chi tiết."
              : errorMessage(e),
          );
      })
      .finally(() => {
        if (alive) setDetailBusy(false);
      });

    return () => {
      alive = false;
    };
  }, [
    selected,
    user,
    editing,
    reload,
    manage,
    clientManagement,
    clientRoute.jobId,
  ]);

  useEffect(() => {
    if (!user && manage) return;
    if (manage && !admin) return;

    const abort = new AbortController();
    let alive = true;

    setSkillError("");
    setSkillLoading(true);

    const timer = setTimeout(() => {
      skillsApi
        .list(skillQ, skillPageIndex, 10, abort.signal)
        .then((value) => {
          if (alive) setSkillPage(value);
        })
        .catch((e) => {
          if (alive) setSkillError(errorMessage(e));
        })
        .finally(() => {
          if (alive) setSkillLoading(false);
        });
    }, 180);

    return () => {
      alive = false;
      clearTimeout(timer);
      abort.abort();
    };
  }, [user, manage, admin, skillQ, skillPageIndex]);

  useEffect(() => {
    return () => {
      if (searchTimer.current) {
        clearTimeout(searchTimer.current);
      }
    };
  }, []);

  const filter = (patch: Partial<JobFilters>) => {
    setSelected(null);
    setDetail(null);
    setFilters((prev) => ({
      ...prev,
      ...patch,
      page: patch.page ?? 0,
    }));
  };

  const saved = (job: Job) => {
    setDetail(job);
    setSelected(job.id);
    setReload((n) => n + 1);
  };

  const edit = (job: Job | null) => {
    setEditorInitial(job);
    setEditorKey((n) => n + 1);
    setEditing(true);
  };

  const selectJob = (
    jobId: number,
    nextPanel: "details" | "proposals" | "quality" = initialPanel === "matching"
      ? "proposals"
      : initialPanel,
  ) => {
    if (clientManagement) {
      navigateClientJobs({
        ...clientRoute,
        jobId,
        invalidId: false,
        tab: nextPanel,
      });
      return;
    }
    if (freelancerSearch) {
      const query = new URLSearchParams(
        window.location.hash.split("?")[1] || "",
      );
      query.set("jobId", String(jobId));
      window.history.replaceState(
        window.history.state,
        "",
        window.location.hash.split("?")[0] + "?" + query,
      );
    }
    setSelected(jobId);
    setPanel(nextPanel);
    setEditing(false);
  };

  const changePanel = (nextPanel: "details" | "proposals" | "quality") => {
    if (clientManagement && clientRoute.jobId)
      navigateClientJobs({ ...clientRoute, tab: nextPanel }, true);
    else setPanel(nextPanel);
  };

  const cancel = async () => {
    if (
      !detail ||
      actionFlight.current ||
      !window.confirm("Hủy mềm Job này? Lịch sử sẽ được giữ nguyên.")
    ) {
      return;
    }

    actionFlight.current = true;
    setActionBusy(true);
    setDetailError("");

    try {
      await jobApi.cancel(detail.id, detail.etag);
      setSelected(null);
      setDetail(null);
      if (clientManagement) backToClientJobList();
      setReload((n) => n + 1);
    } catch (e) {
      setDetailError(errorMessage(e));
    } finally {
      actionFlight.current = false;
      setActionBusy(false);
    }
  };

  if (!user && manage) {
    return authPending ? (
      <div className="panel empty-state" role="status">
        <LoaderCircle size={16} />
        Đang khôi phục phiên...
      </div>
    ) : (
      <div className="panel empty-state">
        <p>Vui lòng đăng nhập để quản lý công việc.</p>
        <button className="primary-button" onClick={onLogin}>
          Đăng nhập
        </button>
      </div>
    );
  }

  const client = !!user?.roles.includes("CLIENT") && !admin;

  const editable =
    detail &&
    client &&
    detail.clientId === user?.id &&
    ["DRAFT", "OPEN"].includes(detail.status);

  const cancellable =
    detail &&
    (admin || (client && detail.clientId === user?.id)) &&
    ["DRAFT", "OPEN"].includes(detail.status);

  const quickBudgets = [
    { label: "Tất cả mức", min: undefined, max: undefined },
    { label: "Dưới 5 triệu", min: undefined, max: "5000000" },
    { label: "5–10 triệu", min: "5000000", max: "10000000" },
    { label: "10–20 triệu", min: "10000000", max: "20000000" },
    { label: "20–50 triệu", min: "20000000", max: "50000000" },
    { label: "Trên 50 triệu", min: "50000000", max: undefined },
  ];
  const resetQuickFilters = () => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    setSearch("");
    setSkillQ("");
    setSkillPageIndex(0);
    setFilterSkill(null);
    filter({
      q: "",
      status: undefined,
      minBudget: undefined,
      maxBudget: undefined,
      currency: undefined,
      skillIds: [],
    });
  };
  const publicFilterBar = (
    <div className="job-quick-search">
      <div className="job-quick-main">
        <label className="job-quick-input">
          <Search size={18} aria-hidden="true" />
          <input
            aria-label="Tìm công việc hoặc công ty"
            maxLength={200}
            placeholder="Vị trí, công nghệ hoặc tên công ty..."
            value={search}
            onChange={(e) => {
              const value = e.target.value;
              setSearch(value);
              if (searchTimer.current) clearTimeout(searchTimer.current);
              searchTimer.current = setTimeout(() => filter({ q: value }), 250);
            }}
          />
          {search && (
            <button
              type="button"
              className="job-quick-clear"
              aria-label="Xóa từ khóa tìm kiếm"
              title="Xóa từ khóa"
              onClick={() => {
                if (searchTimer.current) clearTimeout(searchTimer.current);
                setSearch("");
                filter({ q: "" });
              }}
            >
              ×
            </button>
          )}
        </label>
        <div className="job-quick-actions">
          {(
            [
              ["skills", "Kỹ năng"],
              ["budget", "Mức ngân sách"],
            ] as const
          ).map(([key, label]) => (
            <button
              type="button"
              key={key}
              className={
                "job-quick-trigger" + (filterGroup === key ? " active" : "")
              }
              aria-expanded={filterGroup === key}
              aria-controls="job-quick-popover"
              onClick={() =>
                setFilterGroup((prev) => (prev === key ? "" : key))
              }
            >
              {label} <span aria-hidden="true">⌄</span>
            </button>
          ))}
        </div>
      </div>
      {filterGroup && (
        <div className="job-quick-popover" id="job-quick-popover">
          <div className="job-quick-popover-head">
            <strong>
              {filterGroup === "skills"
                ? "Chọn kỹ năng"
                : filterGroup === "budget"
                  ? "Chọn ngân sách (VND)"
                  : "Chọn trạng thái"}
            </strong>
            <button
              type="button"
              onClick={() => setFilterGroup("")}
              aria-label="Đóng bộ lọc"
            >
              ✕
            </button>
          </div>
          {filterGroup === "skills" && (
            <>
              <input
                className="job-quick-skill-search"
                placeholder="Tìm công nghệ, ví dụ React..."
                aria-label="Tìm kỹ năng"
                value={skillQ}
                onChange={(e) => {
                  setSkillQ(e.target.value);
                  setSkillPageIndex(0);
                }}
              />
              <div className="job-quick-options">
                {skillPage.content.map((skill) => (
                  <label key={skill.id} className="job-quick-option">
                    <input
                      type="checkbox"
                      checked={Boolean(filters.skillIds?.includes(skill.id))}
                      onChange={(e) =>
                        filter({
                          skillIds: e.target.checked
                            ? [...(filters.skillIds || []), skill.id]
                            : (filters.skillIds || []).filter(
                                (id) => id !== skill.id,
                              ),
                        })
                      }
                    />
                    <span>{skill.name}</span>
                  </label>
                ))}
                {skillLoading && <p>Đang tải kỹ năng...</p>}
              </div>
              <Pagination
                data={skillPage}
                busy={skillLoading}
                change={setSkillPageIndex}
              />
            </>
          )}
          {filterGroup === "budget" && (
            <div className="job-quick-options">
              {quickBudgets.map((option) => (
                <label key={option.label} className="job-quick-option">
                  <input
                    type="radio"
                    name="job-quick-budget"
                    checked={
                      (filters.minBudget || undefined) === option.min &&
                      (filters.maxBudget || undefined) === option.max
                    }
                    onChange={() =>
                      filter({
                        minBudget: option.min,
                        maxBudget: option.max,
                        currency: option.min || option.max ? "VND" : undefined,
                      })
                    }
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
          )}
          <button
            type="button"
            className="job-quick-done"
            onClick={() => setFilterGroup("")}
          >
            Xong
          </button>
        </div>
      )}
      {filters.skillIds?.length || filters.minBudget || filters.maxBudget ? (
        <div className="job-quick-chips">
          {!!filters.skillIds?.length && (
            <button type="button" onClick={() => filter({ skillIds: [] })}>
              Kỹ năng ({filters.skillIds.length}) ×
            </button>
          )}
          {(filters.minBudget || filters.maxBudget) && (
            <button
              type="button"
              onClick={() =>
                filter({
                  minBudget: undefined,
                  maxBudget: undefined,
                  currency: undefined,
                })
              }
            >
              Ngân sách đã chọn ×
            </button>
          )}
          <button
            type="button"
            className="job-quick-reset"
            onClick={resetQuickFilters}
          >
            Xóa tất cả
          </button>
        </div>
      ) : null}
    </div>
  );
  const filterBar = freelancerSearch ? (
    publicFilterBar
  ) : (
    <div
      className={
        freelancerSearch ? "freelancer-search-filters" : "jobs-top-filter-panel"
      }
    >
      <div
        className={
          freelancerSearch
            ? "freelancer-search-input"
            : "listing-search job-search-primary"
        }
      >
        <Search size={18} />
        <input
          maxLength={200}
          placeholder={
            freelancerSearch
              ? "Tìm theo tên công việc, công ty..."
              : "Tìm Job..."
          }
          value={search}
          onChange={(e) => {
            const value = e.target.value;
            setSearch(value);

            if (searchTimer.current) {
              clearTimeout(searchTimer.current);
            }

            searchTimer.current = setTimeout(() => filter({ q: value }), 250);
          }}
        />
      </div>

      {freelancerSearch && (
        <div className="freelancer-filter-buttons">
          {[
            ["skills", "Kỹ năng"],
            ["budget", "Ngân sách"],
            ["status", "Trạng thái"],
            ["all", "Bộ lọc"],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              className="secondary-button"
              aria-expanded={filterGroup === value}
              aria-controls="freelancer-filter-options"
              onClick={() =>
                setFilterGroup((previous) => (previous === value ? "" : value))
              }
            >
              {label}
              {(value === "skills" && filters.skillIds?.length) ||
              (value === "budget" &&
                (filters.minBudget || filters.maxBudget || filters.currency)) ||
              (value === "status" && filters.status)
                ? " •"
                : ""}{" "}
              <span aria-hidden="true">⌄</span>
            </button>
          ))}
          {(search ||
            filters.status ||
            filters.minBudget ||
            filters.maxBudget ||
            filters.currency ||
            filters.skillIds?.length ||
            skillQ) && (
            <button
              type="button"
              className="text-button"
              onClick={() => {
                if (searchTimer.current) clearTimeout(searchTimer.current);
                setSearch("");
                setSkillQ("");
                setSkillPageIndex(0);
                setFilterSkill(null);
                filter({
                  q: "",
                  status: undefined,
                  minBudget: undefined,
                  maxBudget: undefined,
                  currency: undefined,
                  skillIds: [],
                });
              }}
            >
              Xóa bộ lọc
            </button>
          )}
        </div>
      )}
      <div
        id={freelancerSearch ? "freelancer-filter-options" : undefined}
        hidden={freelancerSearch && !filterGroup}
        className={
          freelancerSearch
            ? "freelancer-filter-options filter-" + filterGroup
            : "advanced-filter-controls"
        }
      >
        <label className="filter-field-status">
          Trạng thái
          <select
            value={!user ? "OPEN" : (filters.status ?? "")}
            disabled={!user}
            onChange={(e) =>
              filter({
                status: e.target.value
                  ? (e.target.value as JobStatus)
                  : undefined,
              })
            }
          >
            {!user ? (
              <option value="OPEN">Đang mở</option>
            ) : (
              <>
                <option value="">Tất cả trạng thái</option>
                {Object.entries(statuses).map(([value, name]) => (
                  <option key={value} value={value}>
                    {name}
                  </option>
                ))}
              </>
            )}
          </select>
        </label>

        <label className="filter-field-budget">
          Ngân sách từ
          <input
            inputMode="decimal"
            value={filters.minBudget ?? ""}
            onChange={(e) =>
              filter({
                minBudget: e.target.value,
              })
            }
          />
        </label>

        <label className="filter-field-budget">
          Đến
          <input
            inputMode="decimal"
            value={filters.maxBudget ?? ""}
            onChange={(e) =>
              filter({
                maxBudget: e.target.value,
              })
            }
          />
        </label>

        <label className="filter-field-budget">
          Tiền tệ
          <input
            maxLength={3}
            value={filters.currency ?? ""}
            onChange={(e) =>
              filter({
                currency: e.target.value.toUpperCase(),
              })
            }
          />
        </label>

        <label className="filter-field-skills">
          Tìm kỹ năng
          <input
            maxLength={100}
            value={skillQ}
            onChange={(e) => {
              setSkillQ(e.target.value);
              setSkillPageIndex(0);
            }}
          />
        </label>

        <label className="filter-field-skills">
          Lọc kỹ năng
          <select
            disabled={skillLoading}
            value={filters.skillIds?.[0] ?? ""}
            onChange={(e) => {
              setFilterSkill(
                skillPage.content.find(
                  (s) => s.id === Number(e.target.value),
                ) || null,
              );
              filter({
                skillIds: e.target.value ? [Number(e.target.value)] : [],
              });
            }}
          >
            <option value="">Tất cả kỹ năng</option>

            {filterSkill &&
              !skillPage.content.some((s) => s.id === filterSkill.id) && (
                <option value={filterSkill.id}>{filterSkill.name}</option>
              )}

            {skillPage.content.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>

        <div
          className="filter-field-skills"
          style={freelancerSearch ? undefined : { display: "contents" }}
        >
          {skillLoading && <span role="status">Đang tải kỹ năng...</span>}

          <Pagination
            data={skillPage}
            busy={skillLoading}
            change={setSkillPageIndex}
          />
        </div>
      </div>
    </div>
  );
  const list = (
    <>
      <ErrorState error={error} retry={() => setReload((n) => n + 1)} />

      {loading ? (
        <p role="status">
          <LoaderCircle size={16} />
          Đang tải công việc...
        </p>
      ) : (
        !error &&
        (data.content.length ? (
          data.content.map((job) =>
            manage ? (
              <button
                key={job.id}
                className={selected === job.id ? "selected" : ""}
                onClick={() => {
                  setSelected(job.id);
                  setEditing(false);
                  setMobile(true);
                }}
              >
                <div>
                  <strong>{job.title || "Bản nháp chưa đặt tên"}</strong>
                  <span>{job.companyName || ""}</span>
                </div>
                <b className="status">
                  {job.status === "OPEN" && isJobExpired(job.deadline)
                    ? "Đã hết hạn"
                    : statuses[job.status]}
                </b>
              </button>
            ) : (
              <article
                key={job.id}
                className={`${freelancerSearch ? "freelancer-job-card" : "scan-job"} ${
                  selected === job.id ? "selected" : ""
                }`}
                role={freelancerSearch ? "button" : undefined}
                tabIndex={freelancerSearch ? 0 : undefined}
                aria-pressed={
                  freelancerSearch ? selected === job.id : undefined
                }
                onKeyDown={(e) => {
                  if (
                    e.target === e.currentTarget &&
                    freelancerSearch &&
                    (e.key === "Enter" || e.key === " ")
                  ) {
                    e.preventDefault();
                    selectJob(job.id);
                    setMobile(true);
                  }
                }}
                onClick={() => {
                  selectJob(job.id);
                  setMobile(true);
                }}
              >
                {freelancerSearch && onToggleSave && (
                  <SaveJobButton
                    compact
                    saved={savedJobIds.includes(String(job.id))}
                    pending={savedJobPendingIds.includes(String(job.id))}
                    disabled={
                      savedJobsLoading ||
                      !savedJobsReady ||
                      (job.status !== "OPEN" &&
                        !savedJobIds.includes(String(job.id)))
                    }
                    toggle={() => onToggleSave(job.id)}
                  />
                )}
                <div className="scan-title">
                  <h2>{job.title}</h2>
                  <b className="status">{statuses[job.status]}</b>
                </div>
                <div className="job-card-company">
                  <span className="job-card-company-logo" aria-hidden="true">
                    {job.companyName?.trim().charAt(0).toUpperCase() || "C"}
                  </span>
                  <p>{job.companyName || "Chưa cập nhật công ty"}</p>
                </div>
                {freelancerSearch ? (
                  <strong className="freelancer-budget">
                    <span>
                      {money(job.budgetMin, "").trim().replace(/,00$/, "")}
                    </span>{" "}
                    –{" "}
                    <span>
                      {money(job.budgetMax, "").trim().replace(/,00$/, "")}{" "}
                      {job.currencyCode}
                    </span>
                  </strong>
                ) : (
                  <>
                    <strong>
                      {money(job.budgetMin, job.currencyCode)} –{" "}
                      {money(job.budgetMax, job.currencyCode)}
                    </strong>
                  </>
                )}
                <div className="skill-list">
                  {(freelancerSearch ? job.skills.slice(0, 3) : job.skills).map(
                    (s) => (
                      <span key={s.skillId}>{s.name}</span>
                    ),
                  )}
                </div>
                <p>
                  {freelancerSearch ? (
                    <>
                      Hạn nộp:{" "}
                      <time dateTime={job.deadline}>
                        {job.deadline
                          ?.split("T")[0]
                          .split("-")
                          .reverse()
                          .join("/") || "Chưa có"}
                      </time>
                    </>
                  ) : (
                    <>Deadline: {job.deadline}</>
                  )}{" "}
                  ·
                  {freelancerSearch ? (
                    job.qualityScore == null ? (
                      "Chưa đánh giá"
                    ) : (
                      "Quality: " + job.qualityScore + "/100"
                    )
                  ) : (
                    <>Quality: {job.qualityScore ?? "Chưa có"}/100</>
                  )}
                </p>
              </article>
            ),
          )
        ) : (
          <div className="proposal-empty">
            <Inbox />
            <strong>Không tìm thấy công việc</strong>
            <span>
              {freelancerSearch
                ? "Thử thay đổi từ khóa hoặc xóa bộ lọc."
                : "Thử thay đổi bộ lọc hoặc đăng công việc mới."}
            </span>
          </div>
        ))
      )}

      <div className={freelancerSearch ? "public-job-pagination" : undefined}>
        <Pagination
          data={data}
          busy={loading}
          change={(page) => filter({ page })}
        />
      </div>
    </>
  );

  const editor = editing ? (
    <JobEditor
      key={editorKey}
      initial={editorInitial}
      onSaved={saved}
      onDone={(job) => {
        saved(job);
        setEditing(false);
        if (clientManagement && clientRoute.jobId !== job.id)
          navigateClientJobs({
            ...clientRoute,
            jobId: job.id,
            invalidId: false,
            tab: "details",
          });
      }}
      close={() => setEditing(false)}
    />
  ) : null;

  const view = (
    <>
      {!clientManagement && (
        <button className="mobile-back" onClick={() => setMobile(false)}>
          ← Quay lại danh sách
        </button>
      )}

      <ErrorState error={detailError} retry={() => setReload((n) => n + 1)} />

      {detailBusy ||
      (clientManagement && clientRoute.jobId && !detail && !detailError) ? (
        <p role="status">
          <LoaderCircle size={16} />
          Đang tải chi tiết...
        </p>
      ) : detail ? (
        <div
          className={
            clientManagement
              ? "job-details client-job-view"
              : freelancerSearch
                ? "job-details freelancer-job-detail"
                : "split-detail job-details"
          }
        >
          {clientManagement ? (
            <div className="client-job-header">
              <div className="client-job-symbol">
                <BriefcaseBusiness size={25} />
              </div>
              <div className="client-job-heading">
                <div className="client-job-title">
                  <h1>{detail.title || "Bản nháp chưa đặt tên"}</h1>
                  <b
                    className={`status job-status-${detail.status.toLowerCase()}`}
                  >
                    {detail.status === "OPEN" && isJobExpired(detail.deadline)
                      ? "Đã hết hạn"
                      : statuses[detail.status]}
                  </b>
                </div>
                <div className="client-job-meta">
                  {detail.companyName && <span>{detail.companyName}</span>}
                </div>
              </div>
              <div className="client-job-actions">
                {editable && (
                  <button
                    className="secondary-button"
                    disabled={actionBusy}
                    onClick={() => edit(detail)}
                  >
                    Chỉnh sửa
                  </button>
                )}
                {cancellable && (
                  <details className="client-job-more">
                    <summary aria-label="Thao tác khác">⋯</summary>
                    <div>
                      <button
                        disabled={actionBusy}
                        onClick={() => void cancel()}
                      >
                        Hủy Job
                      </button>
                    </div>
                  </details>
                )}
              </div>
            </div>
          ) : (
            <div className="job-details-header">
              <div className="detail-title">
                <div className="company-logo">
                  {detail.companyName?.[0] || ""}
                </div>
                <div>
                  <b className="status">{statuses[detail.status]}</b>
                  <h1>{detail.title || "Bản nháp chưa đặt tên"}</h1>
                  <div className="job-company-inline">
                    {detail.clientId > 0 ? (
                      <button
                        type="button"
                        className="public-client-company-trigger"
                        onClick={() => {
                          setClientProfileId(detail.clientId);
                        }}
                        title="Xem thông tin doanh nghiệp và các công việc khác"
                      >
                        {detail.companyName || "Xem doanh nghiệp"}{" "}
                        <span aria-hidden="true">↗</span>
                      </button>
                    ) : (
                      <p>{detail.companyName}</p>
                    )}
                    {detail.clientId > 0 && (
                      <span className="public-client-company-hint">
                        Xem hồ sơ
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div
                className={
                  freelancerSearch
                    ? "freelancer-detail-actions"
                    : "detail-action-buttons"
                }
              >
                {freelancerSearch && onToggleSave && (
                  <SaveJobButton
                    saved={savedJobIds.includes(String(detail.id))}
                    pending={savedJobPendingIds.includes(String(detail.id))}
                    disabled={
                      savedJobsLoading ||
                      !savedJobsReady ||
                      (detail.status !== "OPEN" &&
                        !savedJobIds.includes(String(detail.id)))
                    }
                    toggle={() => onToggleSave(detail.id)}
                  />
                )}
                {editable && (
                  <button
                    className="secondary-button"
                    disabled={actionBusy}
                    onClick={() => edit(detail)}
                  >
                    Chỉnh sửa
                  </button>
                )}
                {client && detail.clientId === user?.id && (
                  <button
                    className="primary-button"
                    onClick={() => changePanel("proposals")}
                  >
                    Xem đề xuất
                  </button>
                )}
                {cancellable && (
                  <button
                    className="secondary-button"
                    disabled={actionBusy}
                    onClick={() => void cancel()}
                  >
                    Hủy Job
                  </button>
                )}
                {user?.roles.includes("FREELANCER") &&
                  detail.status === "OPEN" &&
                  !isJobExpired(detail.deadline) && (
                    <SubmitProposal
                      key={`${detail.id}:${user.id}`}
                      job={detail}
                      user={user}
                    />
                  )}
                {!user &&
                  detail.status === "OPEN" &&
                  !isJobExpired(detail.deadline) && (
                    <button className="primary-button" onClick={onLogin}>
                      Đăng nhập để ứng tuyển
                    </button>
                  )}
              </div>
            </div>
          )}

          {client && detail.clientId === user?.id && (
            <div
              className="content-tabs job-detail-tabs"
              aria-label="Nội dung công việc"
            >
              {(
                [
                  ["details", "Thông tin Job"],
                  ["proposals", "Đề xuất ứng viên"],
                  ["quality", "Chất lượng tin"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  className={panel === value ? "active" : ""}
                  aria-pressed={panel === value}
                  onClick={() => changePanel(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          {panel === "details" && (
            <div
              className={
                clientManagement
                  ? "client-job-information"
                  : freelancerSearch
                    ? "freelancer-job-information"
                    : "job-details-layout"
              }
            >
              {clientManagement && (
                <div
                  className="client-job-overview-facts"
                  aria-label="Tổng quan công việc"
                >
                  <div>
                    <span>Ngân sách dự kiến</span>
                    <strong>
                      {money(detail.budgetMin, "").trim()} –{" "}
                      {money(detail.budgetMax, detail.currencyCode)}
                    </strong>
                  </div>
                  <div>
                    <span>Hạn nộp đề xuất</span>
                    <strong>
                      {detail.deadline
                        ? detail.deadline
                            .split("T")[0]
                            .split("-")
                            .reverse()
                            .join("/")
                        : "Chưa đặt"}
                    </strong>
                  </div>
                  <div>
                    <span>Trạng thái tuyển dụng</span>
                    <strong>{statuses[detail.status]}</strong>
                  </div>
                </div>
              )}
              <div className="job-details-main">
                <h2>Mô tả công việc</h2>
                {renderDescription(detail.description)}
                <h2>Yêu cầu kỹ năng</h2>
                <div className="skill-list big">
                  {detail.skills.map((s) => (
                    <span key={s.skillId}>
                      {s.name} · {s.isRequired ? "Bắt buộc" : "Không bắt buộc"}
                    </span>
                  ))}
                  {!detail.skills.length && <p>Chưa có kỹ năng yêu cầu.</p>}
                </div>
                <h2>Sản phẩm bàn giao</h2>
                {renderDescription(detail.deliverables)}
                <section
                  className="job-applicant-panel"
                  aria-label="Yêu cầu đối với ứng viên"
                >
                  <h2>Yêu cầu đối với ứng viên</h2>
                  {renderDescription(detail.acceptanceCriteria)}
                </section>
              </div>
              {!clientManagement && (
                <aside
                  className="job-details-aside"
                  aria-label="Thông tin công việc"
                >
                  <div className="detail-facts">
                    <div>
                      <CircleDollarSign size={16} />
                      <span>
                        Ngân sách
                        <strong className="job-budget-range">
                          <span>
                            {freelancerSearch
                              ? money(detail.budgetMin, "")
                                  .trim()
                                  .replace(/,00$/, "")
                              : money(detail.budgetMin, "").trim()}
                          </span>
                          {" – "}
                          <span>
                            {freelancerSearch
                              ? money(detail.budgetMax, "")
                                  .trim()
                                  .replace(/,00$/, "") +
                                " " +
                                detail.currencyCode
                              : money(detail.budgetMax, detail.currencyCode)}
                          </span>
                        </strong>
                      </span>
                    </div>

                    <div>
                      <Clock3 size={16} />
                      <span>
                        Deadline
                        <strong className="job-date">
                          {detail.deadline
                            ? detail.deadline
                                .split("T")[0]
                                .split("-")
                                .reverse()
                                .join("/")
                            : "Chưa có deadline"}
                        </strong>
                      </span>
                    </div>

                    <div>
                      <BriefcaseBusiness size={16} />
                      <span>
                        Thời gian đăng
                        <strong className="job-date">
                          {detail.publishedAt
                            ? new Date(detail.publishedAt).toLocaleDateString(
                                "vi-VN",
                              )
                            : "Chưa đăng tuyển"}
                        </strong>
                      </span>
                    </div>
                  </div>
                </aside>
              )}
            </div>
          )}

          {panel === "quality" &&
            (admin || (client && detail.clientId === user?.id)) && (
              <QualityView
                job={detail}
                layout={clientManagement ? "client" : "default"}
              />
            )}

          {panel === "proposals" &&
            client &&
            user !== null &&
            detail.clientId === user.id && (
              <>
                <Proposals
                  key={`${detail.id}:${user.id}`}
                  user={user}
                  job={detail}
                  changed={() => setReload((n) => n + 1)}
                />
              </>
            )}
        </div>
      ) : (
        !detailError && (
          <div className="proposal-empty">
            <Inbox />
            <strong>Chọn công việc để xem chi tiết</strong>
          </div>
        )
      )}
    </>
  );

  if (clientManagement && (clientRoute.jobId || clientRoute.invalidId))
    return (
      <div className="management-page client-job-detail-page">
        {editor}
        <nav className="client-job-breadcrumb" aria-label="Breadcrumb">
          <button
            className="text-button job-back-link"
            onClick={backToClientJobList}
          >
            ← Quản lý công việc
          </button>
          <span aria-hidden="true">/</span>
          <span aria-current="page">Chi tiết Job</span>
        </nav>
        <section
          className="client-job-detail-surface"
          aria-label="Chi tiết công việc"
        >
          {clientRoute.invalidId ? (
            <ErrorState error="ID công việc không hợp lệ." />
          ) : (
            view
          )}
        </section>
      </div>
    );

  if (manage && client)
    return (
      <div className="client-job-management management-page client-job-list">
        {editor}
        <section className="panel management-surface">
          <div className="management-head">
            <h1>Quản lý công việc</h1>
            <button className="primary-button" onClick={() => edit(null)}>
              <Plus size={16} />
              Đăng Job mới
            </button>
          </div>
          <div className="client-job-filter-row">
            <div
              className="job-status-tabs"
              role="group"
              aria-label="Lọc trạng thái công việc"
            >
              {(
                [
                  ["", "Tất cả"],
                  ["OPEN", "Đang tuyển"],
                  ["IN_PROGRESS", "Đang thực hiện"],
                  ["COMPLETED", "Hoàn thành"],
                ] as const
              ).map(([status, label]) => (
                <button
                  type="button"
                  key={status}
                  className={
                    (clientRoute.status ?? "") === status ? "active" : ""
                  }
                  aria-pressed={(clientRoute.status ?? "") === status}
                  onClick={() =>
                    navigateClientJobs(
                      {
                        jobId: null,
                        invalidId: false,
                        tab: "details",
                        status: status || undefined,
                        page: 0,
                      },
                      true,
                    )
                  }
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <ErrorState error={error} retry={() => setReload((n) => n + 1)} />
          {loading ? (
            <p className="management-state" role="status">
              <LoaderCircle size={16} />
              Đang tải công việc...
            </p>
          ) : (
            !error &&
            (data.content.length ? (
              <table className="management-table linkit-client-data-table">
                <caption className="sr-only">
                  Công việc thuộc tài khoản của bạn
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Tên Job</th>
                    <th scope="col">Ngân sách</th>
                    <th scope="col">Số đề xuất</th>
                    <th scope="col">Hạn chót</th>
                    <th scope="col">Trạng thái</th>
                    <th scope="col">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {data.content.map((job) => (
                    <tr key={job.id}>
                      <td data-label="Tên Job">
                        <button
                          className="table-title"
                          onClick={() => selectJob(job.id, "details")}
                        >
                          {job.title || "Bản nháp chưa đặt tên"}
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
                      <td
                        data-label="Số đề xuất"
                        className="client-job-proposals-cell"
                      >
                        <button
                          type="button"
                          className="client-job-proposal-count"
                          onClick={() => selectJob(job.id, "proposals")}
                          title={
                            proposalCounts[job.id] === null
                              ? "Chưa tải được số đề xuất; mở để thử lại"
                              : "Xem đề xuất của Job"
                          }
                        >
                          {proposalCounts[job.id] === undefined
                            ? "…"
                            : (proposalCounts[job.id] ?? "—")}
                        </button>
                      </td>
                      <td data-label="Hạn chót">
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
                          className={
                            "status job-status-" + job.status.toLowerCase()
                          }
                        >
                          {statuses[job.status]}
                        </b>
                      </td>
                      <td data-label="Thao tác">
                        <button
                          className="secondary-button"
                          onClick={() => selectJob(job.id, "details")}
                        >
                          Chi tiết
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="proposal-empty">
                <Inbox />
                <strong>Không có công việc phù hợp</strong>
                <span>Chọn trạng thái khác hoặc đăng Job đầu tiên.</span>
              </div>
            ))
          )}
          <Pagination
            data={data}
            busy={loading}
            change={(page) =>
              navigateClientJobs(
                { ...clientRoute, jobId: null, invalidId: false, page },
                true,
              )
            }
          />
        </section>
      </div>
    );

  return manage ? (
    <div className={client ? "client-job-management" : undefined}>
      {editor}
      {client && filterBar}
      <div
        className={`manager-split responsive-manager ${
          !admin ? "client-job-manager" : ""
        } ${mobile ? "show-detail" : ""}`}
      >
        <section className="panel manager-list">
          <div className="management-head">
            <div>
              <h2>{admin ? "Tất cả Job" : "Job đã đăng"}</h2>
            </div>

            {client && (
              <button className="primary-button" onClick={() => edit(null)}>
                <Plus />
                Đăng công việc
              </button>
            )}
          </div>

          {!client && filterBar}
          <ErrorState error={skillError} />
          {list}
        </section>

        <section className="panel assignment-detail manager-detail-scroll">
          {view}
        </section>
      </div>
    </div>
  ) : (
    <main className={freelancerSearch ? "freelancer-job-search" : "jobs-page"}>
      {freelancerSearch && savedJobsError && (
        <ErrorState error={savedJobsError} retry={onRetrySavedJobs} />
      )}
      {freelancerSearch && (
        <div className="freelancer-search-heading">
          <h1>Tìm việc</h1>
          <p>Khám phá các cơ hội dự án phù hợp với kỹ năng của bạn.</p>
        </div>
      )}
      {filterBar}
      <ErrorState error={skillError} />

      <div
        className={`${freelancerSearch ? "freelancer-job-split" : "job-split"} ${
          mobile ? "show-detail" : ""
        }`}
      >
        <section
          className={freelancerSearch ? "freelancer-job-list" : "job-list-pane"}
        >
          {freelancerSearch && !loading && !error && (
            <p className="freelancer-result-count">
              {data.totalElements} kết quả
            </p>
          )}
          {list}
        </section>

        <section
          className={
            freelancerSearch ? "freelancer-job-preview" : "job-detail-pane"
          }
        >
          {view}
        </section>
      </div>
      {clientProfileId != null && (
        <PublicClientCardModal
          id={clientProfileId}
          currentJobId={detail?.id ?? -1}
          close={() => setClientProfileId(null)}
          chooseJob={(id) => {
            setClientProfileId(null);
            setSelected(id);
            setMobile(true);
          }}
        />
      )}
    </main>
  );
}

export function JobSnapshot({
  id,
  renderDescription,
}: {
  id: number;
  renderDescription: (text: string) => React.ReactNode;
}) {
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let alive = true;
    setJob(null);
    setError("");

    jobApi
      .detail(id)
      .then((value) => {
        if (alive) setJob(value);
      })
      .catch((e) => {
        if (alive) setError(errorMessage(e));
      });

    return () => {
      alive = false;
    };
  }, [id, retry]);

  return (
    <>
      <ErrorState error={error} retry={() => setRetry((n) => n + 1)} />

      {job ? (
        <div className="split-detail">
          <div className="detail-title">
            <div>
              <b className="status">{statuses[job.status]}</b>
              <h1>{job.title}</h1>
              <p>{job.companyName}</p>
            </div>
          </div>

          <div className="detail-facts">
            <div>
              <CircleDollarSign />
              <span>
                Ngân sách
                <strong>
                  {money(job.budgetMin, job.currencyCode)} –{" "}
                  {money(job.budgetMax, job.currencyCode)}
                </strong>
              </span>
            </div>

            <div>
              <Clock3 />
              <span>
                Deadline
                <strong>{job.deadline}</strong>
              </span>
            </div>
          </div>

          <h2>Kỹ năng yêu cầu</h2>
          <div className="skill-list big">
            {job.skills.map((s) => (
              <span key={s.skillId}>
                {s.name} · {s.isRequired ? "Bắt buộc" : "Không bắt buộc"}
              </span>
            ))}
          </div>

          <h2>Mô tả công việc</h2>
          {renderDescription(job.description)}

          <h2>Sản phẩm bàn giao</h2>
          {renderDescription(job.deliverables)}

          <section
            className="job-applicant-panel"
            aria-label="Yêu cầu đối với ứng viên"
          >
            <h2>Yêu cầu đối với ứng viên</h2>
            {renderDescription(job.acceptanceCriteria)}
          </section>

          <QualityView job={job} />
        </div>
      ) : (
        !error && (
          <p role="status">
            <LoaderCircle size={16} />
            Đang tải chi tiết...
          </p>
        )
      )}
    </>
  );
}
