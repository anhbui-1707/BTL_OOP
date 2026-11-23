import type { AuthUser } from "../../api/auth";
import { assignmentsApi, type Assignment } from "../../api/recruitment";
import { jobApi, type Job } from "../../api/jobs";
import {
  scopesApi,
  type Scope,
  type ScopeInput,
  type Milestone,
  type MilestoneInput,
  type Submission,
  type SubmissionInput,
} from "../../api/workspace";
export function workspaceId(hash: string): number | null {
  const raw = new URLSearchParams(hash.split("?")[1] || "").get("assignmentId");
  return raw && /^[1-9]\d*$/.test(raw) && Number.isSafeInteger(Number(raw))
    ? Number(raw)
    : null;
}
export function openWorkspace(id: number, page = "Không gian dự án") {
  if (!Number.isSafeInteger(id) || id < 1) return;
  window.history.pushState(
    null,
    "",
    `#/dashboard/${encodeURIComponent(page)}?assignmentId=${id}`,
  );
  window.dispatchEvent(new PopStateEvent("popstate"));
}
export function party(
  user: AuthUser | null,
  a: Assignment,
): "CLIENT" | "FREELANCER" | null {
  if (user?.roles.includes("CLIENT") && user.id === a.clientId) return "CLIENT";
  if (user?.roles.includes("FREELANCER") && user.id === a.freelancerId)
    return "FREELANCER";
  return null;
}
export interface WorkspaceData {
  assignment: Assignment;
  job: Job;
  scopes: Scope[];
}
export async function loadWorkspace(
  id: number,
  user: AuthUser,
  allowAdminRead = false,
): Promise<WorkspaceData> {
  const assignment = await assignmentsApi.detail(id);
  const adminRead =
    allowAdminRead && user.roles.includes("ADMIN") && !party(user, assignment);
  if (!party(user, assignment) && !adminRead)
    throw new Error(
      "Chỉ CLIENT/FREELANCER thuộc Assignment được truy cập Scope và Milestone.",
    );
  const job = await jobApi.detail(assignment.jobId);

  if (adminRead) return { assignment, job, scopes: [] };
  const scopes: Scope[] = [];
  for (let page = 0; ; page++) {
    const result = await scopesApi.list(id, page, 100);
    scopes.push(...result.content);
    if (page + 1 >= result.totalPages) break;
  }
  return { assignment, job, scopes };
}
export function scopeRights(
  user: AuthUser,
  data: WorkspaceData,
  scope?: Scope,
) {
  const role = party(user, data.assignment);
  const newest = Math.max(0, ...data.scopes.map((s) => s.versionNumber));
  const latest = data.scopes.reduce<Scope | null>(
    (prev, item) =>
      !prev || item.versionNumber > prev.versionNumber ? item : prev,
    null,
  );

  const create =
    !!role &&
    data.assignment.status === "PENDING_SCOPE" &&
    !data.scopes.some((s) => s.status === "LOCKED") &&
    (!latest ||
      latest.status === "DRAFT" ||
      (latest.status === "PENDING_APPROVAL" &&
        !latest.approvals.some((a) => a.partyRole === role)));
  const current = create && !!scope && scope.versionNumber === newest;
  return {
    create,
    submit: current && role === "CLIENT" && scope?.status === "DRAFT",
    approve:
      current &&
      scope?.status === "PENDING_APPROVAL" &&
      !scope.approvals.some((a) => a.partyRole === role),
  };
}
export function milestoneRights(
  user: AuthUser,
  data: WorkspaceData,
  m?: Milestone,
  latest?: Submission,
  hasHistory = false,
) {
  const role = party(user, data.assignment);
  const locked = data.scopes.find((s) => s.status === "LOCKED");
  const active =
    !!role &&
    !!locked &&
    data.assignment.status === "ACTIVE" &&
    data.job.status === "IN_PROGRESS";
  const current = active && !!m && m.scopeVersionId === locked?.id;
  return {
    create: active && role === "CLIENT",
    edit:
      current && role === "CLIENT" && m?.status === "PLANNED" && !hasHistory,
    submit:
      current &&
      role === "FREELANCER" &&
      !!m &&
      ["PLANNED", "IN_PROGRESS", "REVISION_REQUIRED"].includes(m.status) &&
      (latest
        ? m.status === "REVISION_REQUIRED" &&
          latest.status === "REVISION_REQUIRED"
        : m.status !== "REVISION_REQUIRED" && !hasHistory),
    review:
      current &&
      role === "CLIENT" &&
      m?.status === "SUBMITTED" &&
      latest?.status === "SUBMITTED" &&
      latest.submittedBy === data.assignment.freelancerId,
  };
}
export function decimal(value: string): string {
  const v = value.trim();
  if (!/^(0|[1-9]\d{0,16})(\.\d{1,2})?$/.test(v))
    throw new Error(
      "Số tiền không âm, tối đa 17 chữ số nguyên và 2 chữ số thập phân.",
    );
  return v;
}
export function date(value: string): string {
  const d = new Date(value + "T00:00:00Z");
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    value < "0001-01-01" ||
    value > "9999-12-31" ||
    !Number.isFinite(d.getTime()) ||
    d.toISOString().slice(0, 10) !== value
  )
    throw new Error("Ngày không hợp lệ theo SQL Server.");
  return value;
}
function text(value: string, name: string, max = 20000) {
  const v = value.trim();
  if (!v || v.length > max) throw new Error(`${name} cần 1–${max} ký tự.`);
  return v;
}

