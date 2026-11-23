import { useState } from "react";
import {
  CheckCircle2,
  Clock3,
  FileCheck2,
  FileText,
  GitPullRequest,
  LockKeyhole,
  Send,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Progress,
  Stars,
} from "../../components/ui";
import { acceptanceBlockers, risks, type Review } from "./model";
import { dateLabel, money, type PanelProps } from "./RecruitmentPanels";

export function ScopePanel({ state, role, dispatch, busy }: PanelProps) {
  const [draft, setDraft] = useState(state.scope);
  const editable =
    !!state.selectedId && !state.scope.locked && role !== "Admin";
  return (
    <div className="v2-two-col">
      <Card
        eyebrow={`SCOPE VERSION ${state.scope.version}`}
        title="Cùng thống nhất. Cùng cam kết."
        action={
          <Badge tone={state.scope.locked ? "green" : "amber"}>
            <LockKeyhole size={13} />
            {state.scope.locked ? "Đã khóa" : "Chờ hai bên duyệt"}
          </Badge>
        }
      >
        {!state.selectedId && (
          <div className="v2-note">
            Chọn một Freelancer tại Proposal trước khi duyệt Scope.
          </div>
        )}
        <form
          className="v2-form"
          onSubmit={(e) => {
            e.preventDefault();
            void dispatch({ type: "SAVE_SCOPE", scope: draft });
          }}
        >
          <label>
            Sản phẩm bàn giao
            <textarea
              rows={5}
              disabled={!editable}
              value={draft.deliverables}
              onChange={(e) =>
                setDraft({ ...draft, deliverables: e.target.value })
              }
            />
          </label>
          <label>
            Ngoài phạm vi
            <textarea
              rows={3}
              disabled={!editable}
              value={draft.exclusions}
              onChange={(e) =>
                setDraft({ ...draft, exclusions: e.target.value })
              }
            />
          </label>
          <label>
            Tiêu chí nghiệm thu
            <textarea
              rows={3}
              disabled={!editable}
              value={draft.criteria}
              onChange={(e) => setDraft({ ...draft, criteria: e.target.value })}
            />
          </label>
          <div className="v2-form-grid">
            <label>
              Ngân sách
              <input
                type="number"
                min={1}
                disabled={!editable}
                value={draft.budget}
                onChange={(e) =>
                  setDraft({ ...draft, budget: Number(e.target.value) })
                }
              />
            </label>
            <label>
              Deadline
              <input
                type="date"
                disabled={!editable}
                value={draft.deadline}
                onChange={(e) =>
                  setDraft({ ...draft, deadline: e.target.value })
                }
              />
            </label>
          </div>
          {editable && (
            <Button type="submit" variant="secondary" disabled={busy}>
              Lưu nội dung Scope
            </Button>
          )}
        </form>
      </Card>
      <div className="v2-stack">
        <Card title="Phê duyệt hai bên">
          <p className="v2-muted">
            Hai bên phải duyệt cùng phiên bản. Mọi chỉnh sửa bản nháp sẽ xóa các
            xác nhận trước đó.
          </p>
          {(["Client", "Freelancer"] as const).map((r) => (
            <div className="v2-approval" key={r}>
              <div className="v2-avatar small">
                {r === "Client" ? "CL" : "FL"}
              </div>
              <div>
                <b>{r}</b>
                <small>
                  {state.scope.approvals.includes(r)
                    ? `Đã duyệt v${state.scope.version}`
                    : "Chờ xác nhận"}
                </small>
              </div>
              {state.scope.approvals.includes(r) ? (
                <CheckCircle2 className="v2-green" size={20} />
              ) : (
                <Clock3 className="v2-muted" size={20} />
              )}
            </div>
          ))}
          {editable && (
            <Button
              disabled={
                busy ||
                state.scope.approvals.includes(role) ||
                JSON.stringify(draft) !== JSON.stringify(state.scope)
              }
              onClick={() =>
                void dispatch({
                  type: "APPROVE_SCOPE",
                  version: state.scope.version,
                })
              }
            >
              <ShieldCheck size={16} />
              Duyệt Scope v{state.scope.version}
            </Button>
          )}
          <p className="v2-muted">
            Lưu mọi chỉnh sửa trước khi duyệt. Scope đã khóa chỉ được thay đổi
            qua Change Request.
          </p>
        </Card>
        <Card title="Lịch sử phiên bản">
          {state.scopeHistory.map((s) => (
            <div className="v2-history-row" key={s.version}>
              <FileText size={18} />
              <span>
                Scope v{s.version}
                <small>
                  {money(s.budget)} · {dateLabel(s.deadline)}
                </small>
              </span>
              <Badge>Đã thay thế</Badge>
            </div>
          ))}
          <div className="v2-history-row">
            <FileCheck2 size={18} />
            <span>
              Scope v{state.scope.version}
              <small>Phiên bản hiện tại</small>
            </span>
            <Badge tone="green">Hiện tại</Badge>
          </div>
        </Card>
      </div>
    </div>
  );
}

