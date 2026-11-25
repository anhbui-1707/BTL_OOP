import { useEffect, useRef, useState, type DependencyList } from "react";
import {
  CheckCircle2,
  Clock3,
  LoaderCircle,
  TriangleAlert,
  Building2,
  ClipboardCheck,
  Check,
  Quote,
  Star,
} from "lucide-react";
import {
  Button,
  RichDescription,
  Stars,
} from "../../components/ui";
import { ApiError } from "../../api/http";
import {
  acceptanceApi,
  reviewsApi,
  type Acceptance,
} from "../../api/lifecycle";
import { party } from "./productionModel";
import {
  acceptanceConditions,
  acceptanceEvidence,
  acceptanceNote,
  allMilestones,
  blankReview,
  canAccept,
  canReview,
  ratingFields,
  reviewInput,
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
