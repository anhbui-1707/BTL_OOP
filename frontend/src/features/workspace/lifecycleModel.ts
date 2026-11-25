import {
  type ReviewInput,
  type Acceptance,
} from "../../api/lifecycle";
import { milestonesApi, type Milestone } from "../../api/workspace";
import { party, type WorkspaceData } from "./productionModel";
import type { AuthUser } from "../../api/auth";
function text(value: string, max: number, required: boolean): string | null {
  if (value.length > max || (required && !value.trim()))
    throw new Error(
      `Nội dung ${required ? "bắt buộc, " : ""}tối đa ${max} ký tự.`,
    );
  return value.trim() || null;
}
export async function allMilestones(id: number): Promise<Milestone[]> {
  const rows: Milestone[] = [];
  for (let p = 0; ; p++) {
    const page = await milestonesApi.list(id, p, 100);
    rows.push(...page.content);
    if (p + 1 >= page.totalPages) return rows;
  }
}
export const acceptanceNote = (value: string) => text(value, 20000, false);
export async function acceptanceEvidence(id: number) {
  return { milestones: await allMilestones(id) };
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