export function MilestonesPanel({ state, role, dispatch, busy }: PanelProps) {
  const [notes, setNotes] = useState<Record<string, string>>({});
  const approved = state.milestones.filter(
    (m) => m.status === "APPROVED",
  ).length;
  const status = {
    PLANNED: "Đã lên kế hoạch",
    IN_PROGRESS: "Đang thực hiện",
    SUBMITTED: "Chờ nghiệm thu",
    REVISION_REQUESTED: "Cần chỉnh sửa",
    APPROVED: "Đã nghiệm thu",
  };
  const active = state.scope.locked && !state.acceptedAt;
  return (
    <div className="v2-stack">
      <Card>
        <div className="v2-section-intro">
          <div>
            <h2>Từng cột mốc, một bước tiến.</h2>
            <p className="v2-muted">
              {approved}/{state.milestones.length} milestone đã được nghiệm thu
            </p>
          </div>
          <Badge tone="green">
            {Math.round((approved / state.milestones.length) * 100)}% hoàn thành
          </Badge>
        </div>
        <Progress
          value={(approved / state.milestones.length) * 100}
          label="Tiến độ dự án"
        />
        {!state.scope.locked && (
          <p className="v2-muted">
            Khóa Scope để bắt đầu nộp và duyệt sản phẩm.
          </p>
        )}
      </Card>
      {state.milestones.map((m, i) => (
        <Card key={m.id} className="v2-milestone">
          <div className="v2-milestone-top">
            <div className={`v2-step ${m.status === "APPROVED" ? "done" : ""}`}>
              {m.status === "APPROVED" ? (
                <CheckCircle2 />
              ) : (
                String(i + 1).padStart(2, "0")
              )}
            </div>
            <div className="v2-grow">
              <h3>{m.title}</h3>
              <p className="v2-muted">{m.description}</p>
            </div>
            <Badge
              tone={
                m.status === "APPROVED"
                  ? "green"
                  : m.status === "REVISION_REQUESTED"
                    ? "amber"
                    : "neutral"
              }
            >
              {status[m.status]}
            </Badge>
          </div>
          <div className="v2-milestone-meta">
            <span>
              <Clock3 size={15} />
              {dateLabel(m.due)}
            </span>
            <b>{money(m.amount)}</b>
            <span>{m.required ? "Bắt buộc" : "Tùy chọn"}</span>
          </div>
          {m.submissions.length > 0 && (
            <details className="v2-match-details">
              <summary>
                <FileText size={16} />
                Lịch sử bàn giao ({m.submissions.length})
              </summary>
              {m.submissions.map((s, index) => (
                <div className="v2-history-entry" key={index}>
                  <b>
                    Lần {index + 1} · {dateLabel(s.at)}
                  </b>
                  <p>{s.note}</p>
                  {m.feedback[index] && (
                    <p className="v2-feedback">
                      Yêu cầu sửa: {m.feedback[index]}
                    </p>
                  )}
                </div>
              ))}
            </details>
          )}
          {active &&
            role !== "Admin" &&
            m.status !== "APPROVED" &&
            ((role === "Freelancer" && m.status !== "SUBMITTED") ||
              (role === "Client" && m.status === "SUBMITTED")) && (
              <div className="v2-form">
                <label>
                  {role === "Freelancer"
                    ? "Bằng chứng bàn giao / đường dẫn sản phẩm"
                    : "Nhận xét nghiệm thu"}
                  <textarea
                    rows={2}
                    value={notes[m.id] || ""}
                    onChange={(e) =>
                      setNotes({ ...notes, [m.id]: e.target.value })
                    }
                    placeholder={
                      role === "Freelancer"
                        ? "Mô tả kết quả và đường dẫn đối chiếu với tiêu chí…"
                        : "Nêu rõ nội dung cần chỉnh sửa nếu chưa đạt…"
                    }
                  />
                </label>
                <div className="v2-actions">
                  {role === "Freelancer" ? (
                    <Button
                      disabled={busy || (notes[m.id] || "").trim().length < 10}
                      onClick={() =>
                        void dispatch({
                          type: "SUBMIT_MILESTONE",
                          id: m.id,
                          note: notes[m.id] || "",
                        })
                      }
                    >
                      <Send size={15} />
                      Nộp bàn giao
                    </Button>
                  ) : (
                    <>
                      <Button
                        variant="secondary"
                        disabled={
                          busy || (notes[m.id] || "").trim().length < 10
                        }
                        onClick={() =>
                          void dispatch({
                            type: "REVIEW_MILESTONE",
                            id: m.id,
                            approve: false,
                            note: notes[m.id] || "",
                          })
                        }
                      >
                        Yêu cầu chỉnh sửa
                      </Button>
                      <Button
                        disabled={busy}
                        onClick={() =>
                          void dispatch({
                            type: "REVIEW_MILESTONE",
                            id: m.id,
                            approve: true,
                            note: "",
                          })
                        }
                      >
                        <CheckCircle2 size={16} />
                        Duyệt milestone
                      </Button>
                    </>
                  )}
                </div>
              </div>
            )}
        </Card>
      ))}
    </div>
  );
}

