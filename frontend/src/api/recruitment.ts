import {
  ApiError,
  apiFetchBlob,
  apiRequestWithMeta,
  pageQuery,
  type ApiResponse,
  type RequestOptions,
} from "./http";
import type { JobStatus, Money, Page } from "./jobs";

export type ProposalStatus = "PENDING" | "ACCEPTED" | "REJECTED" | "WITHDRAWN";
export type AssignmentStatus =
  | "PENDING_SCOPE"
  | "ACTIVE"
  | "AWAITING_ACCEPTANCE"
  | "COMPLETED"
  | "CANCELLED";
export interface ProposalSummary {
  id: number;
  jobId: number;
  jobTitle: string;
  jobStatus: JobStatus;
  clientId: number;
  freelancerId: number;
  freelancerName: string;
  proposedBudget: Money;
  estimatedDays: number;
  status: ProposalStatus;
  submittedAt: string;
  version: string;
  cvId?: number | null;
  averageRating?: number | null;
  reviewCount?: number;
}
export interface Proposal extends ProposalSummary {
  freelancerHeadline: string | null;
  coverLetter: string;
  currencyCode: string;
  updatedAt: string;
  etag: string;
  cvFileName?: string | null;
  cvByteSize?: number | null;

  contactEmail?: string | null;
  contactPhone?: string | null;
  freelancerBio?: string | null;
  freelancerYearsExperience?: number | null;
  freelancerSkills?: string[];
}
export interface ProposalInput {
  coverLetter: string;
  proposedBudget: string;
  estimatedDays: number;
  cvId?: number | null;
}
export interface Assignment {
  id: number;
  jobId: number;
  jobTitle: string;
  proposalId: number;
  clientId: number;
  companyName: string | null;
  freelancerId: number;
  freelancerName: string;
  agreedBudget: Money;
  currencyCode: string;
  status: AssignmentStatus;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  version: string;
  etag?: string;
}
export interface Candidate {
  proposalId: number;
  proposalVersion: string;
  freelancerId: number;
  fullName: string;
  headline: string | null;
  yearsExperience: number;
  availability: "AVAILABLE" | "BUSY" | "UNAVAILABLE";
  proposedBudget: Money;
  currencyCode: string;
  estimatedDays: number;
  proposalStatus: ProposalStatus;
  selectable: boolean;
  ineligibilityReasons: string[];
  averageRating: number | null;
  reviewCount: number;
}
export interface PageFilter<S> {
  status?: S;
  page?: number;
  size?: number;
}
function query<S extends string>(filter: PageFilter<S> = {}) {
  const params = new URLSearchParams(pageQuery(filter.page, filter.size));
  if (filter.status) params.set("status", filter.status);
  return params.toString();
}

export function parseRecruitmentJson(
  raw: string,
  fields = new Set(["proposedBudget", "agreedBudget", "budgetMax"]),
): unknown {
  let previous: { end: number; value: string } | null = null;
  return JSON.parse(
    raw.replace(
      /"(?:\\.|[^"\\])*"|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/g,
      (token: string, offset: number) => {
        if (token.startsWith('"')) {
          previous = { end: offset + token.length, value: JSON.parse(token) };
          return token;
        }
        const last = previous;
        previous = null;
        return last &&
          fields.has(last.value) &&
          /^\s*:\s*$/.test(raw.slice(last.end, offset))
          ? JSON.stringify(token)
          : token;
      },
    ),
  );
}
async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<ApiResponse<T>> {
  return apiRequestWithMeta<T>(path, {
    ...options,
    parseJson: parseRecruitmentJson,
  });
}
function versioned<T extends { version: string }>(
  result: ApiResponse<T>,
): T & { etag: string } {
  const etag =
    result.etag || (result.data.version ? `"${result.data.version}"` : "");
  if (!etag)
    throw new Error("Phản hồi thiếu phiên bản; không thể cập nhật an toàn.");
  return { ...result.data, etag };
}
export const proposalsApi = {
  async submit(jobId: number, input: ProposalInput): Promise<Proposal> {
    const { coverLetter, proposedBudget, estimatedDays, cvId = null } = input;
    return versioned(
      await request<Proposal>(`/api/jobs/${jobId}/proposals`, {
        method: "POST",
        body: JSON.stringify({
          coverLetter,
          proposedBudget,
          estimatedDays,
          cvId,
        }),
      }),
    );
  },
  async cvBlob(id: number, signal?: AbortSignal): Promise<Blob> {
    const blob = await apiFetchBlob(`/api/proposals/${id}/cv/download`, {
      signal,
    });
    if (
      blob.type.toLowerCase().split(";")[0] !== "application/pdf" ||
      !blob.size ||
      blob.size > 2 * 1024 * 1024
    )
      throw new ApiError(
        0,
        "Phản hồi CV không phải PDF hợp lệ hoặc vượt quá 2 MB.",
      );
    return blob;
  },
  async forJob(
    jobId: number,
    filter: PageFilter<ProposalStatus> = {},
  ): Promise<Page<ProposalSummary>> {
    return (
      await request<Page<ProposalSummary>>(
        `/api/jobs/${jobId}/proposals?${query(filter)}`,
      )
    ).data;
  },
  async mine(
    filter: PageFilter<ProposalStatus> = {},
  ): Promise<Page<ProposalSummary>> {
    return (
      await request<Page<ProposalSummary>>(`/api/proposals/me?${query(filter)}`)
    ).data;
  },
  async detail(id: number): Promise<Proposal> {
    return versioned(await request<Proposal>(`/api/proposals/${id}`));
  },
  async reject(id: number, etag: string): Promise<Proposal> {
    return versioned(
      await request<Proposal>(`/api/proposals/${id}/status`, {
        method: "PATCH",
        headers: { "If-Match": etag },
        body: JSON.stringify({ status: "REJECTED" }),
      }),
    );
  },
  async withdraw(id: number, etag: string): Promise<Proposal> {
    return versioned(
      await request<Proposal>(`/api/proposals/${id}/withdraw`, {
        method: "POST",
        headers: { "If-Match": etag },
      }),
    );
  },
  async select(id: number, etag: string): Promise<Assignment> {
    return versioned(
      await request<Assignment>(`/api/proposals/${id}/select`, {
        method: "POST",
        headers: { "If-Match": etag },
      }),
    );
  },
};
export const matchingApi = {
  async candidates(
    jobId: number,
    filter: PageFilter<ProposalStatus> = {},
  ): Promise<Page<Candidate>> {
    return (
      await request<Page<Candidate>>(
        `/api/jobs/${jobId}/candidates?${query(filter)}`,
      )
    ).data;
  },
};
export const assignmentsApi = {
  async list(
    filter: PageFilter<AssignmentStatus> = {},
  ): Promise<Page<Assignment>> {
    return (
      await request<Page<Assignment>>(`/api/assignments?${query(filter)}`)
    ).data;
  },
  async detail(id: number): Promise<Assignment> {
    return versioned(await request<Assignment>(`/api/assignments/${id}`));
  },
};
