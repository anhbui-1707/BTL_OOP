import { apiRequest, pageQuery } from "./http";
import type { Page } from "./jobs";
export interface NotificationItem {
  id: number;
  kind: string;
  title: string;
  description: string;
  resourceType: "JOB_PROPOSAL" | "PROPOSAL" | "ASSIGNMENT" | "USER";
  resourceId: number;
  jobId: number | null;
  section: string | null;
  createdAt: string;
  readAt: string | null;
}
export const notificationsApi = {
  list(unreadOnly = false, page = 0, size = 20, signal?: AbortSignal) {
    return apiRequest<Page<NotificationItem>>(
      `/api/notifications?${pageQuery(page, size)}&unreadOnly=${unreadOnly}`,
      { signal },
    );
  },
  count(signal?: AbortSignal) {
    return apiRequest<{ unreadCount: number }>(
      "/api/notifications/unread-count",
      { signal },
    );
  },
  read(id: number) {
    return apiRequest<{ unreadCount: number }>(
      `/api/notifications/${id}/read`,
      { method: "PATCH", retry401: false },
    );
  },
  readAll() {
    return apiRequest<{ unreadCount: number }>("/api/notifications/read-all", {
      method: "PATCH",
      retry401: false,
    });
  },
};