export function ChangesPanel({ state, role, dispatch, busy }: PanelProps) {
  const [form, setForm] = useState({
    title: "",
    reason: "",
    deliverable: "",
    budgetDelta: 0,
    daysDelta: 0,
  });
  const pending = state.changes.some((c) => c.status === "UNDER_REVIEW");
  return (
    <div className="v2-two-col">
      <Card title="Yêu cầu thay đổi" eyebrow="CHANGE REQUEST">
        <p className="v2-muted">
          Làm rõ tác động trước khi thay đổi. Scope hiện tại vẫn có hiệu lực đến
          khi cả hai bên đồng ý.
        </p>
        {role === "Admin" || !state.scope.locked || state.acceptedAt ? (
          <EmptyState icon={<LockKeyhole />} title="Chưa thể tạo yêu cầu">
            <p>
              Cần dự án đang thực hiện và Scope đã khóa. Admin chỉ có quyền giám
              sát.
            </p>
          </EmptyState>
        ) : (
          <form
            className="v2-form"
            onSubmit={async (e) => {
              e.preventDefault();
              if (await dispatch({ type: "CREATE_CHANGE", change: form }))
                setForm({
                  title: "",
                  reason: "",
                  deliverable: "",
                  budgetDelta: 0,
                  daysDelta: 0,
                });
            }}
          >
            <label>
              Tên thay đổi
              <input
                required
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Ví dụ: Bổ sung báo cáo xuất Excel"
              />
            </label>
            <label>
              Lý do thay đổi
              <textarea
                required
                minLength={10}
                rows={3}
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
              />
            </label>
            <label>
              Sản phẩm bàn giao bổ sung
              <textarea
                required
                rows={3}
                value={form.deliverable}
                onChange={(e) =>
                  setForm({ ...form, deliverable: e.target.value })
                }
              />
            </label>
            <div className="v2-form-grid">
              <label>
                Thay đổi ngân sách (VND)
                <input
                  type="number"
                  value={form.budgetDelta}
                  onChange={(e) =>
                    setForm({ ...form, budgetDelta: Number(e.target.value) })
                  }
                />
              </label>
              <label>
                Thêm số ngày
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={form.daysDelta}
                  onChange={(e) =>
                    setForm({ ...form, daysDelta: Number(e.target.value) })
                  }
                />
              </label>
            </div>
            <div className="v2-note">
              <GitPullRequest size={18} />
              <span>
                Ngân sách sau thay đổi:{" "}
                <b>{money(state.scope.budget + form.budgetDelta)}</b>. Một
                milestone bắt buộc mới sẽ được tạo khi duyệt.
              </span>
            </div>
            <Button type="submit" disabled={busy || pending}>
              Gửi yêu cầu thay đổi
            </Button>
            {pending && (
              <p className="v2-muted">
                Xử lý yêu cầu đang chờ trước khi tạo yêu cầu mới.
              </p>
            )}
          </form>
        )}
      </Card>
      <div className="v2-stack">
        {state.changes.length === 0 ? (
          <Card>
            <EmptyState
              icon={<GitPullRequest size={28} />}
              title="Phạm vi đang ổn định"
            >
              <p>Chưa có yêu cầu thay đổi nào.</p>
            </EmptyState>
          </Card>
        ) : (
          state.changes.map((c) => (
            <Card
              key={c.id}
              title={c.title}
              eyebrow={`${c.id} · SCOPE V${c.baseVersion}`}
              action={
                <Badge
                  tone={
                    c.status === "APPLIED"
                      ? "green"
                      : c.status === "REJECTED"
                        ? "red"
                        : "amber"
                  }
                >
                  {c.status === "APPLIED"
                    ? "Đã áp dụng"
                    : c.status === "REJECTED"
                      ? "Đã từ chối"
                      : "Chờ duyệt"}
                </Badge>
              }
            >
              <p>{c.reason}</p>
              <p className="v2-muted">{c.deliverable}</p>
              <div className="v2-facts">
                <div>
                  <small>NGÂN SÁCH</small>
                  <b>
                    {c.budgetDelta >= 0 ? "+" : ""}
                    {money(c.budgetDelta)}
                  </b>
                </div>
                <div>
                  <small>THỜI HẠN</small>
                  <b>+{c.daysDelta} ngày</b>
                </div>
              </div>
              <p className="v2-muted">Đã xác nhận: {c.approvals.join(", ")}</p>
              {c.status === "UNDER_REVIEW" &&
                role !== "Admin" &&
                !c.approvals.includes(role) && (
                  <div className="v2-actions">
                    <Button
                      variant="secondary"
                      disabled={busy}
                      onClick={() =>
                        void dispatch({
                          type: "REVIEW_CHANGE",
                          id: c.id,
                          approve: false,
                        })
                      }
                    >
                      Từ chối
                    </Button>
                    <Button
                      disabled={busy}
                      onClick={() =>
                        void dispatch({
                          type: "REVIEW_CHANGE",
                          id: c.id,
                          approve: true,
                        })
                      }
                    >
                      Duyệt & áp dụng
                    </Button>
                  </div>
                )}
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

export function RisksPanel({ state }: PanelProps) {
  const alerts = risks(state);
  return (
    <div className="v2-stack">
      <div className="v2-section-intro">
        <div>
          <h2>Chủ động trước mọi rủi ro.</h2>
          <p className="v2-muted">
            Cảnh báo dựa trên deadline, nhịp cập nhật và số lần yêu cầu chỉnh
            sửa.
          </p>
        </div>
        <Badge tone={alerts.length ? "amber" : "green"}>
          {alerts.length} cảnh báo
        </Badge>
      </div>
      {alerts.length ? (
        alerts.map((alert) => (
          <Card
            title={alert.title}
            key={alert.id}
            action={
              <Badge tone={alert.level === "high" ? "red" : "amber"}>
                <TriangleAlert size={14} />
                {alert.level === "high" ? "Ưu tiên cao" : "Cần chú ý"}
              </Badge>
            }
          >
            <p>{alert.detail}</p>
          </Card>
        ))
      ) : (
        <Card>
          <EmptyState
            icon={<ShieldCheck size={36} className="v2-green" />}
            title="Mọi thứ đang trong tầm kiểm soát"
          >
            <p>Chưa phát hiện rủi ro theo dữ liệu demo hiện tại.</p>
          </EmptyState>
        </Card>
      )}
      <Card title="Quy tắc theo dõi">
        <div className="v2-three-col">
          {[
            ["Quá hạn", "Milestone chưa được duyệt sau ngày bàn giao."],
            ["Ít cập nhật", "Dự án đang chạy không có cập nhật trong 7 ngày."],
            ["Sửa nhiều lần", "Milestone có từ 2 yêu cầu chỉnh sửa."],
          ].map(([title, text]) => (
            <div key={title}>
              <h3>{title}</h3>
              <p className="v2-muted">{text}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

export function AcceptancePanel({ state, role, dispatch, busy }: PanelProps) {
  const blockers = acceptanceBlockers(state);
  const [confirmed, setConfirmed] = useState(false);
  const [review, setReview] = useState<Review>({
    overall: 0,
    quality: 0,
    timeliness: 0,
    communication: 0,
    professionalism: 0,
    comment: "",
  });
  const ratings: [keyof Omit<Review, "comment">, string][] = [
    ["overall", "Tổng thể"],
    ["quality", "Chất lượng"],
    ["timeliness", "Tiến độ"],
    ["communication", "Giao tiếp"],
    ["professionalism", "Chuyên nghiệp"],
  ];
  return (
    <div className="v2-two-col">
      <Card
        eyebrow="FINAL ACCEPTANCE"
        title={
          state.acceptedAt
            ? "Một dự án. Một thành công mới."
            : "Sẵn sàng cho bước cuối cùng."
        }
        action={
          <Badge tone={state.acceptedAt ? "green" : "amber"}>
            {state.acceptedAt ? "COMPLETED" : "Chờ nghiệm thu"}
          </Badge>
        }
      >
        <p className="v2-muted">
          Kiểm tra các sản phẩm bàn giao trước khi xác nhận hoàn thành dự án.
        </p>
        <div className="v2-checklist">
          {state.milestones.map((m) => (
            <div key={m.id}>
              <CheckCircle2
                className={m.status === "APPROVED" ? "v2-green" : "v2-muted"}
                size={20}
              />
              <span>{m.title}</span>
              <Badge tone={m.status === "APPROVED" ? "green" : "neutral"}>
                {m.status === "APPROVED" ? "Đạt" : "Chưa đạt"}
              </Badge>
            </div>
          ))}
        </div>
        <div className="v2-facts">
          <div>
            <small>GIÁ TRỊ SCOPE HIỆN TẠI</small>
            <b>{money(state.scope.budget)}</b>
          </div>
          <div>
            <small>PHIÊN BẢN</small>
            <b>Scope v{state.scope.version}</b>
          </div>
        </div>
        {blockers.length > 0 && (
          <div className="v2-note">
            <LockKeyhole size={18} />
            <div>
              {blockers.map((b) => (
                <p key={b}>{b}</p>
              ))}
            </div>
          </div>
        )}
        {!state.acceptedAt && role === "Client" && (
          <>
            <label className="v2-checkbox">
              <input
                type="checkbox"
                checked={confirmed}
                disabled={!!blockers.length}
                onChange={(e) => setConfirmed(e.target.checked)}
              />
              Tôi đã đối chiếu kết quả bàn giao với Scope đã khóa.
            </label>
            <Button
              disabled={busy || !!blockers.length || !confirmed}
              onClick={() => void dispatch({ type: "ACCEPT" })}
            >
              <CheckCircle2 size={17} />
              Xác nhận nghiệm thu cuối
            </Button>
          </>
        )}
        {state.acceptedAt && (
          <div className="v2-note">
            <CheckCircle2 size={20} />
            <span>
              Đã nghiệm thu ngày {dateLabel(state.acceptedAt)}. Cảm ơn hai bên
              đã hợp tác.
            </span>
          </div>
        )}
      </Card>
      <Card title="Ghi nhận cộng sự của bạn" eyebrow="ĐÁNH GIÁ FREELANCER">
        {state.review ? (
          <>
            <Stars value={state.review.overall} />
            <h3>{state.review.overall}/5 · Đã đánh giá</h3>
            <p>{state.review.comment}</p>
            {ratings.slice(1).map(([key, label]) => (
              <div className="v2-rating-row" key={key}>
                <span>{label}</span>
                <Stars value={state.review![key]} />
              </div>
            ))}
            <p className="v2-muted">Mỗi dự án chỉ có một đánh giá.</p>
          </>
        ) : !state.acceptedAt || role !== "Client" ? (
          <EmptyState
            icon={<LockKeyhole size={28} />}
            title="Đánh giá sau khi hoàn thành"
          >
            <p>
              Client được đánh giá từ 1–5 sao sau Final Acceptance. Chưa có đánh
              giá cho dự án này.
            </p>
          </EmptyState>
        ) : (
          <form
            className="v2-form"
            onSubmit={(e) => {
              e.preventDefault();
              void dispatch({ type: "REVIEW", review });
            }}
          >
            {ratings.map(([key, label]) => (
              <div className="v2-rating-row" key={key}>
                <span>{label}</span>
                <Stars
                  label={label}
                  value={review[key]}
                  onChange={(n) => setReview({ ...review, [key]: n })}
                />
              </div>
            ))}
            <label>
              Nhận xét
              <textarea
                rows={4}
                value={review.comment}
                onChange={(e) =>
                  setReview({ ...review, comment: e.target.value })
                }
                placeholder="Chia sẻ về trải nghiệm hợp tác…"
              />
            </label>
            <Button
              type="submit"
              disabled={busy || ratings.some(([key]) => !review[key])}
            >
              Gửi đánh giá
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}
