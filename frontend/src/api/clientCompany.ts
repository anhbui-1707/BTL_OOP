import { apiRequest } from "./http";

export interface ClientCompanyProfile {
  id: number;
  fullName: string;
  email: string;
  phoneNumber?: string | null;
  bio?: string | null;
  title?: string | null;
  companyName?: string | null;
  companyWebsite?: string | null;
  industry?: string | null;
  location?: string | null;
  publicContactPhone?: string | null;
  publicContactEmail?: string | null;
}
export interface PublicClientCompanyProfile {
  id: number;
  contactEmail?: string | null;
  representativeName: string;
  companyName?: string | null;
  jobTitle?: string | null;
  industry?: string | null;
  location?: string | null;
  companyWebsite?: string | null;
  publicContactPhone?: string | null;
  description?: string | null;
  avatarUrl?: string | null;
}
export interface PublicClientOpenJob {
  id: number;
  title: string;
  budgetMin: number | string;
  budgetMax: number | string;
  currencyCode: string;
  deadline: string;
}
export const clientCompanyApi = {
  mine(): Promise<ClientCompanyProfile> {
    return apiRequest<ClientCompanyProfile>("/api/clients/me");
  },
  save(
    input: Omit<ClientCompanyProfile, "id" | "email">,
  ): Promise<ClientCompanyProfile> {
    return apiRequest<ClientCompanyProfile>("/api/clients/me", {
      method: "PUT",
      body: JSON.stringify(input),
    });
  },
  publicJobs(id: number): Promise<PublicClientOpenJob[]> {
    return apiRequest<PublicClientOpenJob[]>(`/api/public/clients/${id}/jobs`, {
      auth: false,
    });
  },
  publicDetail(id: number): Promise<PublicClientCompanyProfile> {
    return apiRequest<PublicClientCompanyProfile>(`/api/public/clients/${id}`, {
      auth: false,
    });
  },
};
