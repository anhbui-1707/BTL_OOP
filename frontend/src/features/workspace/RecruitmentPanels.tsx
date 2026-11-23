import { useState } from "react";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  FileText,
  ShieldCheck,
  Sparkles,
  Star,
} from "lucide-react";
import { Badge, Button, Card, Progress } from "../../components/ui";
import {
  compatibility,
  qualityScore,
  QUALITY_POLICY,
  type Action,
  type Candidate,
  type Role,
  type Workspace,
} from "./model";

export const money = (value: number) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value);
export const dateLabel = (date: string) =>
  new Intl.DateTimeFormat("vi-VN").format(new Date(date));
export interface PanelProps {
  state: Workspace;
  role: Role;
  dispatch: (action: Action) => Promise<boolean>;
  busy: boolean;
}

export function QualityPanel({ state, role, dispatch, busy }: PanelProps) {
  const [draft, setDraft] = useState(state.job);
  const quality = qualityScore(draft);
  const readOnly = state.published || role !== "Client";
  const update = (key: keyof typeof draft, value: string | number | string[]) =>
    setDraft({ ...draft, [key]: value });
  return (
    <div className="v2-two-col">
      <Card
        eyebrow="JOB QUALITY SCORE"
        title="Một tin tốt. Một khởi đầu tốt."
        action={
          <Badge tone={state.published ? "green" : "amber"}>
            {state.published ? "Đã đăng · Demo" : "Bản nháp"}
          </Badge>
        }
      >
        <p className="v2-muted">
          Thông tin rõ ràng giúp chuyên gia hiểu đúng kỳ vọng của bạn.
        </p>
        <form
          className="v2-form"
          onSubmit={async (e) => {
            e.preventDefault();
            await dispatch({ type: "SAVE_JOB", job: draft });
          }}
        >
          <label>
            Tên dự án
            <input
              required
              minLength={10}
              value={draft.title}
              disabled={readOnly}
              onChange={(e) => update("title", e.target.value)}
            />
          </label>
          <label>
            Mô tả dự án
            <textarea
              required
              minLength={80}
              rows={5}
              value={draft.description}
              disabled={readOnly}
              onChange={(e) => update("description", e.target.value)}
            />
          </label>
          <label>
            Kỹ năng, phân cách bằng dấu phẩy
            <input
              value={draft.skills.join(", ")}
              disabled={readOnly}
              onChange={(e) =>
                update(
                  "skills",
                  e.target.value.split(",").map((s) => s.trim()),
                )
              }
            />
          </label>
          <div className="v2-form-grid">
            <label>
              Ngân sách (VND)
              <input
                type="number"
                min={1}
                value={draft.budget}
                disabled={readOnly}
                onChange={(e) => update("budget", Number(e.target.value))}
              />
            </label>
            <label>
              Deadline
              <input
                type="date"
                value={draft.deadline}
                disabled={readOnly}
                onChange={(e) => update("deadline", e.target.value)}
              />
            </label>
          </div>
          <label>
            Tiêu chí nghiệm thu
            <textarea
              required
              minLength={30}
              rows={3}
              value={draft.criteria}
              disabled={readOnly}
              onChange={(e) => update("criteria", e.target.value)}
            />
          </label>
          {!readOnly && (
            <div className="v2-actions">
              <Button type="submit" variant="secondary" disabled={busy}>
                Lưu bản nháp
              </Button>
              <Button
                disabled={!quality.publishable || busy}
                onClick={async () => {
                  if (await dispatch({ type: "SAVE_JOB", job: draft }))
                    await dispatch({ type: "PUBLISH" });
                }}
              >
                Đăng dự án <ArrowRight size={16} />
              </Button>
            </div>
          )}
        </form>
      </Card>
      <div>
        <Card title="Chất lượng tin tuyển dụng" eyebrow="RÕ RÀNG TỪ ĐẦU">
          <div className="v2-score">
            <span>{quality.score}</span>
            <small>/100</small>
          </div>
          <Progress value={quality.score} label="Job Quality Score" />
          <p className="v2-muted">
            {quality.publishable
              ? "Đã đáp ứng các tiêu chí của bản demo."
              : "Hoàn thiện thông tin để sẵn sàng đăng tin."}
          </p>
          <div className="v2-checklist">
            {quality.checks.map((check) => (
              <div key={check.label}>
                <CheckCircle2
                  size={18}
                  className={check.passed ? "v2-green" : "v2-muted"}
                />
                <span>{check.label}</span>
                <b>
                  {check.passed ? check.points : 0}/{check.points}
                </b>
              </div>
            ))}
          </div>
          <div className="v2-note">
            <ShieldCheck size={18} />
            <span>
              Quy tắc minh họa: ngưỡng {QUALITY_POLICY.threshold}/100 và đầy đủ
              các trường bắt buộc. Chưa phải kết quả chấm từ máy chủ.
            </span>
          </div>
        </Card>
      </div>
    </div>
  );
}

