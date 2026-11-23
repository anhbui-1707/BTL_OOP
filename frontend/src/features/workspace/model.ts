export type Role = "Client" | "Freelancer" | "Admin";
export type Section =
  | "overview"
  | "quality"
  | "matching"
  | "proposals"
  | "scope"
  | "milestones"
  | "changes"
  | "risks"
  | "acceptance";
export interface JobDraft {
  title: string;
  description: string;
  skills: string[];
  budget: number;
  deadline: string;
  criteria: string;
}
export interface Candidate {
  id: string;
  name: string;
  title: string;
  initials: string;
  skills: string[];
  years: number;
  portfolioCount: number;
  price: number;
  days: number;
  available: boolean;
  rating: number | null;
  reviews: number;
  cover: string;
  status: "SUBMITTED" | "SHORTLISTED" | "ACCEPTED" | "REJECTED";
}
export interface Scope {
  version: number;
  deliverables: string;
  exclusions: string;
  criteria: string;
  budget: number;
  deadline: string;
  approvals: Role[];
  locked: boolean;
}
export interface Submission {
  note: string;
  at: string;
}
export interface Milestone {
  id: string;
  title: string;
  description: string;
  due: string;
  amount: number;
  required: boolean;
  status:
    | "PLANNED"
    | "IN_PROGRESS"
    | "SUBMITTED"
    | "REVISION_REQUESTED"
    | "APPROVED";
  submissions: Submission[];
  feedback: string[];
}
export interface ChangeRequest {
  id: string;
  title: string;
  reason: string;
  deliverable: string;
  budgetDelta: number;
  daysDelta: number;
  baseVersion: number;
  approvals: Role[];
  status: "UNDER_REVIEW" | "APPLIED" | "REJECTED";
}
export interface Review {
  overall: number;
  quality: number;
  timeliness: number;
  communication: number;
  professionalism: number;
  comment: string;
}
export interface Workspace {
  id: string;
  company: string;
  job: JobDraft;
  published: boolean;
  candidates: Candidate[];
  selectedId: string | null;
  scope: Scope;
  scopeHistory: Scope[];
  milestones: Milestone[];
  changes: ChangeRequest[];
  acceptedAt: string | null;
  review: Review | null;
  activity: { text: string; at: string }[];
}
export type Action =
  | { type: "SAVE_JOB"; job: JobDraft }
  | { type: "PUBLISH" }
  | { type: "SHORTLIST"; id: string }
  | { type: "SELECT"; id: string }
  | { type: "SAVE_SCOPE"; scope: Scope }
  | { type: "APPROVE_SCOPE"; version: number }
  | { type: "SUBMIT_MILESTONE"; id: string; note: string }
  | { type: "REVIEW_MILESTONE"; id: string; approve: boolean; note: string }
  | {
      type: "CREATE_CHANGE";
      change: Omit<
        ChangeRequest,
        "id" | "baseVersion" | "approvals" | "status"
      >;
    }
  | { type: "REVIEW_CHANGE"; id: string; approve: boolean }
  | { type: "ACCEPT" }
  | { type: "REVIEW"; review: Review };

