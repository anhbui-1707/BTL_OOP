import {
  ApiError,
  apiRequestWithMeta,
  pageQuery,
  type RequestOptions,
} from "./http";
import { parseRecruitmentJson, type AssignmentStatus } from "./recruitment";
import type { Money, Page } from "./jobs";

export type ChangeStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "APPLIED"
  | "CANCELLED";
export type Decision = "APPROVED" | "REJECTED";
export interface ChangeInput {
  title: string;
  reason: string;
  proposedDeliverables: string;
  budgetDelta: string;
  daysDelta: number;
}
export interface ChangeRequest extends Omit<ChangeInput, "budgetDelta"> {
  id: number;
  assignmentId: number;
  baseScopeVersionId: number;
  requestedBy: number;
  budgetDelta: Money;
  status: ChangeStatus;
  resultScopeVersionId: number | null;
  createdAt: string;
  resolvedAt: string | null;
  decisions: {
    userId: number;
    partyRole: "CLIENT" | "FREELANCER";
    decision: Decision;
    comment: string | null;
    decidedAt: string;
  }[];
  version: string;
  etag: string;
}
export interface RiskAlert {
  id: number;
  assignmentId: number;
  milestoneId: number | null;
  riskType: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  title: string;
  description: string;
  ruleCode: string;
  status: "OPEN" | "ACKNOWLEDGED" | "RESOLVED";
  detectedAt: string;
  resolvedAt: string | null;
}
export interface Acceptance {
  assignmentId: number;
  assignmentStatus: AssignmentStatus;
  accepted: boolean;
  assignmentVersion: string;
  etag: string;
  acceptance: {
    id: number;
    scopeVersionId: number;
    acceptedBy: number;
    acceptanceNote: string | null;
    acceptedAt: string;
  } | null;
}
export interface ReviewInput {
  overallRating: number;
  qualityRating: number;
  communicationRating: number;
  timelinessRating: number;
  comment: string | null;
}
export interface Review extends ReviewInput {
  id: number;
  assignmentId: number;
  reviewerId: number;
  freelancerId: number;
  createdAt: string;
}
async function request<T>(path: string, options: RequestOptions = {}) {
  return apiRequestWithMeta<T>(path, {
    ...options,
    parseJson: (raw) => parseRecruitmentJson(raw, new Set(["budgetDelta"])),
  });
}
async function change(
  path: string,
  options?: RequestOptions,
): Promise<ChangeRequest> {
  const r = await request<ChangeRequest>(path, options);
  const etag = r.etag || (r.data.version ? `"${r.data.version}"` : "");
  if (!etag)
    throw new ApiError(
      0,
      "Change Request thiếu phiên bản; cần tải lại để xác nhận kết quả.",
    );
  return { ...r.data, etag };
}
async function acceptance(
  id: number,
  options?: RequestOptions,
): Promise<Acceptance> {
  const r = await request<Acceptance>(
    `/api/assignments/${id}/final-acceptance`,
    options,
  );
  const etag =
    r.etag || (r.data.assignmentVersion ? `"${r.data.assignmentVersion}"` : "");
  if (!etag)
    throw new ApiError(
      0,
      "Final Acceptance thiếu phiên bản Assignment; cần tải lại để xác nhận kết quả.",
    );
  return { ...r.data, etag };
}
const match = (etag: string) => ({ "If-Match": etag });
export const changesApi = {
  async list(id: number, page = 0, size = 20): Promise<Page<ChangeRequest>> {
    return (
      await request<Page<ChangeRequest>>(
        `/api/assignments/${id}/change-requests?${pageQuery(page, size)}`,
      )
    ).data;
  },
  detail: (id: number) => change(`/api/change-requests/${id}`),
  create: (id: number, input: ChangeInput) =>
    change(`/api/assignments/${id}/change-requests`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  decide: (
    id: number,
    decision: Decision,
    comment: string | null,
    etag: string,
  ) =>
    change(`/api/change-requests/${id}/decisions`, {
      method: "POST",
      headers: match(etag),
      body: JSON.stringify({ decision, comment }),
    }),
  apply: (id: number, etag: string) =>
    change(`/api/change-requests/${id}/apply`, {
      method: "POST",
      headers: match(etag),
    }),
};
export const risksApi = {
  async list(id: number, page = 0, size = 20): Promise<Page<RiskAlert>> {
    return (
      await request<Page<RiskAlert>>(
        `/api/assignments/${id}/risk-alerts?${pageQuery(page, size)}`,
      )
    ).data;
  },
  async detail(id: number): Promise<RiskAlert> {
    return (await request<RiskAlert>(`/api/risk-alerts/${id}`)).data;
  },
  async evaluate(id: number): Promise<{ created: number; resolved: number }> {
    return (
      await request<{ created: number; resolved: number }>(
        `/api/assignments/${id}/risk-alerts/evaluate`,
        { method: "POST" },
      )
    ).data;
  },
  async acknowledge(id: number): Promise<RiskAlert> {
    return (
      await request<RiskAlert>(`/api/risk-alerts/${id}/acknowledge`, {
        method: "POST",
      })
    ).data;
  },
  async resolve(id: number): Promise<RiskAlert> {
    return (
      await request<RiskAlert>(`/api/risk-alerts/${id}/resolve`, {
        method: "POST",
      })
    ).data;
  },
};
export const acceptanceApi = {
  get: (id: number) => acceptance(id),
  accept: (id: number, acceptanceNote: string | null, etag: string) =>
    acceptance(id, {
      method: "POST",
      headers: match(etag),
      body: JSON.stringify({ acceptanceNote }),
    }),
};
export const reviewsApi = {
  async get(id: number): Promise<Review | null> {
    try {
      return (await request<Review>(`/api/assignments/${id}/review`)).data;
    } catch (e) {
      if (
        e instanceof ApiError &&
        e.status === 404 &&
        e.code === "REVIEW_NOT_FOUND"
      )
        return null;
      throw e;
    }
  },
  async create(id: number, input: ReviewInput): Promise<Review> {
    return (
      await request<Review>(`/api/assignments/${id}/review`, {
        method: "POST",
        body: JSON.stringify(input),
      })
    ).data;
  },
};
