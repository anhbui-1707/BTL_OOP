import { jobApi, type Job, type JobInput } from "../../api/jobs";
export interface SkillChoice {
  skillId: number;
  name: string;
  isRequired: "" | "true" | "false";
}
export function chooseSkill(
  value: SkillChoice[],
  catalog: { id: number; name: string }[],
  id: number,
): SkillChoice[] {
  const skill = catalog.find((s) => s.id === id);
  if (!skill) throw new Error("Kỹ năng không thuộc trang danh mục hiện tại.");
  if (value.some((s) => s.skillId === id)) return value;
  if (value.length >= 50) throw new Error("Chọn tối đa 50 kỹ năng.");
  return [
    ...value,
    { skillId: skill.id, name: skill.name, isRequired: "false" },
  ];
}
export interface JobForm {
  title: string;
  description: string;
  deliverables: string;
  acceptanceCriteria: string;
  budgetMin: string;
  budgetMax: string;
  currencyCode: string;
  deadline: string;
  skills: SkillChoice[];
}
export const emptyJobForm = (): JobForm => ({
  title: "",
  description: "",
  deliverables: "",
  acceptanceCriteria: "",
  budgetMin: "",
  budgetMax: "",
  currencyCode: "",
  deadline: "",
  skills: [],
});
export function cents(value: string): bigint {
  if (!/^(?:0|[1-9]\d{0,16})(?:\.\d{1,2})?$/.test(value))
    throw new Error(
      "Ngân sách cần số không âm, tối đa 17 chữ số nguyên và 2 chữ số thập phân.",
    );
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
}
export function jobInput(form: JobForm): JobInput {
  for (const field of [
    "description",
    "deliverables",
    "acceptanceCriteria",
  ] as const)
    if (form[field].length > 20000)
      throw new Error(
        `${field === "acceptanceCriteria" ? "Yêu cầu đối với ứng viên" : field === "deliverables" ? "Sản phẩm bàn giao" : "Mô tả công việc"}: tối đa 20.000 ký tự.`,
      );
  if (form.title.length > 200) throw new Error("Tiêu đề tối đa 200 ký tự.");
  if (cents(form.budgetMin) > cents(form.budgetMax))
    throw new Error("budgetMin không được vượt budgetMax.");
  if (!/^[A-Z]{3}$/.test(form.currencyCode))
    throw new Error("Tiền tệ cần mã ba chữ cái viết hoa.");
  const date = new Date(`${form.deadline}T00:00:00Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(form.deadline) ||
    form.deadline.startsWith("0000") ||
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== form.deadline
  )
    throw new Error("Deadline không hợp lệ.");
  if (
    form.skills.length > 50 ||
    new Set(form.skills.map((s) => s.skillId)).size !== form.skills.length
  )
    throw new Error("Chọn tối đa 50 kỹ năng, không trùng lặp.");
  const skills = form.skills.map((s) => {
    if (
      !Number.isSafeInteger(s.skillId) ||
      s.skillId <= 0 ||
      s.isRequired === ""
    )
      throw new Error("Mỗi kỹ năng cần lựa chọn bắt buộc hoặc không bắt buộc.");
    return { skillId: s.skillId, isRequired: s.isRequired === "true" };
  });
  return {
    title: form.title,
    description: form.description,
    deliverables: form.deliverables,
    acceptanceCriteria: form.acceptanceCriteria,
    budgetMin: form.budgetMin,
    budgetMax: form.budgetMax,
    currencyCode: form.currencyCode,
    deadline: form.deadline,
    skills,
  };
}
export function formFromJob(job: Job): JobForm {
  return {
    title: job.title,
    description: job.description,
    deliverables: job.deliverables,
    acceptanceCriteria: job.acceptanceCriteria,
    budgetMin: String(job.budgetMin),
    budgetMax: String(job.budgetMax),
    currencyCode: job.currencyCode,
    deadline: job.deadline,
    skills: job.skills.map((s) => ({
      skillId: s.skillId,
      name: s.name,
      isRequired: s.isRequired ? "true" : "false",
    })),
  };
}

export async function saveJob(
  form: JobForm,
  current: Job | null,
  publish: boolean,
  saved: (job: Job) => void,
): Promise<Job> {
  const input = jobInput(form);
  let job = current
    ? await jobApi.update(current.id, input, current.etag)
    : await jobApi.create(input);
  saved(job);
  if (publish) {
    job = await jobApi.publish(job.id, job.etag);
    saved(job);
  }
  return job;
}
export function money(value: string | number, currency: string): string {
  const [whole, fraction] = String(value).split(".");
  return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ".")}${fraction ? `,${fraction}` : ""} ${currency}`;
}
