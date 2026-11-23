import type { AuthUser } from "../../api/auth";
import { jobApi, type JobSummary, type Page } from "../../api/jobs";
import {
  assignmentsApi,
  proposalsApi,
  type Assignment,
  type ProposalSummary,
} from "../../api/recruitment";

export type DashboardRole = "Client" | "Freelancer" | "Admin";
export type Resource<T> =
  | { state: "loading" }
  | { state: "unsupported" }
  | { state: "error"; message: string }
  | { state: "ready" | "empty"; items: T[]; total: number };
export interface DashboardData {
  jobs: Resource<JobSummary>;
  proposals: Resource<ProposalSummary>;
  assignments: Resource<Assignment>;
}
const unsupported = { state: "unsupported" } as const;
export const initialDashboard = (role: DashboardRole): DashboardData => ({
  jobs: role === "Freelancer" ? unsupported : { state: "loading" },
  proposals: role === "Admin" ? unsupported : { state: "loading" },
  assignments: role === "Admin" ? unsupported : { state: "loading" },
});
export function rows<T>(r: Resource<T>): T[] | null {
  return r.state === "ready" || r.state === "empty" ? r.items : null;
}
export function metric<T>(
  r: Resource<T>,
  count?: (items: T[]) => number,
): string {
  if (r.state === "loading") return "Đang tải…";
  if (r.state === "unsupported") return "Chưa có dữ liệu thống kê";
  if (r.state === "error") return "Không tải được thống kê";
  return String(count ? count(r.items) : r.total);
}
export const resourceError = (e: unknown) => ({
  state: "error" as const,
  message: e instanceof Error ? e.message : "Không thể tải dữ liệu thống kê.",
});
const ready = <T>(items: T[], total = items.length): Resource<T> => ({
  state: total ? "ready" : "empty",
  items,
  total,
});
const safe = async <T>(
  read: () => Promise<Resource<T>>,
): Promise<Resource<T>> => {
  try {
    return await read();
  } catch (e) {
    return resourceError(e);
  }
};

export async function collectAll<T extends { id: number }>(
  fetchPage: (page: number, size: number) => Promise<Page<T>>,
  size = 100,
  maxPages = 20,
): Promise<{ items: T[]; total: number }> {
  const items: T[] = [];
  let total = -1;
  const ids = new Set<number>();
  for (let page = 0; ; page++) {
    if (page >= maxPages)
      throw new Error(
        "Quá nhiều trang để thống kê đầy đủ; cần API thống kê tổng hợp.",
      );
    const result = await fetchPage(page, size);
    if (
      !Number.isSafeInteger(result.totalElements) ||
      result.totalElements < 0 ||
      result.page !== page ||
      result.size !== size ||
      result.totalPages !== Math.ceil(result.totalElements / size)
    )
      throw new Error(
        "Metadata phân trang không hợp lệ; không thể thống kê đầy đủ.",
      );
    if (total === -1) total = result.totalElements;
    if (total !== result.totalElements)
      throw new Error(
        "Dữ liệu thay đổi khi phân trang. Vui lòng tải lại thống kê.",
      );
    if (result.totalPages > maxPages)
      throw new Error(
        "Quá nhiều trang để thống kê đầy đủ; cần API thống kê tổng hợp.",
      );
    for (const item of result.content) {
      if (ids.has(item.id))
        throw new Error("Dữ liệu phân trang bị trùng. Vui lòng tải lại.");
      ids.add(item.id);
      items.push(item);
    }
    if (page + 1 >= result.totalPages) {
      if (items.length !== total)
        throw new Error("Chưa nhận đủ dữ liệu thống kê. Vui lòng tải lại.");
      return { items, total };
    }
  }
}
async function boundedMap<T, R>(
  items: T[],
  read: (item: T) => Promise<R>,
): Promise<R[]> {
  const output: R[] = [];
  let next = 0;
  let failed = false;
  let failure: unknown;
  await Promise.all(
    Array.from({ length: Math.min(4, items.length) }, async () => {
      while (!failed && next < items.length) {
        const index = next++;
        try {
          output[index] = await read(items[index]);
        } catch (e) {
          failed = true;
          failure = e;
        }
      }
    }),
  );
  if (failed) throw failure;
  return output;
}
const inFlight = new Map<string, Promise<DashboardData>>();
export function loadDashboard(
  user: AuthUser,
  role: DashboardRole,
  sessionKey = 0,
): Promise<DashboardData> {
  if (!user.roles.includes(role.toUpperCase() as AuthUser["roles"][number]))
    return Promise.reject(new Error("Bạn không có quyền xem Dashboard này."));
  const key = JSON.stringify([
    user.id,
    role,
    [...user.roles].sort(),
    sessionKey,
  ]);
  const existing = inFlight.get(key);
  if (existing) return existing;
  const result = readDashboard(user, role).finally(() => {
    if (inFlight.get(key) === result) inFlight.delete(key);
  });
  inFlight.set(key, result);
  return result;
}
async function readDashboard(
  user: AuthUser,
  role: DashboardRole,
): Promise<DashboardData> {
  let requests = 0;
  const request = <T>(read: () => Promise<T>) => {
    if (++requests > 60)
      throw new Error(
        "Vượt giới hạn 60 request thống kê. Cần API tổng hợp; không hiển thị dữ liệu thiếu.",
      );
    return read();
  };
  const jobs =
    role === "Freelancer"
      ? Promise.resolve<Resource<JobSummary>>(unsupported)
      : safe(async () => {
          const result = await collectAll((page, size) =>
            request(() =>
              jobApi.search({ mine: role === "Client", page, size }),
            ),
          );
          if (
            role === "Client" &&
            result.items.some((j) => j.clientId !== user.id)
          )
            throw new Error(
              "API trả Job ngoài quyền sở hữu; không sử dụng để thống kê.",
            );
          return ready(result.items, result.total);
        });
  const assignments =
    role === "Admin"
      ? Promise.resolve<Resource<Assignment>>(unsupported)
      : safe(async () => {
          const result = await collectAll((page, size) =>
            request(() => assignmentsApi.list({ page, size })),
          );
          if (
            !user.roles.includes("ADMIN") &&
            result.items.some(
              (a) =>
                !(user.roles.includes("CLIENT") && a.clientId === user.id) &&
                !(
                  user.roles.includes("FREELANCER") &&
                  a.freelancerId === user.id
                ),
            )
          )
            throw new Error("API trả Assignment ngoài quyền truy cập.");
          const items = result.items.filter((a) =>
            role === "Client"
              ? a.clientId === user.id
              : a.freelancerId === user.id,
          );
          return ready(
            items,
            items.length === result.items.length ? result.total : items.length,
          );
        });
  const proposals: Promise<Resource<ProposalSummary>> =
    role === "Admin"
      ? Promise.resolve(unsupported)
      : role === "Freelancer"
        ? safe(async () => {
            const result = await collectAll((page, size) =>
              request(() => proposalsApi.mine({ page, size })),
            );
            if (result.items.some((p) => p.freelancerId !== user.id))
              throw new Error("API trả Proposal ngoài quyền truy cập.");
            return ready(result.items, result.total);
          })
        : safe(async () => {
            const owned = await jobs;
            const list = rows(owned);
            if (!list)
              throw new Error("Chưa tải đủ Job sở hữu để thống kê Proposal.");
            if (list.length + requests > 60)
              throw new Error(
                "Quá nhiều Job để thống kê Proposal trong giới hạn 60 request; cần API tổng hợp.",
              );
            const pages = await boundedMap(list, async (j) => {
              const result = await collectAll((page, size) =>
                request(() => proposalsApi.forJob(j.id, { page, size })),
              );
              if (
                result.items.some(
                  (p) => p.jobId !== j.id || p.clientId !== user.id,
                )
              )
                throw new Error("API trả Proposal ngoài Job sở hữu.");
              return result;
            });
            return ready(
              pages.flatMap((p) => p.items),
              pages.reduce((sum, p) => sum + p.total, 0),
            );
          });
  const [j, a, p] = await Promise.all([jobs, assignments, proposals]);
  return { jobs: j, assignments: a, proposals: p };
}

