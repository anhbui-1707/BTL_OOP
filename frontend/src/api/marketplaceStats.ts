import { apiRequest } from "./http";

export interface MarketplaceStats {
  freelancers: number;
  jobs: number;
  completedJobs: number;
  activeClients: number;
  categories: Record<string, number>;
}

export const marketplaceStatsApi = {
  get: () =>
    apiRequest<MarketplaceStats>("/api/public/marketplace-stats", {
      auth: false,
    }),
};