export const QUALITY_POLICY = { version: "quality-preview-v1", threshold: 80 };
export function qualityScore(
  job: JobDraft,
  today = new Date().toISOString().slice(0, 10),
) {
  const checks = [
    {
      label: "Tên dự án rõ ràng",
      points: 10,
      passed: job.title.trim().length >= 10,
    },
    {
      label: "Mô tả đủ ngữ cảnh (tối thiểu 80 ký tự)",
      points: 25,
      passed: job.description.trim().length >= 80,
    },
    {
      label: "Có kỹ năng yêu cầu",
      points: 15,
      passed: job.skills.some((s) => s.trim()),
    },
    {
      label: "Ngân sách hợp lệ",
      points: 15,
      passed: Number.isFinite(job.budget) && job.budget > 0,
    },
    {
      label: "Deadline trong tương lai",
      points: 15,
      passed: /^\d{4}-\d{2}-\d{2}$/.test(job.deadline) && job.deadline > today,
    },
    {
      label: "Tiêu chí nghiệm thu cụ thể",
      points: 20,
      passed: job.criteria.trim().length >= 30,
    },
  ];
  const score = checks.reduce(
    (sum, check) => sum + (check.passed ? check.points : 0),
    0,
  );
  return {
    checks,
    score,
    publishable:
      checks.every((c) => c.passed) && score >= QUALITY_POLICY.threshold,
  };
}
export function compatibility(job: JobDraft, candidate: Candidate) {
  const matched = job.skills.filter((skill) =>
    candidate.skills.some((s) => s.toLowerCase() === skill.toLowerCase()),
  );
  const factors = [
    {
      label: "Kỹ năng",
      earned: job.skills.length
        ? Math.round((40 * matched.length) / job.skills.length)
        : 0,
      max: 40,
    },
    { label: "Kinh nghiệm", earned: Math.min(candidate.years, 5) * 3, max: 15 },
    {
      label: "Portfolio",
      earned: Math.min(candidate.portfolioCount, 3) * 5,
      max: 15,
    },
    {
      label: "Ngân sách",
      earned: candidate.price <= job.budget ? 10 : 0,
      max: 10,
    },
    { label: "Khả dụng", earned: candidate.available ? 10 : 0, max: 10 },
    {
      label: "Uy tín",
      earned: candidate.rating == null ? 0 : Math.round(candidate.rating * 2),
      max: 10,
    },
  ];
  return {
    factors,
    score: factors.reduce((n, f) => n + f.earned, 0),
    matched,
    algorithmVersion: "matching-preview-v1",
  };
}
export function acceptanceBlockers(state: Workspace) {
  return [
    ...(!state.selectedId ? ["Chưa chọn Freelancer"] : []),
    ...(!state.scope.locked ? ["Scope chưa được hai bên khóa"] : []),
    ...(!state.milestones.some((m) => m.required) ||
    state.milestones.some((m) => m.required && m.status !== "APPROVED")
      ? ["Milestone bắt buộc chưa được duyệt đầy đủ"]
      : []),
    ...(state.changes.some((c) => c.status === "UNDER_REVIEW")
      ? ["Còn yêu cầu thay đổi đang chờ xử lý"]
      : []),
  ];
}
export function risks(
  state: Workspace,
  today = new Date().toISOString().slice(0, 10),
) {
  return state.milestones
    .flatMap((m) => [
      ...(m.due < today && m.status !== "APPROVED"
        ? [
            {
              id: `${m.id}-late`,
              level: "high",
              title: `${m.title}: quá hạn`,
              detail:
                "Thống nhất lại kế hoạch và gửi Change Request nếu cần đổi deadline.",
            },
          ]
        : []),
      ...(m.feedback.length >= 2
        ? [
            {
              id: `${m.id}-revision`,
              level: "medium",
              title: `${m.title}: sửa nhiều lần`,
              detail:
                "Rà soát tiêu chí nghiệm thu với Client trước lần nộp tiếp theo.",
            },
          ]
        : []),
    ])
    .concat(
      !state.acceptedAt &&
        state.scope.locked &&
        state.activity[0] &&
        Date.parse(today) - Date.parse(state.activity[0].at) > 7 * 86400000
        ? [
            {
              id: "stale",
              level: "medium",
              title: "Dự án chưa cập nhật trong 7 ngày",
              detail: "Gửi cập nhật tiến độ để hai bên nắm được tình hình.",
            },
          ]
        : [],
    );
}