function CandidateDetails({
  candidate,
  state,
}: {
  candidate: Candidate;
  state: Workspace;
}) {
  const match = compatibility(state.job, candidate);
  return (
    <details className="v2-match-details">
      <summary>
        <Sparkles size={15} /> Vì sao phù hợp {match.score}%?
      </summary>
      <div className="v2-factor-list">
        {match.factors.map((factor) => (
          <div key={factor.label}>
            <div>
              <span>{factor.label}</span>
              <b>
                {factor.earned}/{factor.max}
              </b>
            </div>
            <Progress
              value={(factor.earned / factor.max) * 100}
              label={factor.label}
            />
          </div>
        ))}
      </div>
      <p className="v2-muted">
        Khớp kỹ năng: {match.matched.join(", ") || "Chưa có"}. Phiên bản:{" "}
        {match.algorithmVersion}. Điểm chỉ hỗ trợ so sánh, Client quyết định lựa
        chọn.
      </p>
    </details>
  );
}
export function CandidatesPanel({
  state,
  role,
  dispatch,
  busy,
  matching = false,
}: PanelProps & { matching?: boolean }) {
  const [filter, setFilter] = useState("all");
  const [confirm, setConfirm] = useState<string | null>(null);
  const candidates = state.candidates
    .filter((c) => filter === "all" || c.status === filter)
    .sort(
      (a, b) =>
        compatibility(state.job, b).score - compatibility(state.job, a).score,
    );
  const status = {
    SUBMITTED: "Đã gửi",
    SHORTLISTED: "Shortlist",
    ACCEPTED: "Đã chọn",
    REJECTED: "Không được chọn",
  };
  return (
    <div className="v2-stack">
      <div className="v2-section-intro">
        <div>
          <h2>
            {matching
              ? "Đúng chuyên môn. Đúng cộng sự."
              : role === "Freelancer"
                ? "Proposal & kết quả lựa chọn"
                : "Những đề xuất dành cho bạn"}
          </h2>
          <p className="v2-muted">
            {matching
              ? "So sánh năng lực và xem rõ từng yếu tố phù hợp với dự án."
              : "Chọn một Freelancer để bắt đầu thống nhất phạm vi dự án."}
          </p>
        </div>
        <label className="v2-filter">
          Trạng thái
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">Tất cả Proposal</option>
            <option value="SUBMITTED">Đã gửi</option>
            <option value="SHORTLISTED">Shortlist</option>
            <option value="ACCEPTED">Đã chọn</option>
          </select>
        </label>
      </div>
      {role === "Freelancer" && (
        <div className="v2-note">
          <FileText size={18} />
          <span>
            Đây là bộ Proposal mẫu để so sánh giao diện. Proposal thật của bạn
            được quản lý tại “Đề xuất đã gửi”.
          </span>
        </div>
      )}
      <div className="v2-candidate-grid">
        {candidates.map((c) => (
          <Card
            key={c.id}
            className={state.selectedId === c.id ? "v2-selected-card" : ""}
          >
            <div className="v2-candidate-heading">
              <div className="v2-avatar">{c.initials}</div>
              <Badge tone="green">
                <Sparkles size={13} />
                {compatibility(state.job, c).score}% phù hợp
              </Badge>
            </div>
            <h3>{c.name}</h3>
            <p className="v2-muted">{c.title}</p>
            <div className="v2-inline">
              <Star size={15} className="v2-gold" />
              <b>{c.rating ?? "Chưa có đánh giá"}</b>
              {c.reviews > 0 && (
                <span className="v2-muted">({c.reviews} đánh giá)</span>
              )}
            </div>
            <div className="v2-tags">
              {c.skills.map((skill) => (
                <span key={skill}>{skill}</span>
              ))}
            </div>
            <p className="v2-cover">{c.cover}</p>
            <div className="v2-facts">
              <div>
                <small>GIÁ ĐỀ XUẤT</small>
                <b>{money(c.price)}</b>
              </div>
              <div>
                <small>THỜI GIAN</small>
                <b>{c.days} ngày</b>
              </div>
            </div>
            <div className="v2-inline">
              <span className={c.available ? "v2-availability" : "v2-muted"}>
                {c.available ? "● Sẵn sàng bắt đầu" : "Cần xác nhận lịch"}
              </span>
              <Badge tone={c.status === "ACCEPTED" ? "green" : "neutral"}>
                {status[c.status]}
              </Badge>
            </div>
            <CandidateDetails candidate={c} state={state} />
            {role === "Client" && state.published && !state.selectedId && (
              <div className="v2-actions">
                <Button
                  variant="secondary"
                  disabled={busy || c.status !== "SUBMITTED"}
                  onClick={() => void dispatch({ type: "SHORTLIST", id: c.id })}
                >
                  {c.status === "SHORTLISTED" ? <Check size={16} /> : null}{" "}
                  Shortlist
                </Button>
                <Button disabled={busy} onClick={() => setConfirm(c.id)}>
                  Chọn Freelancer
                </Button>
              </div>
            )}
            {confirm === c.id && (
              <div
                className="v2-confirm"
                role="group"
                aria-label="Xác nhận chọn Freelancer"
              >
                <p>
                  Mỗi Job chỉ chọn một Freelancer. Các Proposal còn lại sẽ
                  chuyển sang không được chọn trong demo.
                </p>
                <div className="v2-actions">
                  <Button variant="secondary" onClick={() => setConfirm(null)}>
                    Quay lại
                  </Button>
                  <Button
                    disabled={busy}
                    onClick={async () => {
                      if (await dispatch({ type: "SELECT", id: c.id }))
                        setConfirm(null);
                    }}
                  >
                    Xác nhận chọn
                  </Button>
                </div>
              </div>
            )}
          </Card>
        ))}
      </div>
      {candidates.length === 0 && (
        <Card>
          <p>Không có Proposal ở trạng thái này.</p>
        </Card>
      )}
    </div>
  );
}
