import { useEffect, useRef, useState, type DependencyList } from "react";
import {
  CheckCircle2,
  Clock3,
  GitPullRequest,
  LoaderCircle,
  ShieldCheck,
  TriangleAlert,
  Building2,
  ClipboardCheck,
  Check,
  Quote,
  Star,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  RichDescription,
  Stars,
} from "../../components/ui";
import { ApiError } from "../../api/http";
import {
  acceptanceApi,
  changesApi,
  reviewsApi,
  risksApi,
  type ChangeRequest,
  type RiskAlert,
  type Acceptance,
} from "../../api/lifecycle";
import { money } from "../jobs/model";
import { party } from "./productionModel";
import {
  acceptanceConditions,
  acceptanceEvidence,
  acceptanceNote,
  allMilestones,
  blankChange,
  blankReview,
  canAccept,
  canReview,
  changeInput,
  changeRights,
  decisionComment,
  ratingFields,
  reviewInput,
  riskRights,
} from "./lifecycleModel";
import type { Runtime } from "./ProductionWorkspace";

const message = (e: unknown) =>
  e instanceof ApiError
    ? [e.message, ...Object.values(e.errors)].join(" · ")
    : e instanceof Error
      ? e.message
      : "Không thể tải dữ liệu.";
function useRead<T>(read: () => Promise<T>, dependencies: DependencyList) {
  const fn = useRef(read);
  fn.current = read;
  const [data, replace] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    fn.current()
      .then((value) => {
        if (alive) replace(value);
      })
      .catch((e) => {
        if (alive) {
          replace(null);
          setError(message(e));
        }
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [...dependencies, retry]);
  return { data, replace, loading, error, retry: () => setRetry((n) => n + 1) };
}
function ReadState({
  value,
}: {
  value: { loading: boolean; error: string; retry: () => void };
}) {
  return value.loading ? (
    <p className="v2-muted" role="status">
      <LoaderCircle className="v2-spin" />
      Đang tải...
    </p>
  ) : value.error ? (
    <div className="v2-message error" role="alert">
      <TriangleAlert size={18} />
      {value.error}
      <Button variant="ghost" onClick={value.retry}>
        Tải lại
      </Button>
    </div>
  ) : null;
}
function Paging({
  value,
  disabled,
  change,
}: {
  value: { page: number; totalPages: number; totalElements: number };
  disabled: boolean;
  change: (page: number) => void;
}) {
  return (
    <div className="v2-actions">
      <span className="v2-muted">
        {value.totalElements} kết quả · Trang{" "}
        {value.totalPages ? value.page + 1 : 0}/{value.totalPages}
      </span>
      <Button
        variant="secondary"
        disabled={disabled || !value.page}
        onClick={() => change(value.page - 1)}
      >
        ‹
      </Button>
      <Button
        variant="secondary"
        disabled={disabled || value.page + 1 >= value.totalPages}
        onClick={() => change(value.page + 1)}
      >
        ›
      </Button>
    </div>
  );
}
export function ChangesPanel({ runtime: r }: { runtime: Runtime }) {
  const assignmentId = r.data.assignment.id;
  const [page, setPage] = useState(0);
  const [id, setId] = useState<number | null>(null);
  const list = useRead(
    () => changesApi.list(assignmentId, page),
    [assignmentId, page, r.revision],
  );
  const selected = id ?? list.data?.content[0]?.id ?? null;
  const detail = useRead<ChangeRequest | null>(
    () => (selected ? changesApi.detail(selected) : Promise.resolve(null)),
    [selected, r.revision],
  );
  const work = useRead(
    () => allMilestones(assignmentId),
    [assignmentId, r.revision],
  );
  const [form, setForm] = useState(blankChange);
  const [comments, setComments] = useState<Record<number, string>>({});
  const rights = changeRights(r.user, r.data, detail.data || undefined);
  const disabled = r.busy || r.blocked;
  const update = (key: keyof typeof form, value: string) =>
    setForm((previous) => ({ ...previous, [key]: value }));
  return (
    <div className="v2-two-col">
      <Card title="Yêu cầu thay đổi" eyebrow="CHANGE REQUEST">
        <p className="v2-muted">
          Hai bên quyết định riêng biệt. Đủ hai APPROVED vẫn cần CLIENT chủ động
          apply. Scope và Milestone chỉ thay đổi tại backend.
        </p>
        {rights.create ? (
          <form
            className="v2-form"
            onSubmit={(e) => {
              e.preventDefault();
              void r.run(
                () => changesApi.create(assignmentId, changeInput(form)),
                (c) => {
                  setId(c.id);
                  setPage(0);
                },
              );
            }}
          >
            <label>
              Tên thay đổi
              <input
                maxLength={200}
                disabled={disabled}
                value={form.title}
                onChange={(e) => update("title", e.target.value)}
              />
            </label>
            {(
              [
                ["reason", "Lý do thay đổi"],
                ["proposedDeliverables", "Sản phẩm bàn giao đề xuất"],
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
            <div className="v2-form-grid">
              <label>
                Budget delta ({r.data.assignment.currencyCode})
                <input
                  inputMode="decimal"
                  disabled={disabled}
                  value={form.budgetDelta}
                  onChange={(e) => update("budgetDelta", e.target.value)}
                />
              </label>
              <label>
                Days delta
                <input
                  inputMode="numeric"
                  disabled={disabled}
                  value={form.daysDelta}
                  onChange={(e) => update("daysDelta", e.target.value)}
                />
              </label>
            </div>
            <Button type="submit" disabled={disabled}>
              Tạo Change Request PENDING
            </Button>
          </form>
        ) : (
          <EmptyState icon={<GitPullRequest />} title="Chưa thể tạo yêu cầu">
            <p>
              Cần Assignment ACTIVE, Job IN_PROGRESS và Scope LOCKED hiện tại.
            </p>
          </EmptyState>
        )}
      </Card>
      <div className="v2-stack">
        <Card title="Lịch sử Change Request">
          <ReadState value={list} />
          {!list.loading && !list.error && list.data && (
            <>
              {list.data.content.map((c) => (
                <div className="v2-history-row" key={c.id}>
                  <Button
                    variant="ghost"
                    disabled={r.busy}
                    onClick={() => setId(c.id)}
                  >
                    {c.title}
                  </Button>
                  <Badge>{c.status}</Badge>
                </div>
              ))}
              {!list.data.content.length && (
                <EmptyState title="Chưa có Change Request" />
              )}
              <Paging
                value={list.data}
                disabled={r.busy}
                change={(p) => {
                  setPage(p);
                  setId(null);
                }}
              />
            </>
          )}
        </Card>
        <ReadState value={detail} />
        {!detail.loading && !detail.error && detail.data && (
          <Card
            title={detail.data.title}
            eyebrow={`CHANGE REQUEST #${detail.data.id}`}
            action={<Badge>{detail.data.status}</Badge>}
          >
            <ChangeDetail
              value={detail.data}
              currency={r.data.assignment.currencyCode}
            />
            <label className="v2-form">
              Nhận xét quyết định
              <textarea
                rows={3}
                maxLength={20000}
                disabled={disabled || !rights.decide}
                value={comments[detail.data.id] || ""}
                onChange={(e) => {
                  const value = e.target.value;
                  setComments((previous) => ({
                    ...previous,
                    [detail.data!.id]: value,
                  }));
                }}
              />
            </label>
            {rights.decide && (
              <div className="v2-actions">
                <Button
                  variant="secondary"
                  disabled={disabled}
                  onClick={() =>
                    void r.run(() =>
                      changesApi.decide(
                        detail.data!.id,
                        "REJECTED",
                        decisionComment(comments[detail.data!.id] || ""),
                        detail.data!.etag,
                      ),
                    )
                  }
                >
                  Từ chối
                </Button>
                <Button
                  disabled={disabled}
                  onClick={() =>
                    void r.run(() =>
                      changesApi.decide(
                        detail.data!.id,
                        "APPROVED",
                        decisionComment(comments[detail.data!.id] || ""),
                        detail.data!.etag,
                      ),
                    )
                  }
                >
                  Phê duyệt với tư cách {party(r.user, r.data.assignment)}
                </Button>
              </div>
            )}
            <ReadState value={work} />
            {work.data && (
              <p className="v2-muted">
                Milestone chưa APPROVED/CANCELLED:{" "}
                {
                  work.data.filter(
                    (m) => !["APPROVED", "CANCELLED"].includes(m.status),
                  ).length
                }
                . CLIENT cần hủy PLANNED hoặc hoàn tất công việc đang thực hiện
                trước khi apply. Backend kiểm tra toàn bộ Submission và ràng
                buộc ngân sách.
              </p>
            )}
            {detail.data.status === "APPROVED" &&
              detail.data.baseScopeVersionId !==
                r.data.scopes.find((s) => s.status === "LOCKED")?.id && (
                <p className="v2-note">
                  Scope gốc không còn hiện tại; không thể apply.
                </p>
              )}
            {rights.apply && (
              <Button
                disabled={disabled || work.loading || !!work.error}
                onClick={() =>
                  void r.run(
                    () => changesApi.apply(detail.data!.id, detail.data!.etag),
                    (c) => detail.replace(c),
                    async () => {
                      const [c] = await Promise.all([
                        changesApi.detail(detail.data!.id),
                        allMilestones(assignmentId),
                      ]);
                      detail.replace(c);
                    },
                  )
                }
              >
                Áp dụng thay đổi
              </Button>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
function ChangeDetail({
  value: c,
  currency,
}: {
  value: ChangeRequest;
  currency: string;
}) {
  return (
    <>
      <RichDescription text={c.reason} />
      <h3>Sản phẩm bàn giao đề xuất</h3>
      <RichDescription text={c.proposedDeliverables} />
      <div className="v2-facts">
        <div>
          <small>BUDGET DELTA</small>
          <b>{money(c.budgetDelta, currency)}</b>
        </div>
        <div>
          <small>DAYS DELTA</small>
          <b>{c.daysDelta}</b>
        </div>
      </div>
      <p>
        Scope gốc #{c.baseScopeVersionId}
        {c.resultScopeVersionId
          ? ` · Scope kết quả #${c.resultScopeVersionId}`
          : ""}{" "}
        · Người tạo #{c.requestedBy}
      </p>
      {(["CLIENT", "FREELANCER"] as const).map((role) => {
        const d = c.decisions.find((x) => x.partyRole === role);
        return (
          <div className="v2-approval" key={role}>
            <div>
              <b>
                {role}: {d?.decision || "Chưa quyết định"}
              </b>
              {d && (
                <>
                  <small>
                    #{d.userId} · {d.decidedAt}
                  </small>
                  <p>{d.comment}</p>
                </>
              )}
            </div>
            {d ? <CheckCircle2 size={18} /> : <Clock3 size={18} />}
          </div>
        );
      })}
    </>
  );
}
export function RisksPanel({ runtime: r }: { runtime: Runtime }) {
  const assignmentId = r.data.assignment.id;
  const [page, setPage] = useState(0);
  const [id, setId] = useState<number | null>(null);
  const [summary, setSummary] = useState("");
  const list = useRead(
    () => risksApi.list(assignmentId, page),
    [assignmentId, page, r.revision],
  );
  const selected = id ?? list.data?.content[0]?.id ?? null;
  const detail = useRead<RiskAlert | null>(
    () => (selected ? risksApi.detail(selected) : Promise.resolve(null)),
    [selected, r.revision],
  );
  const rights = riskRights(r.user, r.data, detail.data || undefined);
  const disabled = r.busy || r.blocked;
  return (
    <div className="v2-stack">
      <Card
        title="Chủ động trước mọi rủi ro."
        action={
          rights.evaluate && (
            <Button
              disabled={disabled}
              onClick={() =>
                void r.run(
                  () => risksApi.evaluate(assignmentId),
                  (result) =>
                    setSummary(
                      `Backend tạo ${result.created} cảnh báo và tự resolve ${result.resolved} cảnh báo.`,
                    ),
                )
              }
            >
              Đánh giá Risk Alert
            </Button>
          )
        }
      >
        <p className="v2-muted">
          Cảnh báo và ngưỡng do backend đánh giá. Không tự thay đổi trạng thái
          Assignment/Job.
        </p>
        {summary && <p role="status">{summary}</p>}
        <ReadState value={list} />
        {!list.loading && !list.error && list.data && (
          <>
            {list.data.content.map((risk) => (
              <div className="v2-history-row" key={risk.id}>
                <Button
                  variant="ghost"
                  disabled={r.busy}
                  onClick={() => setId(risk.id)}
                >
                  {risk.title} · #{risk.id}
                </Button>
                <Badge>{risk.severity}</Badge>
                <Badge>{risk.status}</Badge>
              </div>
            ))}
            {!list.data.content.length && (
              <EmptyState icon={<ShieldCheck />} title="Chưa có Risk Alert" />
            )}
            <Paging
              value={list.data}
              disabled={r.busy}
              change={(p) => {
                setPage(p);
                setId(null);
              }}
            />
          </>
        )}
      </Card>
      <ReadState value={detail} />
      {!detail.loading && !detail.error && detail.data && (
        <Card
          title={detail.data.title}
          action={
            <Badge
              tone={
                detail.data.severity === "HIGH" ||
                detail.data.severity === "CRITICAL"
                  ? "red"
                  : "amber"
              }
            >
              {detail.data.severity} · {detail.data.status}
            </Badge>
          }
        >
          <RichDescription text={detail.data.description} />
          <p>Loại: {detail.data.riskType}</p>
          <p>
            Nguồn: {detail.data.ruleCode}
            {detail.data.milestoneId
              ? ` · Milestone #${detail.data.milestoneId}`
              : ""}
          </p>
          <p>Phát hiện: {detail.data.detectedAt}</p>
          {detail.data.resolvedAt && <p>Resolved: {detail.data.resolvedAt}</p>}
          <div className="v2-actions">
            {rights.acknowledge && (
              <Button
                variant="secondary"
                disabled={disabled}
                onClick={() =>
                  void r.run(
                    () => risksApi.acknowledge(detail.data!.id),
                    (value) => detail.replace(value),
                  )
                }
              >
                Đã ghi nhận
              </Button>
            )}
            {rights.resolve && (
              <Button
                disabled={disabled}
                onClick={() =>
                  void r.run(
                    () => risksApi.resolve(detail.data!.id),
                    (value) => detail.replace(value),
                  )
                }
              >
                Resolve cảnh báo
              </Button>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
const formatWorkspaceDate = (value: string | null | undefined) =>
  value && Number.isFinite(Date.parse(value))
    ? new Date(value).toLocaleDateString("vi-VN")
    : "Chưa cập nhật";
const labels = {
  overallRating: "Tổng thể",
  qualityRating: "Chất lượng",
  communicationRating: "Giao tiếp",
  timelinessRating: "Tiến độ",
};
export function AcceptancePanel({ runtime: r }: { runtime: Runtime }) {
  const id = r.data.assignment.id;
  const currentParty = party(r.user, r.data.assignment);
  const adminOnly = !currentParty && r.user.roles.includes("ADMIN");
  const status = useRead<Acceptance | null>(
    () => (adminOnly ? Promise.resolve(null) : acceptanceApi.get(id)),
    [id, r.revision, adminOnly],
  );
  const evidence = useRead(
    () => (adminOnly ? Promise.resolve(null) : acceptanceEvidence(id)),
    [id, r.revision, adminOnly],
  );
  const review = useRead(() => reviewsApi.get(id), [id, r.revision]);
  const [form, setForm] = useState(blankReview);
  const [note, setNote] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [reviewComposerOpen, setReviewComposerOpen] = useState(false);
  const [acceptComposerOpen, setAcceptComposerOpen] = useState(false);
  const disabled = r.busy || r.blocked;
  const conditions = evidence.data
    ? acceptanceConditions(r.data, evidence.data)
    : null;
  const accepted = status.data?.accepted === true && !!status.data.acceptance;
  const eligible = !!(
    status.data &&
    evidence.data &&
    canAccept(r.user, r.data, status.data, evidence.data)
  );
  const reviewAllowed = canReview(r.user, r.data, false, accepted);
  const ready =
    !disabled &&
    !status.loading &&
    !evidence.loading &&
    !status.error &&
    !evidence.error;
  const acceptanceAction = currentParty === "CLIENT" && !accepted && !adminOnly;
  const reviewAction =
    !review.loading && !review.error && !review.data && reviewAllowed;

  return (
    <div className="ws-final-page">
      <div className="ws-final-grid">
        <section
          className="ws-final-card"
          aria-labelledby="ws-final-accept-heading"
        >
          <header className="ws-final-card-heading">
            <span className="ws-final-heading-icon">
              <ClipboardCheck size={19} />
            </span>
            <h2 id="ws-final-accept-heading">Nghiệm thu</h2>
          </header>
          <ReadState value={status} />
          {!adminOnly && <ReadState value={evidence} />}
          {adminOnly ? (
            <div className="ws-final-empty">
              Chỉ các bên tham gia dự án có quyền nghiệm thu.
            </div>
          ) : accepted && status.data?.acceptance ? (
            <>
              <div className="ws-final-success">
                <div className="ws-final-success-label">
                  <span className="ws-final-success-tick">
                    <Check size={25} />
                  </span>
                  <strong>Đã nghiệm thu</strong>
                </div>
                <span className="ws-final-success-symbol" aria-hidden="true">
                  <span className="ws-final-document">
                    <span />
                    <span />
                    <span />
                  </span>
                  <span className="ws-final-document-check">
                    <Check size={16} />
                  </span>
                </span>
              </div>
              <div className="ws-final-success-list">
                <div>
                  <CheckCircle2 size={18} /> Hoàn thành theo thỏa thuận
                </div>
                <div>
                  <CheckCircle2 size={18} /> Bàn giao đầy đủ
                </div>
              </div>
              {status.data.acceptance.acceptanceNote?.trim() && (
                <details className="ws-final-accept-note">
                  <summary>Ghi chú nghiệm thu</summary>
                  <RichDescription
                    text={status.data.acceptance.acceptanceNote}
                  />
                </details>
              )}
            </>
          ) : (
            <>
              <div className="ws-final-waiting">
                <Clock3 size={22} />
                <strong>Chờ nghiệm thu</strong>
              </div>
              {conditions && (
                <div className="ws-final-conditions">
                  {(
                    [
                      ["state", "Dự án đến giai đoạn nghiệm thu"],
                      ["scope", "Phạm vi đã xác nhận"],
                      ["required", "Các mốc bắt buộc đã được duyệt"],
                      ["changes", "Yêu cầu thay đổi đã hoàn tất"],
                    ] as const
                  ).map(([key, label]) => (
                    <div key={key}>
                      {conditions[key] ? (
                        <CheckCircle2 size={17} />
                      ) : (
                        <Clock3 size={17} />
                      )}
                      <span>{label}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </section>

        <section
          className="ws-final-card"
          aria-labelledby="ws-final-review-heading"
        >
          <header className="ws-final-card-heading">
            <span className="ws-final-heading-icon">
              <Star size={19} />
            </span>
            <h2 id="ws-final-review-heading">Đánh giá</h2>
          </header>
          <ReadState value={review} />
          {!review.loading &&
            !review.error &&
            (review.data ? (
              <>
                <div className="ws-final-reviewer">
                  <span className="ws-final-reviewer-avatar">
                    <Building2 size={24} />
                  </span>
                  <div>
                    <strong>
                      {r.data.assignment.companyName || "Khách hàng"}
                    </strong>
                    <Stars
                      label="Đánh giá tổng thể"
                      value={review.data.overallRating}
                    />
                  </div>
                </div>
                {review.data.comment?.trim() && (
                  <div className="ws-final-quote">
                    <Quote size={18} />
                    <RichDescription text={review.data.comment} />
                  </div>
                )}
              </>
            ) : (
              <div className="ws-final-empty">Chưa có đánh giá.</div>
            ))}
        </section>
      </div>

      {(acceptanceAction || reviewAction) && (
        <div className="ws-final-actions">
          {reviewAction && (
            <Button
              variant="secondary"
              disabled={disabled}
              onClick={() => setReviewComposerOpen(true)}
            >
              Gửi đánh giá
            </Button>
          )}
          {acceptanceAction && (
            <Button
              disabled={!ready || !eligible}
              onClick={() => setAcceptComposerOpen(true)}
            >
              <Check size={17} /> Xác nhận
            </Button>
          )}
        </div>
      )}

      {acceptanceAction && acceptComposerOpen && (
        <div className="ws-template-modal-overlay">
          <div
            className="ws-template-modal-dialog ws-final-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Xác nhận nghiệm thu"
          >
            <h3 className="ws-template-review-modal-title">
              Xác nhận nghiệm thu
            </h3>
            <div className="ws-final-modal-content">
              <label className="ws-final-input-label">
                Ghi chú nghiệm thu
                <textarea
                  rows={4}
                  maxLength={20000}
                  disabled={disabled}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </label>
              <label className="ws-final-confirm-check">
                <input
                  type="checkbox"
                  disabled={disabled}
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />
                <span>
                  Tôi đã đối chiếu kết quả bàn giao với phạm vi đã thống nhất.
                </span>
              </label>
              <div className="ws-final-modal-actions">
                <Button
                  variant="secondary"
                  disabled={disabled}
                  onClick={() => setAcceptComposerOpen(false)}
                >
                  Đóng
                </Button>
                <Button
                  disabled={!ready || !eligible || !confirmed}
                  onClick={() =>
                    void r.run(
                      () =>
                        acceptanceApi.accept(
                          id,
                          acceptanceNote(note),
                          status.data!.etag,
                        ),
                      (value) => {
                        status.replace(value);
                        setAcceptComposerOpen(false);
                      },
                      async () => {
                        const [value] = await Promise.all([
                          acceptanceApi.get(id),
                          allMilestones(id),
                        ]);
                        status.replace(value);
                      },
                    )
                  }
                >
                  Xác nhận nghiệm thu
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {reviewAction && reviewComposerOpen && (
        <div className="ws-template-modal-overlay">
          <div
            className="ws-template-modal-dialog ws-final-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Đánh giá freelancer"
          >
            <h3 className="ws-template-review-modal-title">
              Đánh giá freelancer
            </h3>
            <form
              className="v2-form ws-final-review-form"
              onSubmit={(e) => {
                e.preventDefault();
                void r.run(
                  () => reviewsApi.create(id, reviewInput(form)),
                  (value) => {
                    review.replace(value);
                    setReviewComposerOpen(false);
                  },
                );
              }}
            >
              {ratingFields.map((key) => (
                <label className="v2-rating-row" key={key}>
                  {labels[key]}
                  <select
                    disabled={disabled}
                    value={form[key]}
                    onChange={(e) =>
                      setForm((previous) => ({
                        ...previous,
                        [key]: e.target.value,
                      }))
                    }
                  >
                    <option value="">Chọn điểm</option>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
              <label>
                Nhận xét
                <textarea
                  rows={4}
                  maxLength={2000}
                  disabled={disabled}
                  value={form.comment}
                  onChange={(e) =>
                    setForm((previous) => ({
                      ...previous,
                      comment: e.target.value,
                    }))
                  }
                />
              </label>
              <div className="ws-final-modal-actions">
                <Button
                  variant="secondary"
                  disabled={disabled}
                  onClick={() => setReviewComposerOpen(false)}
                >
                  Đóng
                </Button>
                <Button type="submit" disabled={disabled}>
                  Gửi đánh giá
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