export const assignmentLabels = {
  PENDING_SCOPE: "Chờ chốt phạm vi",
  ACTIVE: "Đang thực hiện",
  AWAITING_ACCEPTANCE: "Chờ nghiệm thu",
  COMPLETED: "Đã hoàn thành",
  CANCELLED: "Đã hủy",
};
export const proposalLabels = {
  PENDING: "Chờ phản hồi",
  ACCEPTED: "Đã chấp nhận",
  REJECTED: "Đã từ chối",
  WITHDRAWN: "Đã rút",
};
export const jobLabels = {
  DRAFT: "Bản nháp",
  OPEN: "Đang mở",
  ASSIGNED: "Đã giao",
  IN_PROGRESS: "Đang thực hiện",
  COMPLETED: "Đã hoàn thành",
  CANCELLED: "Đã hủy",
  CLOSED: "Đã đóng",
};
export interface Series {
  state: "ready" | "empty" | "unsupported";
  months: { label: string; count: number }[];
  message?: string;
}
export function monthly<T>(
  items: T[],
  timestamp: (item: T) => string | null | undefined,
  now = new Date(),
): Series {
  const months = Array.from({ length: 6 }, (_, i) => {
    const date = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5 + i, 1),
    );
    return {
      year: date.getUTCFullYear(),
      month: date.getUTCMonth(),
      label: `T${date.getUTCMonth() + 1}/${date.getUTCFullYear()}`,
      count: 0,
    };
  });
  for (const item of items) {
    const raw = timestamp(item);
    const date = raw ? new Date(raw) : null;
    if (!date || !Number.isFinite(date.getTime()))
      return {
        state: "unsupported",
        months: [],
        message: "Thiếu timestamp hợp lệ để thống kê chính xác theo tháng.",
      };
    const bucket = months.find(
      (m) => m.year === date.getUTCFullYear() && m.month === date.getUTCMonth(),
    );
    if (bucket) bucket.count++;
  }
  return {
    state: months.some((m) => m.count) ? "ready" : "empty",
    months: months.map(({ label, count }) => ({ label, count })),
  };
}
