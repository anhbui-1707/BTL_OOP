import {
  changesApi,
  type ChangeInput,
  type ChangeRequest,
  type RiskAlert,
  type ReviewInput,
  type Acceptance,
} from "../../api/lifecycle";
import { milestonesApi, type Milestone } from "../../api/workspace";
import { party, type WorkspaceData } from "./productionModel";
import type { AuthUser } from "../../api/auth";
export interface ChangeForm {
  title: string;
  reason: string;
  proposedDeliverables: string;
  budgetDelta: string;
  daysDelta: string;
}
export const blankChange = (): ChangeForm => ({
  title: "",
  reason: "",
  proposedDeliverables: "",
  budgetDelta: "",
  daysDelta: "",
});
function text(value: string, max: number, required: boolean): string | null {
  if (value.length > max || (required && !value.trim()))
    throw new Error(
      `Nội dung ${required ? "bắt buộc, " : ""}tối đa ${max} ký tự.`,
    );
  return value.trim() || null;
}
export function changeInput(f: ChangeForm): ChangeInput {
  if (!/^-?(0|[1-9]\d{0,16})(\.\d{1,2})?$/.test(f.budgetDelta.trim()))
    throw new Error(
      "Budget delta cần tối đa 17 chữ số nguyên, 2 chữ số thập phân; có thể âm.",
    );
  if (
    !/^-?\d+$/.test(f.daysDelta.trim()) ||
    Number(f.daysDelta) < -2147483648 ||
    Number(f.daysDelta) > 2147483647
  )
    throw new Error("Days delta phải là số nguyên trong giới hạn SQL INT.");
  return {
    title: text(f.title, 200, true)!,
    reason: text(f.reason, 20000, true)!,
    proposedDeliverables: text(f.proposedDeliverables, 20000, true)!,
    budgetDelta: f.budgetDelta.trim(),
    daysDelta: Number(f.daysDelta),
  };
}
export const decisionComment = (value: string) => text(value, 20000, false);
export const acceptanceNote = (value: string) => text(value, 20000, false);
export function changeRights(
  user: AuthUser,
  data: WorkspaceData,
  c?: ChangeRequest,
) {
  const role = party(user, data.assignment);
  const scope = data.scopes.find((s) => s.status === "LOCKED");
  const active =
    !!role &&
    data.assignment.status === "ACTIVE" &&
    data.job.status === "IN_PROGRESS" &&
    !!scope;
  return {
    create: active,
    decide:
      active &&
      c?.status === "PENDING" &&
      !c.decisions.some((d) => d.partyRole === role),
    apply:
      active &&
      role === "CLIENT" &&
      c?.status === "APPROVED" &&
      c.resultScopeVersionId === null &&
      c.baseScopeVersionId === scope?.id &&
      ["CLIENT", "FREELANCER"].every((r) =>
        c.decisions.some(
          (d) =>
            d.partyRole === r &&
            d.decision === "APPROVED" &&
            d.userId ===
              (r === "CLIENT"
                ? data.assignment.clientId
                : data.assignment.freelancerId),
        ),
      ),
  };
}
export function riskRights(
  user: AuthUser,
  data: WorkspaceData,
  risk?: RiskAlert,
) {
  const owner =
    user.roles.includes("CLIENT") && user.id === data.assignment.clientId;
  const manager = owner || user.roles.includes("ADMIN");
  return {
    read: manager || party(user, data.assignment) === "FREELANCER",
    evaluate: manager,
    acknowledge: owner && risk?.status === "OPEN",
    resolve: manager && !!risk && risk.status !== "RESOLVED",
  };
}
export async function allMilestones(id: number): Promise<Milestone[]> {
  const rows: Milestone[] = [];
  for (let p = 0; ; p++) {
    const page = await milestonesApi.list(id, p, 100);
    rows.push(...page.content);
    if (p + 1 >= page.totalPages) return rows;
  }
}
export async function acceptanceEvidence(id: number) {
  const [milestones, changes] = await Promise.all([
    allMilestones(id),
    (async () => {
      const rows: ChangeRequest[] = [];
      for (let p = 0; ; p++) {
        const page = await changesApi.list(id, p, 100);
        rows.push(...page.content);
        if (p + 1 >= page.totalPages) return rows;
      }
    })(),
  ]);
  return { milestones, changes };
}
export function acceptanceConditions(
  data: WorkspaceData,
  evidence: Awaited<ReturnType<typeof acceptanceEvidence>>,
) {
  const scope = data.scopes.find((s) => s.status === "LOCKED");
  const required = evidence.milestones.filter(
    (m) =>
      m.scopeVersionId === scope?.id &&
      m.isRequired &&
      m.status !== "CANCELLED",
  );
  return {
    state:
      ["ACTIVE", "AWAITING_ACCEPTANCE"].includes(data.assignment.status) &&
      data.job.status === "IN_PROGRESS",
    scope: !!scope,
    required:
      required.length > 0 && required.every((m) => m.status === "APPROVED"),
    changes: !evidence.changes.some(
      (c) =>
        c.baseScopeVersionId === scope?.id &&
        ["PENDING", "APPROVED"].includes(c.status),
    ),
  };
}
export function canAccept(
  user: AuthUser,
  data: WorkspaceData,
  status: Acceptance,
  evidence: Awaited<ReturnType<typeof acceptanceEvidence>>,
) {
  return (
    party(user, data.assignment) === "CLIENT" &&
    !status.accepted &&
    Object.values(acceptanceConditions(data, evidence)).every(Boolean)
  );
}
export const ratingFields = [
  "overallRating",
  "qualityRating",
  "communicationRating",
  "timelinessRating",
] as const;
export type ReviewForm = Record<(typeof ratingFields)[number], string> & {
  comment: string;
};
export const blankReview = (): ReviewForm => ({
  overallRating: "",
  qualityRating: "",
  communicationRating: "",
  timelinessRating: "",
  comment: "",
});
export function reviewInput(f: ReviewForm): ReviewInput {
  if (ratingFields.some((key) => !/^[1-5]$/.test(f[key])))
    throw new Error("Cả 4 điểm đánh giá phải là số nguyên từ 1 đến 5.");
  return {
    overallRating: Number(f.overallRating),
    qualityRating: Number(f.qualityRating),
    communicationRating: Number(f.communicationRating),
    timelinessRating: Number(f.timelinessRating),
    comment: text(f.comment, 2000, false),
  };
}
export function canReview(
  user: AuthUser,
  data: WorkspaceData,
  exists: boolean,
  accepted: boolean,
) {
  return (
    !exists &&
    accepted &&
    party(user, data.assignment) === "CLIENT" &&
    data.assignment.status === "COMPLETED" &&
    data.job.status === "COMPLETED"
  );
}