export function transition(
  previous: Workspace,
  action: Action,
  role: Role,
  now = new Date().toISOString(),
): Workspace {
  const state: Workspace = structuredClone(previous);
  const assert = (condition: unknown, message: string) => {
    if (!condition) throw new Error(message);
  };
  assert(
    role !== "Admin",
    "Admin chỉ giám sát, không thay mặt hai bên phê duyệt.",
  );
  const client = () =>
    assert(role === "Client", "Thao tác này dành cho Client.");
  const freelancer = () =>
    assert(role === "Freelancer", "Thao tác này dành cho Freelancer.");
  const active = () =>
    assert(
      state.selectedId && state.scope.locked && !state.acceptedAt,
      "Cần chọn Freelancer và khóa Scope trước khi triển khai.",
    );
  let message = "";
  switch (action.type) {
    case "SAVE_JOB":
      client();
      assert(
        !state.published,
        "Tin đã đăng không sửa trực tiếp trong bản demo.",
      );
      state.job = action.job;
      message = "Đã lưu bản nháp dự án";
      break;
    case "PUBLISH":
      client();
      assert(
        qualityScore(state.job, now.slice(0, 10)).publishable,
        "Hãy hoàn thiện các tiêu chí bắt buộc trước khi đăng.",
      );
      state.published = true;
      message = "Đã đăng tin trong bản demo";
      break;
    case "SHORTLIST": {
      client();
      assert(
        state.published && !state.selectedId,
        "Dự án chưa mở hoặc đã chọn Freelancer.",
      );
      const candidate = state.candidates.find((c) => c.id === action.id);
      assert(
        candidate && candidate.status === "SUBMITTED",
        "Proposal không thể shortlist.",
      );
      candidate!.status = "SHORTLISTED";
      message = "Đã thêm Proposal vào shortlist";
      break;
    }
    case "SELECT": {
      client();
      assert(
        state.published && !state.selectedId,
        "Mỗi Job chỉ được chọn một Freelancer.",
      );
      const candidate = state.candidates.find((c) => c.id === action.id);
      assert(
        candidate && ["SUBMITTED", "SHORTLISTED"].includes(candidate.status),
        "Proposal không hợp lệ.",
      );
      state.selectedId = action.id;
      state.candidates.forEach((c) => {
        c.status = c.id === action.id ? "ACCEPTED" : "REJECTED";
      });
      state.scope.budget = candidate!.price;
      message = `Đã chọn ${candidate!.name}`;
      break;
    }
    case "SAVE_SCOPE":
      assert(
        state.selectedId && !state.scope.locked && !state.acceptedAt,
        "Không thể sửa Scope đã khóa.",
      );
      assert(
        action.scope.version === state.scope.version,
        "Phiên bản Scope đã thay đổi.",
      );
      assert(
        action.scope.deliverables.trim() &&
          action.scope.criteria.trim() &&
          Number.isFinite(action.scope.budget) &&
          action.scope.budget > 0 &&
          action.scope.deadline >= now.slice(0, 10),
        "Vui lòng điền đầy đủ Scope và deadline hợp lệ.",
      );
      state.scope = { ...action.scope, approvals: [], locked: false };
      message = "Đã cập nhật Scope; hai bên cần duyệt lại";
      break;
    case "APPROVE_SCOPE":
      assert(
        state.selectedId &&
          !state.scope.locked &&
          action.version === state.scope.version,
        "Scope không hợp lệ hoặc đã khóa.",
      );
      assert(
        state.scope.deliverables.trim() &&
          state.scope.criteria.trim() &&
          state.scope.budget > 0,
        "Scope chưa đầy đủ.",
      );
      assert(
        !state.scope.approvals.includes(role),
        "Bạn đã duyệt phiên bản này.",
      );
      state.scope.approvals.push(role);
      state.scope.locked = state.scope.approvals.length === 2;
      message = `${role} đã duyệt Scope v${state.scope.version}`;
      break;
    case "SUBMIT_MILESTONE": {
      freelancer();
      active();
      const m = state.milestones.find((m) => m.id === action.id);
      assert(
        m &&
          ["PLANNED", "IN_PROGRESS", "REVISION_REQUESTED"].includes(m.status),
        "Milestone không thể nộp vào lúc này.",
      );
      assert(
        action.note.trim().length >= 10,
        "Mô tả bằng chứng bàn giao tối thiểu 10 ký tự.",
      );
      m!.submissions.push({ note: action.note.trim(), at: now });
      m!.status = "SUBMITTED";
      message = `Đã nộp ${m!.title}`;
      break;
    }
    case "REVIEW_MILESTONE": {
      client();
      active();
      const m = state.milestones.find((m) => m.id === action.id);
      assert(m?.status === "SUBMITTED", "Chỉ duyệt milestone đã nộp.");
      assert(
        action.approve || action.note.trim().length >= 10,
        "Vui lòng mô tả yêu cầu sửa ít nhất 10 ký tự.",
      );
      m!.status = action.approve ? "APPROVED" : "REVISION_REQUESTED";
      if (!action.approve) m!.feedback.push(action.note.trim());
      message = `${action.approve ? "Đã duyệt" : "Yêu cầu sửa"} ${m!.title}`;
      break;
    }
    case "CREATE_CHANGE":
      active();
      assert(
        action.change.title.trim() &&
          action.change.reason.trim().length >= 10 &&
          action.change.deliverable.trim(),
        "Điền tên, lý do và sản phẩm bàn giao bổ sung.",
      );
      assert(
        Number.isFinite(action.change.budgetDelta) &&
          Number.isInteger(action.change.daysDelta) &&
          action.change.daysDelta >= 0 &&
          state.scope.budget + action.change.budgetDelta > 0,
        "Tác động ngân sách hoặc số ngày không hợp lệ.",
      );
      assert(
        !state.changes.some((c) => c.status === "UNDER_REVIEW"),
        "Hãy xử lý Change Request đang chờ trước.",
      );
      state.changes.unshift({
        ...action.change,
        id: `CR-${state.changes.length + 1}`,
        baseVersion: state.scope.version,
        approvals: [role],
        status: "UNDER_REVIEW",
      });
      message = "Đã gửi yêu cầu thay đổi";
      break;
    case "REVIEW_CHANGE": {
      active();
      const change = state.changes.find((c) => c.id === action.id);
      assert(
        change?.status === "UNDER_REVIEW" &&
          change.baseVersion === state.scope.version,
        "Yêu cầu không còn ở phiên bản hiện tại.",
      );
      assert(!change!.approvals.includes(role), "Bạn đã xác nhận yêu cầu này.");
      if (!action.approve) change!.status = "REJECTED";
      else {
        change!.approvals.push(role);
        if (change!.approvals.length === 2) {
          state.scopeHistory.push(structuredClone(state.scope));
          const deadline = new Date(`${state.scope.deadline}T12:00:00Z`);
          deadline.setUTCDate(deadline.getUTCDate() + change!.daysDelta);
          state.scope = {
            ...state.scope,
            version: state.scope.version + 1,
            budget: state.scope.budget + change!.budgetDelta,
            deadline: deadline.toISOString().slice(0, 10),
            deliverables: `${state.scope.deliverables}\n${change!.deliverable}`,
            approvals: ["Client", "Freelancer"],
            locked: true,
          };
          state.milestones.push({
            id: `ms-${change!.id}`,
            title: change!.title,
            description: change!.deliverable,
            due: state.scope.deadline,
            amount: change!.budgetDelta,
            required: true,
            status: "PLANNED",
            submissions: [],
            feedback: [],
          });
          change!.status = "APPLIED";
        }
      }
      message = action.approve
        ? "Đã áp dụng thay đổi và khóa Scope phiên bản mới"
        : "Đã từ chối yêu cầu thay đổi";
      break;
    }
    case "ACCEPT":
      client();
      assert(!state.acceptedAt, "Dự án đã nghiệm thu.");
      assert(
        acceptanceBlockers(state).length === 0,
        "Chưa đủ điều kiện nghiệm thu.",
      );
      state.acceptedAt = now;
      message = "Đã nghiệm thu cuối; dự án hoàn thành";
      break;
    case "REVIEW":
      client();
      assert(
        state.acceptedAt && !state.review,
        "Chỉ đánh giá một lần sau nghiệm thu cuối.",
      );
      assert(
        [
          action.review.overall,
          action.review.quality,
          action.review.timeliness,
          action.review.communication,
          action.review.professionalism,
        ].every((n) => Number.isInteger(n) && n >= 1 && n <= 5),
        "Mọi tiêu chí cần điểm từ 1 đến 5 sao.",
      );
      state.review = action.review;
      message = "Đã gửi đánh giá Freelancer";
      break;
  }
  state.activity.unshift({ text: message, at: now });
  return state;
}
