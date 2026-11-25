import {
  ApiError,
  apiRequestWithMeta,
  type RequestOptions,
} from "./http";
import { parseRecruitmentJson, type AssignmentStatus } from "./recruitment";

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
    parseJson: (raw) => parseRecruitmentJson(raw),
  });
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
