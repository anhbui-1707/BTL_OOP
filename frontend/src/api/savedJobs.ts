import { ApiError, apiRequest, type RequestOptions } from "./http";
import { parseJobJson, type JobSummary } from "./jobs";
import { refreshSession, sessionGeneration } from "../auth/session";

export interface SavedJobRecord {
  jobId: number;
  savedAt: string;
  job: JobSummary | null;
  publishedAt: string | null;
}

const base = "/api/freelancer/saved-jobs";

async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const generation = sessionGeneration();
  const scopedOptions = {
    ...options,
    parseJson: parseJobJson,
    retry401: false,
  };
  try {
    return await apiRequest<T>(path, scopedOptions);
  } catch (error) {
    if (
      !(error instanceof ApiError) ||
      error.status !== 401 ||
      generation !== sessionGeneration()
    )
      throw error;
    const refreshed = await refreshSession();
    if (!refreshed || generation !== sessionGeneration()) throw error;

    return apiRequest<T>(path, scopedOptions);
  }
}

export const savedJobsApi = {
  list: () => request<SavedJobRecord[]>(base),
  save: (id: number) =>
    request<SavedJobRecord>(`${base}/${id}`, { method: "PUT" }),
  remove: (id: number) => request<void>(`${base}/${id}`, { method: "DELETE" }),
};
