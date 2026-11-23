import { apiRequest, apiRequestWithMeta, pageQuery } from "./http";
import type { Page, Money } from "./jobs";
import { parseRecruitmentJson } from "./recruitment";

export type ManagedRole = "CLIENT" | "FREELANCER" | "ADMIN";
export type UserStatus = "ACTIVE" | "LOCKED" | "DISABLED";
export type ProposalStatus = "PENDING" | "ACCEPTED" | "REJECTED" | "WITHDRAWN";
export interface AdminUser {
  id: number;
  fullName: string;
  email: string;
  avatarUrl: string | null;
  roles: ManagedRole[];
  status: UserStatus;
  createdAt: string;
  version: string;
}
export interface AdminProposal {
  id: number;
  jobId: number;
  jobTitle: string;
  clientId: number;
  clientName: string;
  freelancerId: number;
  freelancerName: string;
  proposedBudget: Money;
  currencyCode: string;
  estimatedDays: number;
  status: ProposalStatus;
  submittedAt: string;
}
export interface AdminProposalDetail {
  summary: AdminProposal;
  coverLetter: string;
}
export interface AdminActivity {
  id: number;
  actorId: number | null;
  actorName: string;
  action: string;
  entityType: string;
  entityId: number;
  createdAt: string;
}
export interface AdminStats {
  totalUsers: number;
  totalJobs: number;
  totalProposals: number;
  activeProjects: number;
  usersByRole: Record<string, number>;
  jobsByStatus: Record<string, number>;
  proposalsByStatus: Record<string, number>;
  projectsByStatus: Record<string, number>;
}
export interface AdminFilters {
  keyword?: string;
  role?: string;
  status?: string;
  action?: string;
  page?: number;
  size?: number;
}
function query(filters: AdminFilters): string {
  const params = new URLSearchParams(pageQuery(filters.page, filters.size));
  for (const key of ["keyword", "role", "status", "action"] as const)
    if (filters[key]?.trim()) params.set(key, filters[key]!.trim());
  return params.toString();
}
export const adminDashboardApi = {
  users: (filters: AdminFilters = {}) =>
    apiRequest<Page<AdminUser>>(`/api/admin/users?${query(filters)}`),
  user: (id: number) => apiRequest<AdminUser>(`/api/admin/users/${id}`),
  async setLocked(user: AdminUser, locked: boolean): Promise<AdminUser> {
    return apiRequest<AdminUser>(
      `/api/admin/users/${user.id}/${locked ? "lock" : "unlock"}`,
      { method: "PATCH", headers: { "If-Match": `"${user.version}"` } },
    );
  },
  async proposals(filters: AdminFilters = {}): Promise<Page<AdminProposal>> {
    return (
      await apiRequestWithMeta<Page<AdminProposal>>(
        `/api/admin/proposals?${query(filters)}`,
        { parseJson: parseRecruitmentJson },
      )
    ).data;
  },
  async proposal(id: number): Promise<AdminProposalDetail> {
    return (
      await apiRequestWithMeta<AdminProposalDetail>(
        `/api/admin/proposals/${id}`,
        { parseJson: parseRecruitmentJson },
      )
    ).data;
  },
  activities: (filters: AdminFilters = {}) =>
    apiRequest<Page<AdminActivity>>(`/api/admin/activities?${query(filters)}`),
  stats: () => apiRequest<AdminStats>("/api/admin/stats"),
};
