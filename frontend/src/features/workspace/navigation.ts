export type Role = "Client" | "Freelancer" | "Admin"
export type Section = "overview" | "quality" | "proposals" | "scope" | "milestones" | "acceptance"

export const workspacePages: Record<string, Section> = {
  "Không gian dự án": "overview",
  "Chất lượng tin": "quality",
  "Scope Lock": "scope",
  Milestone: "milestones",
  "Cảnh báo & nghiệm thu": "acceptance",
  "Báo cáo": "overview",
}
