import { apiRequest, pageQuery } from "./http";
import type { Page } from "./jobs";
export interface CatalogSkill {
  id: number;
  name: string;
  category: string | null;
}
export const skillsApi = {
  list(
    q = "",
    page = 0,
    size = 20,
    signal?: AbortSignal,
  ): Promise<Page<CatalogSkill>> {
    const query = new URLSearchParams(pageQuery(page, size));
    if (q.trim()) query.set("q", q.trim());
    return apiRequest(`/api/skills?${query}`, { signal });
  },
};
