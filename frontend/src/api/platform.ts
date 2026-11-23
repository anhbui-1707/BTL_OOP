import { API_BASE_URL, apiFetchBlob, apiRequest, pageQuery } from "./http";
import type { Job, Page } from "./jobs";

export function resolveAvatarUrl(
  avatarUrl?: string | null,
): string | undefined {
  if (!avatarUrl || !avatarUrl.trim()) return undefined;
  const trimmed = avatarUrl.trim();
  if (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("data:") ||
    trimmed.startsWith("blob:")
  ) {
    return trimmed;
  }
  if (trimmed.startsWith("/")) {
    return `${API_BASE_URL}${trimmed}`;
  }
  return `${API_BASE_URL}/${trimmed}`;
}

export interface UserDto {
  id: number;
  fullName: string;
  title?: string;
  email: string;
  phone?: string;
  phoneNumber?: string;
  avatarUrl?: string;
  bio?: string;
  role: "FREELANCER" | "CLIENT" | "ADMIN";
  status: "ACTIVE" | "BLOCKED" | "SUSPENDED" | "INACTIVE";
  createdAt?: string;
}

export interface SkillDto {
  id: number;
  name: string;
  proficiency?: number;
  yearsExperience?: number | null;
}

export interface ProfileSkillInput {
  name: string;
  proficiency: number;
  yearsExperience: number;
}

export interface WorkExperienceDto {
  id: number;
  companyName: string;
  position: string;
  description?: string;
  achievements: string;
  startDate?: string;
  endDate?: string | null;
  isCurrent?: boolean;
  createdAt?: string;
  updatedAt: string;
  version: number;
}

export interface WorkExperienceInput {
  companyName: string;
  position: string;
  description: string;
  achievements: string;
  startDate: string;
  endDate: string | null;
  isCurrent: boolean;
  version?: number;
}

export interface PortfolioDto {
  id: number;
  title: string;
  description?: string;
  role: string;
  startDate: string | null;
  endDate: string | null;
  projectUrl?: string;
  githubUrl?: string;
  technologies?: string;
  imageUrl?: string;
  createdAt?: string;
  updatedAt: string;
  version: number;
}

export interface PortfolioInput {
  title: string;
  description: string;
  role: string;
  technologies: string;
  projectUrl: string;
  githubUrl: string;
  startDate: string | null;
  endDate: string | null;
  version?: number;
}

export interface CvDto {
  id: number;
  fileName: string;
  fileUrl: string;
  uploadedAt?: string;
  byteSize: number;
}

export interface ReviewDto {
  id: number;
  assignmentId: number;
  reviewerId: number;
  freelancerId: number;
  rating: number;
  comment: string;
  createdAt: string;
  jobTitle?: string;
  companyName?: string | null;
}

export interface FreelancerProfileDto {
  id: number;
  fullName: string;
  title?: string;
  email: string;
  phoneNumber?: string;
  avatarUrl?: string;
  bio?: string;
  skills?: SkillDto[];
  workExperiences?: WorkExperienceDto[];
  cvs?: CvDto[];
  portfolioProjects?: PortfolioDto[];
  reviews?: ReviewDto[];
  averageRating?: number;
  totalReviews?: number;
  completedJobs?: number;
}

export interface AssignmentDto {
  id: number;
  jobId: number;
  jobTitle: string;
  jobDescription?: string;
  freelancerId: number;
  freelancerName?: string;
  clientName?: string;
  proposalId: number;
  agreedPrice: number;
  startDate: string;
  completedAt: string | null;
  status: "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
}

export type SelfProfileDto = Pick<
  UserDto,
  "id" | "fullName" | "email" | "phoneNumber" | "title" | "bio" | "avatarUrl"
> & {
  status: "ACTIVE" | "LOCKED" | "DISABLED";
  roles: ("CLIENT" | "FREELANCER" | "ADMIN")[];
};

export const userApi = {
  me(): Promise<SelfProfileDto> {
    return apiRequest<SelfProfileDto>("/api/users/me");
  },
  updateMe(input: {
    fullName: string;
    title?: string;
    phoneNumber?: string;
    avatarUrl?: string;
    bio?: string;
    newPassword?: string;
    confirmPassword?: string;
  }): Promise<SelfProfileDto> {
    return apiRequest<SelfProfileDto>("/api/users/me", {
      method: "PUT",
      body: JSON.stringify(input),
    });
  },
  uploadAvatar(file: File): Promise<UserDto> {
    const formData = new FormData();
    formData.append("file", file);
    return apiRequest<UserDto>("/api/users/me/avatar", {
      method: "POST",
      body: formData,
    });
  },
};

export const freelancerApi = {
  list(keyword?: string, skill?: string): Promise<FreelancerProfileDto[]> {
    const params = new URLSearchParams();
    if (keyword?.trim()) params.set("keyword", keyword.trim());
    if (skill?.trim()) params.set("skill", skill.trim());
    const qs = params.toString();
    return apiRequest<FreelancerProfileDto[]>(
      `/api/freelancers${qs ? `?${qs}` : ""}`,
    );
  },
  detail(id: number): Promise<FreelancerProfileDto> {
    return apiRequest<FreelancerProfileDto>(`/api/freelancers/${id}`);
  },
  me(): Promise<FreelancerProfileDto> {
    return apiRequest<FreelancerProfileDto>("/api/freelancers/me");
  },
  updateMe(input: {
    fullName: string;
    title?: string;
    phoneNumber?: string;
    avatarUrl?: string;
    bio?: string;
  }): Promise<FreelancerProfileDto> {
    return apiRequest<FreelancerProfileDto>("/api/freelancers/me", {
      method: "PUT",
      body: JSON.stringify(input),
    });
  },
};

