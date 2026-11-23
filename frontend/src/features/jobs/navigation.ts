import type { JobStatus } from "../../api/jobs";

export type JobTab = "details" | "proposals" | "quality";
export interface ClientJobRoute {
  jobId: number | null;
  invalidId: boolean;
  tab: JobTab;
  status?: JobStatus;
  page: number;
  proposalId?: number;
}
const base = `#/dashboard/${encodeURIComponent("Quản lý công việc")}`;

export function readClientJobRoute(
  hash = window.location.hash,
): ClientJobRoute {
  const query = new URLSearchParams(hash.split("?")[1] || "");
  const rawId = query.get("jobId");
  const id = rawId && /^[1-9]\d*$/.test(rawId) ? Number(rawId) : NaN;
  const jobId = Number.isSafeInteger(id) ? id : null;
  const rawPage = query.get("page") || "0";
  const page =
    /^\d+$/.test(rawPage) && Number.isSafeInteger(Number(rawPage))
      ? Number(rawPage)
      : 0;
  const status = query.get("status");
  const proposal = query.get("proposalId");
  const proposalId =
    proposal &&
    /^[1-9]\d*$/.test(proposal) &&
    Number.isSafeInteger(Number(proposal))
      ? Number(proposal)
      : undefined;
  let legacyQuality = false;
  try {
    legacyQuality =
      decodeURIComponent(hash.split("?")[0]) === "#/dashboard/Chất lượng tin";
  } catch {}
  const tab = legacyQuality ? "quality" : query.get("tab");
  return {
    jobId,
    invalidId: rawId !== null && jobId === null,
    tab: tab === "proposals" || tab === "quality" ? tab : "details",
    status:
      status === "OPEN" || status === "IN_PROGRESS" || status === "COMPLETED"
        ? status
        : undefined,
    page,
    proposalId,
  };
}

export function clientJobQuery(route = readClientJobRoute()): string {
  const query = new URLSearchParams();
  if (route.jobId !== null || route.invalidId) {
    query.set("jobId", route.jobId === null ? "invalid" : String(route.jobId));
    query.set("tab", route.tab);
    if (route.proposalId && route.tab === "proposals")
      query.set("proposalId", String(route.proposalId));
  }
  if (route.status) query.set("status", route.status);
  if (route.page) query.set("page", String(route.page));
  return query.size ? `?${query}` : "";
}

export function navigateClientJobs(
  route: ClientJobRoute,
  replace = false,
): void {
  const previous = readClientJobRoute();
  let currentPath = "";
  try {
    currentPath = decodeURIComponent(window.location.hash.split("?")[0]);
  } catch {}
  const fromList =
    currentPath === "#/dashboard/Quản lý công việc" &&
    !previous.jobId &&
    !previous.invalidId;
  if (fromList && route.jobId && !replace) {
    window.history.replaceState(
      { ...window.history.state, linkitJobListScroll: window.scrollY },
      "",
    );
  }
  const state = {
    ...window.history.state,
    linkitJobFromList: replace
      ? Boolean(window.history.state?.linkitJobFromList)
      : fromList && Boolean(route.jobId),
    ...(fromList && !route.jobId && replace ? { linkitJobListScroll: 0 } : {}),
  };
  const hash = base + clientJobQuery(route);
  if (replace) window.history.replaceState(state, "", hash);
  else window.history.pushState(state, "", hash);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export function backToClientJobList(): void {
  if (window.history.state?.linkitJobFromList) window.history.back();
  else {
    window.history.replaceState(
      { ...window.history.state, linkitJobListScroll: 0 },
      "",
    );
    navigateClientJobs({
      ...readClientJobRoute(),
      jobId: null,
      invalidId: false,
      tab: "details",
    });
  }
}
