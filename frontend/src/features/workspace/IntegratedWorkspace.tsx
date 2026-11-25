import type { AuthUser } from "../../api/auth"
import Jobs from "../jobs/Jobs"
import Proposals from "../recruitment/Recruitment"
import ProductionWorkspace from "./ProductionWorkspace"
import type { Role, Section } from "./navigation"

export default function IntegratedWorkspace({
  role,
  section,
  user,
  page,
  navigate,
  initialJobId,
}: {
  role: Role
  section: Section
  user: AuthUser | null
  page: string
  navigate: (page: string) => void
  initialJobId?: number
}) {
  if (!user)
    return (
      <div className="panel function-panel" role="alert">
        Vui lòng đăng nhập để xem nội dung này.
      </div>
    )
  if (["quality", "proposals"].includes(section)) {
    if (section === "proposals" && role === "Freelancer")
      return <Proposals user={user} />
    if (section !== "quality" && role !== "Client")
      return (
        <div className="panel function-panel" role="alert">
          Chỉ Client chủ tin tuyển dụng được xem danh sách ứng viên.
        </div>
      )
    return (
      <Jobs
        key={user.id}
        manage
        admin={role === "Admin"}
        user={user}
        initialId={initialJobId}
        initialPanel={section === "quality" ? "quality" : "proposals"}
        onLogin={() => navigate("Tổng quan")}
        renderDescription={(text) => (
          <p className="job-description">{text || "Chưa cập nhật nội dung."}</p>
        )}
      />
    )
  }
  return (
    <ProductionWorkspace
      key={`${user.id}:${role}:${page}`}
      user={user}
      initialSection={section}
      dashboardPage={page}
      navigate={navigate}
      viewRole={role}
    />
  )
}
