import { apiRequest } from "./http";

export interface SupportRequest {
  id: number;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: "NEW" | "IN_PROGRESS" | "RESOLVED";
  createdAt: string;
  adminReply: string | null;
  repliedAt: string | null;
}
export const supportApi = {
  submit: (value: {
    name: string;
    email: string;
    subject: string;
    message: string;
  }) =>
    apiRequest<void>("/api/public/support-requests", {
      method: "POST",
      body: JSON.stringify(value),
      auth: false,
    }),
  submitAuthenticated: (value: {
    name: string;
    email: string;
    subject: string;
    message: string;
  }) =>
    apiRequest<void>("/api/support-requests", {
      method: "POST",
      body: JSON.stringify(value),
    }),
  mine: () => apiRequest<SupportRequest[]>("/api/support-requests/me"),
  reply: (id: number, message: string) =>
    apiRequest<void>(`/api/admin/support-requests/${id}/reply`, {
      method: "POST",
      body: JSON.stringify({ message }),
    }),
  list: () => apiRequest<SupportRequest[]>("/api/admin/support-requests"),
  update: (id: number, status: SupportRequest["status"]) =>
    apiRequest<void>(`/api/admin/support-requests/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),
};
