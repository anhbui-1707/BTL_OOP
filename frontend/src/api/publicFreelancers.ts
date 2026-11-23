import { apiRequest, pageQuery } from "./http";
import type { Page } from "./jobs";

export interface PublicWorkExperience {
  id: number;
  companyName: string;
  position: string;
  description?: string;
  achievements?: string;
  startDate?: string;
  endDate?: string | null;
  isCurrent?: boolean;
}
export interface PublicPortfolio {
  id: number;
  title: string;
  description?: string;
  role?: string;
  technologies?: string;
  projectUrl?: string;
  githubUrl?: string;
  startDate?: string;
  endDate?: string | null;
}
export interface PublicFreelancer {
  workExperiences?: PublicWorkExperience[];
  portfolioProjects?: PublicPortfolio[];
  id: number;
  displayName: string;
  avatarUrl: string | null;
  headline: string | null;
  bio: string | null;
  yearsExperience: number;
  averageRating: number | null;
  reviewCount: number;
  completedJobs: number;
  skills: string[];
}
export const publicFreelancersApi = {
  list(q = "", page = 0, size = 10): Promise<Page<PublicFreelancer>> {
    const params = new URLSearchParams(pageQuery(page, size));
    if (q.trim()) params.set("q", q.trim());
    return apiRequest<Page<PublicFreelancer>>(
      `/api/public/freelancers?${params}`,
      { auth: false },
    );
  },
  detail(id: number): Promise<PublicFreelancer> {
    return apiRequest<PublicFreelancer>(`/api/public/freelancers/${id}`, {
      auth: false,
    });
  },
};