export const skillApi = {
  listAll(): Promise<SkillDto[]> {
    return apiRequest<SkillDto[]>("/api/skills");
  },
  mine(): Promise<SkillDto[]> {
    return apiRequest<SkillDto[]>("/api/skills/me");
  },
  addMineByName(input: ProfileSkillInput): Promise<SkillDto> {
    return apiRequest<SkillDto>("/api/skills/me", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  updateMine(skillId: number, input: ProfileSkillInput): Promise<SkillDto> {
    return apiRequest<SkillDto>(`/api/skills/me/${skillId}`, {
      method: "PUT",
      body: JSON.stringify(input),
    });
  },
  removeMine(skillId: number): Promise<void> {
    return apiRequest<void>(`/api/skills/me/${skillId}`, { method: "DELETE" });
  },
};

export const workExperienceApi = {
  mine(): Promise<WorkExperienceDto[]> {
    return apiRequest<WorkExperienceDto[]>("/api/work-experiences/me");
  },
  create(input: WorkExperienceInput): Promise<WorkExperienceDto> {
    return apiRequest<WorkExperienceDto>("/api/work-experiences/me", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  update(id: number, input: WorkExperienceInput): Promise<WorkExperienceDto> {
    return apiRequest<WorkExperienceDto>(`/api/work-experiences/me/${id}`, {
      method: "PUT",
      body: JSON.stringify(input),
    });
  },
  remove(id: number, version: number): Promise<void> {
    return apiRequest<void>(
      `/api/work-experiences/me/${id}?version=${version}`,
      { method: "DELETE" },
    );
  },
};

export const portfolioApi = {
  mine(): Promise<PortfolioDto[]> {
    return apiRequest<PortfolioDto[]>("/api/portfolios/me");
  },
  create(input: PortfolioInput): Promise<PortfolioDto> {
    return apiRequest<PortfolioDto>("/api/portfolios/me", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  update(id: number, input: PortfolioInput): Promise<PortfolioDto> {
    return apiRequest<PortfolioDto>(`/api/portfolios/me/${id}`, {
      method: "PUT",
      body: JSON.stringify(input),
    });
  },
  remove(id: number, version: number): Promise<void> {
    return apiRequest<void>(`/api/portfolios/me/${id}?version=${version}`, {
      method: "DELETE",
    });
  },
};

export const cvApi = {
  mine(): Promise<CvDto[]> {
    return apiRequest<CvDto[]>("/api/cvs/me");
  },
  upload(file: File): Promise<CvDto> {
    const formData = new FormData();
    formData.append("file", file);
    return apiRequest<CvDto>("/api/cvs/me/upload", {
      method: "POST",
      body: formData,
    });
  },
  remove(cvId: number): Promise<void> {
    return apiRequest<void>(`/api/cvs/me/${cvId}`, { method: "DELETE" });
  },
  downloadBlob(cvId: number): Promise<Blob> {
    return apiFetchBlob(`/api/cvs/${cvId}/download`);
  },
};

export const assignmentApi = {
  mineFreelancer(): Promise<AssignmentDto[]> {
    return apiRequest<AssignmentDto[]>("/api/assignments/my");
  },
  mineClient(): Promise<AssignmentDto[]> {
    return apiRequest<AssignmentDto[]>("/api/assignments/client/my");
  },
  complete(id: number): Promise<AssignmentDto> {
    return apiRequest<AssignmentDto>(`/api/assignments/${id}/complete`, {
      method: "PATCH",
    });
  },
  cancel(id: number): Promise<AssignmentDto> {
    return apiRequest<AssignmentDto>(`/api/assignments/${id}/cancel`, {
      method: "PATCH",
    });
  },
};

export const reviewApi = {
  create(
    assignmentId: number,
    input: { rating: number; comment: string },
  ): Promise<ReviewDto> {
    return apiRequest<ReviewDto>(`/api/assignments/${assignmentId}/reviews`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  forAssignment(assignmentId: number): Promise<ReviewDto> {
    return apiRequest<ReviewDto>(`/api/assignments/${assignmentId}/reviews`);
  },
  forFreelancer(freelancerId: number): Promise<ReviewDto[]> {
    return apiRequest<ReviewDto[]>(`/api/freelancers/${freelancerId}/reviews`);
  },
};

export const adminApi = {
  users(role?: string, status?: string, keyword?: string): Promise<UserDto[]> {
    const params = new URLSearchParams();
    if (role) params.set("role", role);
    if (status) params.set("status", status);
    if (keyword) params.set("keyword", keyword);
    const qs = params.toString();
    return apiRequest<UserDto[]>(`/api/admin/users${qs ? `?${qs}` : ""}`);
  },
  lockUser(id: number): Promise<UserDto> {
    return apiRequest<UserDto>(`/api/admin/users/${id}/lock`, {
      method: "PATCH",
    });
  },
  unlockUser(id: number): Promise<UserDto> {
    return apiRequest<UserDto>(`/api/admin/users/${id}/unlock`, {
      method: "PATCH",
    });
  },
  jobs(page = 0, size = 20): Promise<Page<Job>> {
    return apiRequest<Page<Job>>(`/api/admin/jobs?${pageQuery(page, size)}`);
  },
  closeJob(id: number): Promise<Job> {
    return apiRequest<Job>(`/api/admin/jobs/${id}/close`, { method: "PATCH" });
  },
  assignments(): Promise<AssignmentDto[]> {
    return apiRequest<AssignmentDto[]>("/api/admin/assignments");
  },
  stats(): Promise<Record<string, number>> {
    return apiRequest<Record<string, number>>("/api/admin/stats");
  },
};
