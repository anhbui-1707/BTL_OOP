import { useState } from "react";
import type { AuthUser } from "../../api/auth";
import Jobs from "../jobs/Jobs";
import Proposals from "../recruitment/Recruitment";
import Workspace from "./Workspace";
import ProductionWorkspace from "./ProductionWorkspace";
import type { Role, Section } from "./model";

export default function IntegratedWorkspace({
  role,
  section,
  user,
  demo,
  page,
  navigate,
  initialJobId,
}: {
  role: Role;
  section: Section;
  user: AuthUser | null;
  demo: boolean;
  page: string;
  navigate: (page: string) => void;
  initialJobId?: number;
}) {
  const [showExample, setShowExample] = useState(false);
  if (demo)
    return (
      <Workspace
        key={role}
        role={role}
        initialSection={section}
        embedded
        demo
      />
    );
  if (!user)
    return (
      <div className="panel function-panel" role="alert">
        Vui lòng đăng nhập để xem nội dung này.
      </div>
    );
  if (section === "matching" && role === "Freelancer") {
    return (
      <>
        <div className="panel function-panel workspace-empty">
          <h2>Tìm công việc phù hợp với bạn</h2>
          <p>
            Hiện chưa có điểm phù hợp cá nhân để hiển thị. Bạn vẫn có thể xem
            yêu cầu từng công việc, đối chiếu kỹ năng và gửi đề xuất.
          </p>
          <div className="form-actions">
            <button
              className="primary-button"
              onClick={() => navigate("Tìm việc")}
            >
              Khám phá công việc
            </button>
            <button
              className="secondary-button"
              onClick={() => navigate("Đề xuất đã gửi")}
            >
              Xem đề xuất đã gửi
            </button>
            <button
              className="text-button"
              onClick={() => setShowExample((value) => !value)}
            >
              {showExample ? "Ẩn minh họa" : "Xem cách đánh giá · minh họa"}
            </button>
          </div>
          <small>
            Hệ thống hiện chưa cung cấp điểm phù hợp riêng cho tài khoản
            Freelancer.
          </small>
        </div>
        {showExample && (
          <Workspace
            key={role}
            role={role}
            initialSection="matching"
            embedded
            demo
            sectionOnly
          />
        )}
      </>
    );
  }
  if (["quality", "matching", "proposals"].includes(section)) {
    if (section === "proposals" && role === "Freelancer")
      return <Proposals user={user} />;
    if (section !== "quality" && role !== "Client")
      return (
        <div className="panel function-panel" role="alert">
          Chỉ Client chủ tin tuyển dụng được xem ứng viên và điểm Matching.
        </div>
      );
    return (
      <Jobs
        key={user.id}
        manage
        admin={role === "Admin"}
        user={user}
        initialId={initialJobId}
        initialPanel={
          section === "quality"
            ? "quality"
            : section === "matching"
              ? "matching"
              : "proposals"
        }
        onLogin={() => navigate("Tổng quan")}
        renderDescription={(text) => (
          <p className="job-description">{text || "Chưa cập nhật nội dung."}</p>
        )}
      />
    );
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
  );
}
