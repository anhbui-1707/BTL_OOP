import type { AuthUser } from "../../api/auth";
import {
  assignmentsApi,
  proposalsApi,
  type Candidate,
  type ProposalInput,
  type ProposalSummary,
} from "../../api/recruitment";
import { jobApi, type Job } from "../../api/jobs";

export function proposalInput(
  coverLetter: string,
  budget: string,
  days: string,
  selectedCv = "",
): ProposalInput {
  const cover = coverLetter.trim();
  const amount = budget.trim();
  const duration = days.trim();
  if (!cover || cover.length > 20000)
    throw new Error("Thư ứng tuyển cần 1–20.000 ký tự.");
  if (!/^(0|[1-9]\d{0,16})(\.\d{1,2})?$/.test(amount))
    throw new Error(
      "Ngân sách phải không âm, tối đa 17 chữ số nguyên và 2 chữ số thập phân.",
    );
  if (
    !/^\d+$/.test(duration) ||
    Number(duration) < 1 ||
    Number(duration) > 2147483647
  )
    throw new Error(
      "Số ngày dự kiến phải là số nguyên từ 1 đến 2.147.483.647.",
    );
  const cvId = selectedCv ? Number(selectedCv) : null;
  if (
    selectedCv &&
    (!/^[1-9]\d*$/.test(selectedCv) ||
      cvId === null ||
      !Number.isSafeInteger(cvId) ||
      cvId < 1)
  )
    throw new Error("Mã CV không hợp lệ. Vui lòng tải lại danh sách CV.");
  return {
    coverLetter: cover,
    proposedBudget: amount,
    estimatedDays: Number(duration),
    cvId,
  };
}
export function ownsJob(
  user: AuthUser | null,
  job: Pick<Job, "clientId">,
): boolean {
  return !!user?.roles.includes("CLIENT") && job.clientId === user.id;
}
export function canSubmit(
  user: AuthUser | null,
  job: Pick<Job, "clientId" | "status">,
): boolean {
  return (
    !!user?.roles.includes("FREELANCER") &&
    user.id !== job.clientId &&
    job.status === "OPEN"
  );
}
export function proposalRights(
  user: AuthUser | null,
  proposal: ProposalSummary,
) {
  const open = proposal.status === "PENDING" && proposal.jobStatus === "OPEN";
  return {
    reject:
      open && !!user?.roles.includes("CLIENT") && proposal.clientId === user.id,
    withdraw:
      open &&
      !!user?.roles.includes("FREELANCER") &&
      proposal.freelancerId === user.id,
  };
}
export function canSelect(
  user: AuthUser | null,
  job: Job,
  candidate: Candidate,
): boolean {
  return (
    ownsJob(user, job) &&
    job.status === "OPEN" &&
    candidate.proposalStatus === "PENDING" &&
    candidate.selectable
  );
}

export async function selectAndReload(
  id: number,
  etag: string,
  committed: (id: number) => void,
) {
  const selected = await proposalsApi.select(id, etag);
  committed(selected.id);
  const [proposal, job, assignment] = await Promise.all([
    proposalsApi.detail(id),
    jobApi.detail(selected.jobId),
    assignmentsApi.detail(selected.id),
  ]);
  return { proposal, job, assignment };
}
