import type { Workspace } from "./model";

export function createDemoWorkspace(): Workspace {
  const date = (days: number) =>
    new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
  return {
    id: "DEMO-0248",
    company: "NovaTech Studio",
    published: false,
    job: {
      title: "Thiết kế & phát triển nền tảng SaaS",
      description:
        "Xây dựng trải nghiệm quản lý bán hàng dành cho doanh nghiệp vừa và nhỏ. Bao gồm dashboard phân tích, quản lý đơn hàng và giao diện responsive. Cần mã nguồn rõ ràng, có tài liệu và kiểm thử các luồng quan trọng.",
      skills: ["React", "TypeScript", "Tailwind CSS"],
      budget: 42000000,
      deadline: date(40),
      criteria:
        "Hoàn tất 3 luồng chính, không tràn ngang ở 375px, kiểm thử đăng nhập và bàn giao mã nguồn kèm hướng dẫn.",
    },
    candidates: [
      {
        id: "candidate-1",
        name: "Nguyễn Hoàng Nam",
        initials: "HN",
        title: "Senior Frontend Developer",
        skills: ["React", "TypeScript", "Tailwind CSS", "Node.js"],
        years: 5,
        portfolioCount: 4,
        price: 42000000,
        days: 35,
        available: true,
        rating: 4.9,
        reviews: 27,
        cover:
          "Tôi đã xây dựng các sản phẩm SaaS với React và TypeScript. Đề xuất chia thành ba giai đoạn, cập nhật tiến độ hằng tuần và bàn giao kèm kiểm thử.",
        status: "SUBMITTED",
      },
      {
        id: "candidate-2",
        name: "Trần Minh Anh",
        initials: "MA",
        title: "Product Designer & Developer",
        skills: ["Figma", "React", "TypeScript"],
        years: 4,
        portfolioCount: 3,
        price: 39000000,
        days: 40,
        available: true,
        rating: 4.8,
        reviews: 18,
        cover:
          "Tôi tập trung vào trải nghiệm sản phẩm, hệ thống component và khả năng sử dụng trên mobile. Có thể bắt đầu sau khi hai bên thống nhất Scope.",
        status: "SHORTLISTED",
      },
      {
        id: "candidate-3",
        name: "Lê Thu Trang",
        initials: "TT",
        title: "Full-stack Developer",
        skills: ["React", "Node.js", "PostgreSQL"],
        years: 3,
        portfolioCount: 2,
        price: 46000000,
        days: 30,
        available: false,
        rating: null,
        reviews: 0,
        cover:
          "Đề xuất hoàn thiện frontend theo từng milestone và tổ chức phiên review cuối mỗi tuần. Thời gian bắt đầu cần được xác nhận.",
        status: "SUBMITTED",
      },
    ],
    selectedId: null,
    scope: {
      version: 1,
      deliverables:
        "Design system và prototype\nDashboard và quản lý đơn hàng\nMã nguồn, kiểm thử và tài liệu triển khai",
      exclusions:
        "Thanh toán, ứng dụng native và thay đổi backend không thuộc phạm vi.",
      criteria:
        "Responsive từ 375px; các luồng chính hoạt động; không có lỗi console do frontend.",
      budget: 42000000,
      deadline: date(40),
      approvals: [],
      locked: false,
    },
    scopeHistory: [],
    milestones: [
      {
        id: "ms-1",
        title: "Nghiên cứu & Design System",
        description:
          "Bàn giao bộ token, component và prototype được Client duyệt.",
        due: date(7),
        amount: 10000000,
        required: true,
        status: "PLANNED",
        submissions: [],
        feedback: [],
      },
      {
        id: "ms-2",
        title: "Triển khai giao diện",
        description:
          "Dashboard và luồng quản lý đơn hàng hoạt động trên desktop, tablet, mobile.",
        due: date(25),
        amount: 24000000,
        required: true,
        status: "PLANNED",
        submissions: [],
        feedback: [],
      },
      {
        id: "ms-3",
        title: "Kiểm thử & bàn giao",
        description:
          "Bàn giao mã nguồn, báo cáo kiểm thử và hướng dẫn vận hành.",
        due: date(40),
        amount: 8000000,
        required: true,
        status: "PLANNED",
        submissions: [],
        feedback: [],
      },
    ],
    changes: [],
    acceptedAt: null,
    review: null,
    activity: [
      { text: "Bản nháp dự án đã được tạo", at: new Date().toISOString() },
    ],
  };
}