const PLAN_PREFIX = "LINKIT_MILESTONE_PLAN_V1:";
export interface PlannedMilestone {
  title: string;
  dueDate: string;
}
export function readMilestonePlan(
  exclusions: string | null | undefined,
): PlannedMilestone[] {
  if (!exclusions?.startsWith(PLAN_PREFIX)) return [];
  try {
    const value: unknown = JSON.parse(exclusions.slice(PLAN_PREFIX.length));
    if (!value || typeof value !== "object" || !("milestones" in value))
      return [];
    const rows = (value as { milestones?: unknown }).milestones;
    if (!Array.isArray(rows)) return [];
    return rows
      .filter(
        (row): row is PlannedMilestone =>
          !!row &&
          typeof row === "object" &&
          typeof row.title === "string" &&
          typeof row.dueDate === "string",
      )
      .map((row) => ({ title: row.title, dueDate: row.dueDate }));
  } catch {
    return [];
  }
}
function legacyExclusions(raw: string | null | undefined): string {
  if (!raw) return "";
  if (!raw.startsWith(PLAN_PREFIX)) return raw;
  try {
    const parsed: unknown = JSON.parse(raw.slice(PLAN_PREFIX.length));
    if (
      parsed &&
      typeof parsed === "object" &&
      "legacy" in parsed &&
      typeof (parsed as { legacy?: unknown }).legacy === "string"
    ) {
      return (parsed as { legacy: string }).legacy;
    }
  } catch {}
  return "";
}
function serializeMilestonePlan(
  rows: PlannedMilestone[],
  legacy: string,
): string {
  return PLAN_PREFIX + JSON.stringify({ milestones: rows, legacy });
}
export interface ScopeForm {
  deliverables: string;
  exclusions: string;
  milestonePlan: PlannedMilestone[];
  acceptanceCriteria: string;
  budget: string;
  deadline: string;
}
export function scopeForm(data: WorkspaceData, source?: Scope): ScopeForm {
  return {
    deliverables: source?.deliverables ?? data.job.deliverables,
    exclusions: legacyExclusions(source?.exclusions),
    milestonePlan: readMilestonePlan(source?.exclusions),

    acceptanceCriteria: source?.acceptanceCriteria ?? "",
    budget: String(source?.budget ?? data.assignment.agreedBudget),
    deadline: source?.deadline ?? data.job.deadline,
  };
}
export function scopeInput(form: ScopeForm): ScopeInput {
  if (form.exclusions.length > 20000)
    throw new Error("Dữ liệu phạm vi cũ vượt giới hạn 20.000 ký tự.");
  const rows = form.milestonePlan
    .map((row) => ({
      title: row.title.trim(),
      dueDate: row.dueDate,
    }))
    .filter((row) => row.title || row.dueDate);
  if (rows.length > 30) throw new Error("Tối đa 30 mốc bàn giao.");
  const seen = new Set<string>();
  for (const row of rows) {
    if (!row.title || row.title.length > 200 || !row.dueDate)
      throw new Error("Mỗi mốc cần tên và hạn bàn giao.");
    date(row.dueDate);
    if (row.dueDate > form.deadline)
      throw new Error("Hạn của mốc không được vượt hạn hoàn thành dự án.");
    if (seen.has(row.title.toLocaleLowerCase("vi-VN")))
      throw new Error("Không được tạo hai mốc trùng tên.");
    seen.add(row.title.toLocaleLowerCase("vi-VN"));
  }
  const schedule = serializeMilestonePlan(rows, form.exclusions);
  if (schedule.length > 20000)
    throw new Error("Kế hoạch các mốc quá dài, tối đa 20.000 ký tự.");
  return {
    deliverables: text(form.deliverables, "Sản phẩm bàn giao"),
    exclusions: schedule,
    acceptanceCriteria: text(form.acceptanceCriteria, "Tiêu chí nghiệm thu"),
    budget: decimal(form.budget),
    deadline: date(form.deadline),
  };
}
export interface MilestoneForm {
  title: string;
  description: string;
  acceptanceCriteria: string;
  dueDate: string;
  amount: string;
  isRequired: string;
  sortOrder: string;
}
export const blankMilestone = (): MilestoneForm => ({
  title: "",
  description: "",
  acceptanceCriteria: "",
  dueDate: "",
  amount: "",
  isRequired: "",
  sortOrder: "",
});
export function milestoneForm(m: Milestone): MilestoneForm {
  return {
    title: m.title,
    description: m.description,
    acceptanceCriteria: m.acceptanceCriteria,
    dueDate: m.dueDate,
    amount: String(m.amount),
    isRequired: String(m.isRequired),
    sortOrder: String(m.sortOrder),
  };
}
export function milestoneInput(
  f: MilestoneForm,
  deadline: string,
): MilestoneInput {
  if (!["true", "false"].includes(f.isRequired))
    throw new Error("Chọn Milestone bắt buộc hoặc tùy chọn.");
  if (
    !/^\d+$/.test(f.sortOrder) ||
    Number(f.sortOrder) < 1 ||
    Number(f.sortOrder) > 2147483647
  )
    throw new Error("Thứ tự phải là số nguyên dương trong SQL INT.");
  const dueDate = date(f.dueDate);
  if (dueDate > deadline)
    throw new Error("Hạn Milestone không được vượt deadline Scope.");
  return {
    title: text(f.title, "Tiêu đề", 200),
    description: text(f.description, "Mô tả"),
    acceptanceCriteria: text(f.acceptanceCriteria, "Tiêu chí nghiệm thu"),
    dueDate,
    amount: decimal(f.amount),
    isRequired: f.isRequired === "true",
    sortOrder: Number(f.sortOrder),
  };
}
export function submissionInput(note: string, url: string): SubmissionInput {
  const evidenceUrl = url.trim() || null;
  if (evidenceUrl) {
    let parsed;
    try {
      parsed = new URL(evidenceUrl);
    } catch {
      throw new Error("URL tài liệu không hợp lệ.");
    }
    if (
      evidenceUrl.length > 1000 ||
      !["http:", "https:"].includes(parsed.protocol) ||
      !parsed.hostname ||
      parsed.username ||
      parsed.password
    )
      throw new Error(
        "URL cần HTTP(S), không chứa tài khoản/mật khẩu, tối đa 1.000 ký tự.",
      );
  }
  return { submissionNote: text(note, "Ghi chú bàn giao"), evidenceUrl };
}
export function reviewNote(value: string, required: boolean): string | null {
  if (required) return text(value, "Lý do chỉnh sửa");
  if (value.trim().length > 20000)
    throw new Error("Nhận xét tối đa 20.000 ký tự.");
  return value.trim() || null;
}
