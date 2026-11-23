import {
  apiRequestWithMeta,
  pageQuery,
  type ApiResponse,
  type RequestOptions,
} from "./http";
import { parseRecruitmentJson } from "./recruitment";
import type { Money, Page } from "./jobs";
export type ScopeStatus =
  | "DRAFT"
  | "PENDING_APPROVAL"
  | "LOCKED"
  | "SUPERSEDED";
export type MilestoneStatus =
  | "PLANNED"
  | "IN_PROGRESS"
  | "SUBMITTED"
  | "REVISION_REQUIRED"
  | "APPROVED"
  | "CANCELLED";
export type SubmissionStatus = "SUBMITTED" | "REVISION_REQUIRED" | "APPROVED";
export interface Scope {
  id: number;
  assignmentId: number;
  versionNumber: number;
  deliverables: string;
  exclusions: string | null;
  acceptanceCriteria: string;
  budget: Money;
  deadline: string;
  status: ScopeStatus;
  createdBy: number;
  createdAt: string;
  lockedAt: string | null;
  approvals: {
    userId: number;
    partyRole: "CLIENT" | "FREELANCER";
    approvedAt: string;
  }[];
  assignmentVersion: string;
  etag: string;
}
export interface ScopeInput {
  deliverables?: string;
  exclusions?: string;
  acceptanceCriteria?: string;
  budget?: string;
  deadline?: string;
}
export interface MilestoneInput {
  title: string;
  description: string;
  acceptanceCriteria: string;
  dueDate: string;
  amount: string;
  isRequired: boolean;
  sortOrder: number;
}
export interface Milestone extends Omit<MilestoneInput, "amount"> {
  id: number;
  assignmentId: number;
  scopeVersionId: number;
  amount: Money;
  status: MilestoneStatus;
  approvedAt: string | null;
  createdAt: string;
  version: string;
  etag: string;
}
export interface SubmissionInput {
  submissionNote: string;
  evidenceUrl: string | null;
}
export interface Submission {
  id: number;
  milestoneId: number;
  submissionNumber: number;
  submittedBy: number;
  submissionNote: string;
  evidenceUrl: string | null;
  status: SubmissionStatus;
  reviewedBy: number | null;
  reviewNote: string | null;
  submittedAt: string;
  reviewedAt: string | null;
  milestoneVersion: string;
  etag?: string;
}
async function request<T>(path: string, options: RequestOptions = {}) {
  return apiRequestWithMeta<T>(path, {
    ...options,
    parseJson: (raw) =>
      parseRecruitmentJson(raw, new Set(["budget", "amount"])),
  });
}
function tagged<T>(
  response: ApiResponse<T>,
  version: string,
): T & { etag: string } {
  const etag = response.etag || (version ? `"${version}"` : "");
  if (!etag)
    throw new Error("Phản hồi thiếu phiên bản; không thể ghi an toàn.");
  return { ...response.data, etag };
}
async function scope(path: string, options?: RequestOptions): Promise<Scope> {
  const result = await request<Scope>(path, options);
  return tagged(result, result.data.assignmentVersion);
}
async function milestone(
  path: string,
  options?: RequestOptions,
): Promise<Milestone> {
  const result = await request<Milestone>(path, options);
  return tagged(result, result.data.version);
}
async function submission(
  path: string,
  options: RequestOptions,
): Promise<Submission> {
  const result = await request<Submission>(path, options);
  return tagged(result, result.data.milestoneVersion);
}
const match = (etag: string) => ({ "If-Match": etag });
export const scopesApi = {
  async list(id: number, page = 0, size = 20): Promise<Page<Scope>> {
    return (
      await request<Page<Scope>>(
        `/api/assignments/${id}/scopes?${pageQuery(page, size)}`,
      )
    ).data;
  },
  detail: (id: number) => scope(`/api/scopes/${id}`),
  create: (id: number, input: ScopeInput, etag: string) =>
    scope(`/api/assignments/${id}/scopes`, {
      method: "POST",
      headers: match(etag),
      body: JSON.stringify(input),
    }),
  submit: (id: number, etag: string) =>
    scope(`/api/scopes/${id}/submit`, { method: "POST", headers: match(etag) }),
  approve: (id: number, etag: string) =>
    scope(`/api/scopes/${id}/approve`, {
      method: "POST",
      headers: match(etag),
    }),
};
export const milestonesApi = {
  async list(id: number, page = 0, size = 20): Promise<Page<Milestone>> {
    return (
      await request<Page<Milestone>>(
        `/api/assignments/${id}/milestones?${pageQuery(page, size)}`,
      )
    ).data;
  },
  detail: (id: number) => milestone(`/api/milestones/${id}`),
  create: (id: number, input: MilestoneInput) =>
    milestone(`/api/assignments/${id}/milestones`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  update: (id: number, input: MilestoneInput, etag: string) =>
    milestone(`/api/milestones/${id}`, {
      method: "PUT",
      headers: match(etag),
      body: JSON.stringify(input),
    }),
  async cancel(id: number, etag: string): Promise<void> {
    await request(`/api/milestones/${id}`, {
      method: "DELETE",
      headers: match(etag),
    });
  },
  async history(id: number, page = 0, size = 20): Promise<Page<Submission>> {
    return (
      await request<Page<Submission>>(
        `/api/milestones/${id}/submissions?${pageQuery(page, size)}`,
      )
    ).data;
  },
  submit: (id: number, input: SubmissionInput, etag: string) =>
    submission(`/api/milestones/${id}/submissions`, {
      method: "POST",
      headers: match(etag),
      body: JSON.stringify(input),
    }),
  approve: (id: number, reviewNote: string | null, etag: string) =>
    submission(`/api/submissions/${id}/approve`, {
      method: "POST",
      headers: match(etag),
      body: JSON.stringify({ reviewNote }),
    }),
  revise: (id: number, reviewNote: string, etag: string) =>
    submission(`/api/submissions/${id}/request-revision`, {
      method: "POST",
      headers: match(etag),
      body: JSON.stringify({ reviewNote }),
    }),
};
