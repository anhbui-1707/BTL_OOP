import {
  apiRequestWithMeta,
  pageQuery,
  type ApiResponse,
  type RequestOptions,
} from "./http";
export type Money = string | number;
export type JobStatus =
  | "DRAFT"
  | "OPEN"
  | "ASSIGNED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED"
  | "CLOSED";
export interface Page<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}
export interface JobSkill {
  skillId: number;
  name: string;
  isRequired: boolean;
}
export interface Quality {
  score: number;
  rulesVersion: string;
  breakdown: unknown;
  recommendations: unknown;
  evaluatedAt: string;
}
export interface JobSummary {
  id: number;
  clientId: number;
  companyName: string | null;
  title: string;
  budgetMin: Money;
  budgetMax: Money;
  currencyCode: string;
  deadline: string;
  status: JobStatus;
  createdAt: string;
  skills: JobSkill[];
  qualityScore: number | null;
}
export interface Job extends Omit<JobSummary, "qualityScore"> {
  description: string;
  deliverables: string;
  acceptanceCriteria: string;
  updatedAt: string;
  publishedAt: string | null;
  version: string;
  quality: Quality | null;
  etag: string;
}
export interface JobInput {
  title: string;
  description: string;
  deliverables: string;
  acceptanceCriteria: string;
  budgetMin: string;
  budgetMax: string;
  currencyCode: string;
  deadline: string;
  skills: Omit<JobSkill, "name">[];
}
export interface JobFilters {
  q?: string;
  skillIds?: number[];
  minBudget?: string;
  maxBudget?: string;
  currency?: string;
  status?: JobStatus;
  mine?: boolean;
  page?: number;
  size?: number;
}

export function parseJobJson(raw: string): unknown {
  let previous: { end: number; value: string } | null = null;
  const money = new Set(["budgetMin", "budgetMax"]);
  const exact = raw.replace(
    /"(?:\\.|[^"\\])*"|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/g,
    (token: string, offset: number) => {
      if (token.startsWith('"')) {
        previous = { end: offset + token.length, value: JSON.parse(token) };
        return token;
      }
      const last = previous;
      previous = null;
      return last &&
        money.has(last.value) &&
        /^\s*:\s*$/.test(raw.slice(last.end, offset))
        ? JSON.stringify(token)
        : token;
    },
  );
  return JSON.parse(exact);
}
async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<ApiResponse<T>> {
  return apiRequestWithMeta<T>(path, { ...options, parseJson: parseJobJson });
}
function detail(result: ApiResponse<Omit<Job, "etag">>): Job {
  const etag =
    result.etag || (result.data.version ? `"${result.data.version}"` : "");
  if (!etag)
    throw new Error(
      "Phản hồi Job thiếu phiên bản; không thể cập nhật an toàn.",
    );
  return { ...result.data, etag };
}
export function jobQuery(filters: JobFilters = {}): string {
  const params = new URLSearchParams(pageQuery(filters.page, filters.size));
  if (filters.q?.trim()) params.set("q", filters.q.trim());
  if (filters.skillIds?.length)
    params.set("skillIds", filters.skillIds.join(","));
  for (const key of ["minBudget", "maxBudget", "currency", "status"] as const)
    if (filters[key] !== undefined && filters[key] !== "")
      params.set(key, filters[key]!);
  if (filters.mine) params.set("mine", "true");
  return params.toString();
}
export const jobApi = {
  async publicSearch(filters: JobFilters = {}): Promise<Page<JobSummary>> {
    return (
      await request<Page<JobSummary>>(
        `/api/public/jobs?${jobQuery({ ...filters, status: undefined, mine: false })}`,
        { auth: false },
      )
    ).data;
  },
  async publicDetail(id: number): Promise<Job> {
    return detail(await request(`/api/public/jobs/${id}`, { auth: false }));
  },
  async search(filters: JobFilters = {}): Promise<Page<JobSummary>> {
    return (await request<Page<JobSummary>>(`/api/jobs?${jobQuery(filters)}`))
      .data;
  },
  async mine(page = 0, size = 20) {
    return this.search({ mine: true, page, size });
  },
  async detail(id: number): Promise<Job> {
    return detail(await request(`/api/jobs/${id}`));
  },
  async create(input: JobInput): Promise<Job> {
    return detail(
      await request("/api/jobs", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    );
  },
  async update(id: number, input: JobInput, etag: string): Promise<Job> {
    return detail(
      await request(`/api/jobs/${id}`, {
        method: "PUT",
        headers: { "If-Match": etag },
        body: JSON.stringify(input),
      }),
    );
  },
  async publish(id: number, etag: string): Promise<Job> {
    return detail(
      await request(`/api/jobs/${id}/publish`, {
        method: "POST",
        headers: { "If-Match": etag },
      }),
    );
  },
  async cancel(id: number, etag: string): Promise<void> {
    await request(`/api/jobs/${id}`, {
      method: "DELETE",
      headers: { "If-Match": etag },
    });
  },
};
