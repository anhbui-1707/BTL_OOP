package com.linkit.demo;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.linkit.identity.entity.FreelancerProfile.AvailabilityStatus;
import com.linkit.jobs.dto.JobDtos;
import com.linkit.jobs.service.JobQualityScorer;
import com.linkit.matching.service.CompatibilityScorer;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.*;

final class DemoSeedPlan {
    static final String VERSION = "linkit-demo-v2";
    static final int BASE = 2_000_000;
    static final int MARKER_ID = BASE + 9999;

    enum Secret {
        PASSWORD
    }

    record Table(
            String name,
            int target,
            List<String> key,
            boolean identity,
            List<Map<String, Object>> rows) {}

    final LinkedHashMap<String, Table> tables = new LinkedHashMap<>();
    final LocalDate reference;
    private final ObjectMapper json = new ObjectMapper();
    private final Map<Integer, Integer> selected = new HashMap<>();
    private final Set<String> scored = new HashSet<>();
    private static final String[] SKILLS = {
        "Java",
        "Spring Boot",
        "SQL Server",
        "React",
        "Next.js",
        "TypeScript",
        "Node.js",
        "NestJS",
        "Redis",
        "Python",
        "Django",
        "FastAPI",
        "C#",
        ".NET",
        "Azure",
        "Flutter",
        "Dart",
        "Firebase",
        "Kotlin",
        "Android",
        "Jetpack Compose",
        "Swift",
        "iOS",
        "SwiftUI",
        "Machine Learning",
        "PyTorch",
        "Computer Vision",
        "Power BI",
        "Pandas",
        "Data Analytics",
        "Docker",
        "Kubernetes",
        "GitHub Actions",
        "AWS",
        "Terraform",
        "Linux",
        "Security",
        "OWASP",
        "Penetration Testing",
        "Figma",
        "UI Design",
        "UX Research",
        "PostgreSQL",
        "MySQL",
        "Database Design",
        "Git",
        "Testing",
        "Documentation",
        "Communication",
        "Agile"
    };
    private static final String[] THEMES = {
        "Java / Spring Boot",
        "React / Next.js",
        "Node.js / TypeScript",
        "Python / FastAPI",
        "C# / .NET",
        "Flutter",
        "Android",
        "iOS",
        "AI / Machine Learning",
        "Data Analytics",
        "DevOps / Docker",
        "Cloud / AWS",
        "Cybersecurity",
        "UI/UX",
        "Database / SQL Server"
    };
    private static final String[] TASKS = {
        "Phát triển API quản lý đơn hàng Spring Boot", "Xây dựng cửa hàng trực tuyến Next.js",
        "Xây dựng dịch vụ thông báo đa kênh Node.js", "Tự động hóa đối soát chứng từ bằng Python",
        "Phát triển phân hệ CRM chăm sóc khách hàng .NET", "Xây dựng ứng dụng đặt lịch Flutter",
        "Phát triển ứng dụng kiểm kê kho Android", "Xây dựng ứng dụng khách hàng thân thiết iOS",
        "Huấn luyện mô hình phân loại ảnh sản phẩm", "Xây dựng báo cáo doanh thu Power BI",
        "Thiết lập CI/CD và giám sát ứng dụng Docker", "Triển khai hạ tầng AWS bằng Terraform",
        "Kiểm thử bảo mật cổng dịch vụ khách hàng", "Thiết kế trải nghiệm ERP quản lý vận hành",
        "Tối ưu cơ sở dữ liệu và báo cáo SQL Server"
    };
    private static final String[] OUTPUTS = {
        "API phân quyền, đơn hàng, tồn kho; OpenAPI và kiểm thử tích hợp",
        "Danh mục, giỏ hàng, tra cứu đơn; SEO, responsive và kiểm thử trình duyệt",
        "Hàng đợi gửi email, retry, lịch sử giao nhận; API và dashboard vận hành",
        "Pipeline đọc chứng từ, kiểm tra sai lệch, xuất Excel; dữ liệu kiểm thử đã ẩn danh",
        "Quản lý khách hàng, lịch chăm sóc và hợp đồng; báo cáo chuyển đổi",
        "Luồng đặt lịch, nhắc hẹn, hồ sơ; bản dựng Android và hướng dẫn cấu hình Firebase",
        "Quét mã, kiểm kê offline, đồng bộ dữ liệu; APK và bộ kiểm thử thiết bị",
        "Thẻ thành viên, lịch sử tích điểm, thông báo; bản dựng thử và hướng dẫn phát hành",
        "Tập dữ liệu tổng hợp, notebook huấn luyện, đánh giá F1; API suy luận và model card",
        "Mô hình dữ liệu, ETL kiểm soát chất lượng, dashboard và từ điển chỉ số",
        "Dockerfile, pipeline staging, rollback và cảnh báo; runbook xử lý sự cố",
        "Module Terraform, IAM tối thiểu, sao lưu và giám sát; dự toán chi phí tháng",
        "Kế hoạch kiểm thử được phê duyệt, bằng chứng phát hiện và báo cáo khắc phục OWASP",
        "Nghiên cứu luồng thao tác, wireframe, prototype Figma và design system bàn giao",
        "Phân tích execution plan, chỉ mục, stored procedure; báo cáo trước/sau và script rollback"
    };
    private static final String[] DOMAINS = {
        "chuỗi bán lẻ",
        "trung tâm đào tạo",
        "doanh nghiệp logistics",
        "hợp tác xã nông sản",
        "chuỗi phòng khám",
        "dịch vụ du lịch",
        "xưởng sản xuất nội thất"
    };
    private static final String[] COMPANIES = {
        "An Phát",
        "Minh Tâm",
        "Bình Minh",
        "Việt Xanh",
        "Đông Á",
        "Thiên Phúc",
        "Hải Đăng",
        "Nam Việt",
        "Tân Thành",
        "Hòa Bình",
        "Bảo An",
        "Gia Hưng",
        "Phú Thịnh",
        "Sao Mai",
        "Khánh Linh",
        "Trường Sơn",
        "Kim Ngân",
        "Đại Phát",
        "Thanh Hà",
        "Hưng Việt"
    };
    private static final String[] FAMILIES = {
        "Nguyễn", "Trần", "Lê", "Phạm", "Hoàng", "Huỳnh", "Phan", "Vũ", "Võ", "Đặng", "Bùi", "Đỗ"
    };
    private static final String[] NAMES = {
        "Minh Anh", "Quang Huy", "Thu Hà", "Đức Minh", "Ngọc Linh", "Thanh Tùng"
    };
    private static final String[] LOCATIONS = {
        "Hà Nội", "TP. Hồ Chí Minh", "Đà Nẵng", "Hải Phòng", "Cần Thơ", "Huế"
    };

    DemoSeedPlan() {
        this(
                LocalDate.now(ZoneOffset.UTC).isBefore(LocalDate.of(2026, 11, 23))
                        ? LocalDate.of(2026, 11, 23)
                        : LocalDate.now(ZoneOffset.UTC));
    }

    DemoSeedPlan(LocalDate reference) {
        this.reference = reference;
        define("users", 72, true, "id");
        define("user_roles", 72, false, "user_id", "role");
        define("client_profiles", 20, false, "user_id");
        define("freelancer_profiles", 50, false, "user_id");
        define("skills", 50, true, "id");
        define("freelancer_skills", 200, false, "freelancer_id", "skill_id");
        define("work_experiences", 50, true, "id");
        define("portfolio_projects", 50, true, "id");
        define("freelancer_cvs", 50, true, "id");
        define("jobs", 100, true, "id");
        define("job_skills", 300, false, "job_id", "skill_id");
        define("job_quality_assessments", 100, true, "id");
        define("proposals", 250, true, "id");
        define("compatibility_scores", 300, true, "id");
        define("saved_jobs", 100, true, "id");
        define("assignments", 35, true, "id");
        define("scope_versions", 35, true, "id");
        define("scope_approvals", 70, true, "id");
        define("milestones", 120, true, "id");
        define("milestone_submissions", 80, true, "id");
        define("risk_alerts", 20, true, "id");
        define("final_acceptances", 15, true, "id");
        define("reviews", 15, true, "id");
        define("audit_logs", 300, true, "id");
        define("notifications", 180, true, "id");
        define("notification_delivery_receipts", 300, false, "source_audit_id");
        identities();
        jobs();
        proposals();
        scores();
        saved();
        projects();
        submissions();
        completion();
        risks();
        audit();
        notifications();
        for (Table t : tables.values())
            if (t.rows.size() != t.target)
                throw new IllegalStateException(
                        "Seed plan count mismatch: " + t.name + "=" + t.rows.size());
        offsetIds();
    }

    private void define(String name, int target, boolean identity, String... keys) {
        tables.put(name, new Table(name, target, List.of(keys), identity, new ArrayList<>()));
    }

    private Map<String, Object> add(String table, Object... values) {
        Map<String, Object> row = new LinkedHashMap<>();
        for (int i = 0; i < values.length; i += 2) row.put((String) values[i], values[i + 1]);
        tables.get(table).rows.add(row);
        return row;
    }

    private List<Map<String, Object>> rows(String table) {
        return tables.get(table).rows;
    }

    private Map<String, Object> row(String table, int id) {
        return rows(table).get(id - 1);
    }

    private static Timestamp at(LocalDate date) {
        return Timestamp.from(date.atTime(9, 0).toInstant(ZoneOffset.UTC));
    }

    private static java.sql.Date day(LocalDate date) {
        return java.sql.Date.valueOf(date);
    }

    private static int client(int j) {
        return (j - 1) % 20 + 1;
    }

    private static int freelancer(int f) {
        return 20 + f;
    }

    private static int winner(int a) {
        return (a + 4) % 15 + 1;
    }

    private static int theme(int n) {
        return (n - 1) % 15;
    }

    private LocalDate created(int j) {
        return j <= 50
                ? reference.minusDays(8 + j % 12)
                : reference.minusDays(j <= 65 ? 70 : j <= 85 ? 45 : 140);
    }

    private LocalDate deadline(int j) {
        return j <= 50
                ? reference.plusDays(38 + j * 2L)
                : j <= 65
                        ? reference.minusDays(15 + j % 9)
                        : j <= 85 ? reference.plusDays(30 + j % 20) : created(j).plusDays(100);
    }

    private BigDecimal budget(int j) {
        return BigDecimal.valueOf(15000000L + theme(j) * 2500000L + (j % 7) * 1000000L).setScale(2);
    }

    private String json(Object value) {
        try {
            return json.writeValueAsString(value);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException(e);
        }
    }

    private void identities() {
        for (int u = 1; u <= 72; u++) {
            String role = u <= 20 ? "CLIENT" : u <= 70 ? "FREELANCER" : "ADMIN";
            String email =
                    u == 6
                            ? "client@demo.linkit.test"
                            : u == 26
                                    ? "freelancer@demo.linkit.test"
                                    : u == 71
                                            ? "admin@demo.linkit.test"
                                            : role.toLowerCase(Locale.ROOT)
                                                    + "."
                                                    + (u <= 20 ? u : u <= 70 ? u - 20 : u - 70)
                                                    + "@demo.linkit.test";
            add(
                    "users",
                    "id",
                    u,
                    "email",
                    email,
                    "password_hash",
                    Secret.PASSWORD,
                    "full_name",
                    FAMILIES[(u - 1) % 12] + " " + NAMES[(u - 1) / 12],
                    "phone_number",
                    null,
                    "avatar_url",
                    avatar(role, u),
                    "status",
                    "ACTIVE",
                    "email_verified_at",
                    at(reference.minusDays(220)),
                    "created_at",
                    at(reference.minusDays(230)),
                    "updated_at",
                    at(reference.minusDays(200)));
            add(
                    "user_roles",
                    "user_id",
                    u,
                    "role",
                    role,
                    "assigned_at",
                    at(reference.minusDays(230)));
        }
        for (int c = 1; c <= 20; c++)
            add(
                    "client_profiles",
                    "user_id",
                    c,
                    "company_name",
                    "Công ty demo " + COMPANIES[c - 1],
                    "company_website",
                    "https://company-" + c + ".example.invalid",
                    "industry",
                    DOMAINS[(c - 1) % 7],
                    "description",
                    "Doanh nghiệp giả lập "
                            + COMPANIES[c - 1]
                            + " cung cấp giải pháp cho "
                            + DOMAINS[(c - 1) % 7]
                            + ". Đội vận hành phối hợp phản hồi hàng tuần, ưu tiên sản phẩm có tài liệu và khả năng bảo trì.",
                    "location",
                    LOCATIONS[(c - 1) % 6],
                    "job_title",
                    "Quản lý dự án số",
                    "public_contact_email",
                    "contact-" + c + "@example.invalid",
                    "public_contact_phone",
                    null,
                    "updated_at",
                    at(reference.minusDays(200)));
        for (int s = 1; s <= 50; s++)
            add(
                    "skills",
                    "id",
                    s,
                    "name",
                    SKILLS[s - 1],
                    "category",
                    s <= 45 ? THEMES[(s - 1) / 3] : "Kỹ năng hỗ trợ",
                    "is_active",
                    true);
        for (int f = 1; f <= 50; f++) {
            int uid = freelancer(f), experience = 1 + f % 9;
            add(
                    "freelancer_profiles",
                    "user_id",
                    uid,
                    "headline",
                    "Chuyên viên " + THEMES[theme(f)],
                    "bio",
                    "Hồ sơ demo: "
                            + experience
                            + " năm phát triển giải pháp "
                            + THEMES[theme(f)]
                            + " cho "
                            + DOMAINS[f % 7]
                            + ". Chủ động phân tích yêu cầu, kiểm thử và hướng dẫn vận hành; cập nhật tiến độ hai lần mỗi tuần.",
                    "years_experience",
                    experience,
                    "hourly_rate",
                    BigDecimal.valueOf(120000L + f % 9 * 35000L),
                    "location",
                    LOCATIONS[(f - 1) % 6],
                    "availability_status",
                    f <= 15 ? "BUSY" : f % 9 == 0 ? "UNAVAILABLE" : "AVAILABLE",
                    "portfolio_url",
                    null,
                    "is_public",
                    true,
                    "updated_at",
                    at(reference.minusDays(160)));
            for (int k = 0; k < 3; k++)
                add(
                        "freelancer_skills",
                        "freelancer_id",
                        uid,
                        "skill_id",
                        theme(f) * 3 + k + 1,
                        "proficiency",
                        2 + (f + k) % 4,
                        "years_experience",
                        experience);
            add(
                    "freelancer_skills",
                    "freelancer_id",
                    uid,
                    "skill_id",
                    46 + (f - 1) % 5,
                    "proficiency",
                    3 + f % 3,
                    "years_experience",
                    experience);
            add(
                    "work_experiences",
                    "id",
                    f,
                    "freelancer_id",
                    uid,
                    "company_name",
                    "Studio demo " + COMPANIES[(f - 1) % 20],
                    "position",
                    "Kỹ sư " + THEMES[theme(f)],
                    "start_date",
                    day(reference.minusYears(experience)),
                    "end_date",
                    null,
                    "is_current",
                    true,
                    "description",
                    "Phát triển và bảo trì sản phẩm phục vụ "
                            + DOMAINS[f % 7]
                            + "; tham gia phân tích, review và kiểm thử.",
                    "achievements",
                    "Bàn giao bộ tài liệu vận hành, cải thiện luồng xử lý lỗi và quy trình kiểm thử tự động.",
                    "created_at",
                    at(reference.minusDays(180)),
                    "updated_at",
                    at(reference.minusDays(160)));
            add(
                    "portfolio_projects",
                    "id",
                    f,
                    "freelancer_id",
                    uid,
                    "title",
                    TASKS[theme(f)],
                    "description",
                    "Dự án minh họa cho "
                            + DOMAINS[f % 7]
                            + ". Sản phẩm gồm "
                            + OUTPUTS[theme(f)]
                            + ". Toàn bộ thông tin là giả lập phục vụ demo.",
                    "project_role",
                    "Phân tích, phát triển và bàn giao",
                    "technologies",
                    String.join(", ", Arrays.copyOfRange(SKILLS, theme(f) * 3, theme(f) * 3 + 3)),
                    "project_url",
                    null,
                    "github_url",
                    null,
                    "start_date",
                    day(reference.minusDays(210)),
                    "end_date",
                    day(reference.minusDays(170)),
                    "created_at",
                    at(reference.minusDays(160)),
                    "updated_at",
                    at(reference.minusDays(160)));
            byte[] cv =
                    pdf(
                            "DEMO CV - Freelancer "
                                    + f
                                    + " - "
                                    + experience
                                    + " years. Fictional profile for LinkIT development only.");
            add(
                    "freelancer_cvs",
                    "id",
                    f,
                    "freelancer_id",
                    uid,
                    "file_name",
                    "linkit-demo-cv-" + f + ".pdf",
                    "byte_size",
                    cv.length,
                    "content",
                    cv,
                    "uploaded_at",
                    at(reference.minusDays(160)));
        }
    }

    private void jobs() {
        for (int j = 1; j <= 100; j++) {
            int t = theme(j);
            String domain = DOMAINS[(j - 1) / 15];
            add(
                    "jobs",
                    "id",
                    j,
                    "client_id",
                    client(j),
                    "title",
                    TASKS[t] + " cho " + domain,
                    "description",
                    "Công ty demo "
                            + COMPANIES[client(j) - 1]
                            + " cần "
                            + TASKS[t].toLowerCase(Locale.ROOT)
                            + " phục vụ "
                            + domain
                            + ". Hiện nhân viên đang tổng hợp dữ liệu thủ công, khó kiểm soát sai lệch và thời gian phản hồi. Dự án cần phân tích quy trình, thống nhất dữ liệu đầu vào, triển khai trên môi trường thử nghiệm và bàn giao cho đội vận hành. Client cung cấp dữ liệu giả lập và đầu mối duyệt hàng tuần.",
                    "deliverables",
                    OUTPUTS[t] + "; mã nguồn hoặc tệp thiết kế và tài liệu bàn giao tiếng Việt.",
                    "acceptance_criteria",
                    "Đáp ứng các luồng đã thống nhất trong phạm vi; kiểm thử trường hợp hợp lệ và lỗi; không còn lỗi nghiêm trọng; có hướng dẫn cài đặt, sử dụng và biên bản đối chiếu kết quả.",
                    "budget_min",
                    budget(j).multiply(new BigDecimal("0.8")),
                    "budget_max",
                    budget(j),
                    "currency_code",
                    "VND",
                    "deadline",
                    day(deadline(j)),
                    "status",
                    j <= 50 ? "OPEN" : j <= 65 ? "CLOSED" : j <= 85 ? "IN_PROGRESS" : "COMPLETED",
                    "published_at",
                    at(created(j).plusDays(1)),
                    "created_at",
                    at(created(j)),
                    "updated_at",
                    at(
                            j <= 65
                                    ? created(j).plusDays(5)
                                    : j <= 85 ? reference.minusDays(2) : created(j).plusDays(106)));
            for (int k = 0; k < 3; k++)
                add(
                        "job_skills",
                        "job_id",
                        j,
                        "skill_id",
                        t * 3 + k + 1,
                        "required_level",
                        3,
                        "is_required",
                        true,
                        "weight",
                        new BigDecimal(k == 2 ? "34.00" : "33.00"));
            var job = row("jobs", j);
            List<JobDtos.SkillInput> inputs = new ArrayList<>();
            for (int k = 0; k < 3; k++)
                inputs.add(new JobDtos.SkillInput((long) (t * 3 + k + 1), true));
            var evaluation =
                    new JobQualityScorer()
                            .evaluate(
                                    new JobDtos.WriteRequest(
                                            (String) job.get("title"),
                                            (String) job.get("description"),
                                            (String) job.get("deliverables"),
                                            (String) job.get("acceptance_criteria"),
                                            (BigDecimal) job.get("budget_min"),
                                            budget(j),
                                            "VND",
                                            deadline(j),
                                            inputs),
                                    created(j).plusDays(1));
            add(
                    "job_quality_assessments",
                    "id",
                    j,
                    "job_id",
                    j,
                    "score",
                    evaluation.score(),
                    "rules_version",
                    JobQualityScorer.VERSION,
                    "breakdown_json",
                    json(evaluation.breakdown()),
                    "recommendations_json",
                    json(evaluation.recommendations()),
                    "evaluated_at",
                    at(created(j).plusDays(1)));
        }
    }

    private void proposals() {
        for (int j = 1; j <= 100; j++)
            for (int k = 0; k < (j <= 50 ? 3 : 2); k++) {
                int f =
                        j > 65
                                ? (k == 0 ? winner(j - 65) : winner(j - 65) + 15)
                                : 1 + (j - 1 + k * 17) % 50;
                String status =
                        j > 65
                                ? (k == 0 ? "ACCEPTED" : "REJECTED")
                                : j > 50
                                        ? (k == 0 ? "REJECTED" : "WITHDRAWN")
                                        : k == 2 && j % 4 == 0 ? "WITHDRAWN" : "PENDING";
                int id = rows("proposals").size() + 1;
                add(
                        "proposals",
                        "id",
                        id,
                        "job_id",
                        j,
                        "freelancer_id",
                        freelancer(f),
                        "cover_letter",
                        "Tôi có kinh nghiệm "
                                + THEMES[theme(f)]
                                + ". Với dự án “"
                                + row("jobs", j).get("title")
                                + "”, tôi đề xuất khảo sát dữ liệu, thống nhất đầu ra, triển khai từng phần và kiểm thử cùng Client. Sản phẩm bàn giao kèm tài liệu, hướng dẫn và lịch cập nhật tiến độ hai lần mỗi tuần.",
                        "proposed_budget",
                        budget(j),
                        "estimated_days",
                        21 + j % 15,
                        "status",
                        status,
                        "submitted_at",
                        at(created(j).plusDays(3)),
                        "updated_at",
                        at(created(j).plusDays(j > 65 ? 6 : 4)));
                if (status.equals("ACCEPTED")) selected.put(j, id);
                score(j, f);
            }
    }

    private void scores() {
        for (int j = 1; j <= 50; j++) score(j, 1 + (j - 1 + 7) % 50);
    }

    private void score(int j, int f) {
        if (!scored.add(j + ":" + f))
            throw new IllegalStateException("Duplicate compatibility pair");

        add(
                "compatibility_scores",
                "id",
                rows("compatibility_scores").size() + 1,
                "job_id",
                j,
                "freelancer_id",
                freelancer(f),
                "score",
                BigDecimal.ZERO,
                "rules_version",
                CompatibilityScorer.VERSION,
                "breakdown_json",
                "{}",
                "evaluated_at",
                at(created(j).plusDays(2)));
    }

    private void saved() {
        for (int f = 1; f <= 50; f++)
            for (int k = 0; k < 2; k++)
                add(
                        "saved_jobs",
                        "id",
                        rows("saved_jobs").size() + 1,
                        "freelancer_id",
                        freelancer(f),
                        "job_id",
                        1 + (f - 1 + k * 7) % 50,
                        "saved_at",
                        at(reference.minusDays(2)));
    }

    private void projects() {
        for (int a = 1; a <= 35; a++) {
            int j = a + 65;
            boolean completed = a > 20;
            add(
                    "assignments",
                    "id",
                    a,
                    "job_id",
                    j,
                    "proposal_id",
                    selected.get(j),
                    "client_id",
                    client(j),
                    "freelancer_id",
                    freelancer(winner(a)),
                    "agreed_budget",
                    budget(j),
                    "currency_code",
                    "VND",
                    "status",
                    completed ? "COMPLETED" : "ACTIVE",
                    "started_at",
                    at(created(j).plusDays(9)),
                    "completed_at",
                    completed ? at(created(j).plusDays(105)) : null,
                    "created_at",
                    at(created(j).plusDays(7)));
            add(
                    "scope_versions",
                    "id",
                    a,
                    "assignment_id",
                    a,
                    "version_number",
                    1,
                    "deliverables",
                    row("jobs", j).get("deliverables"),
                    "exclusions",
                    "Không gồm thanh toán thật, nhập dữ liệu lịch sử hoặc vận hành dài hạn ngoài phạm vi.",
                    "acceptance_criteria",
                    row("jobs", j).get("acceptance_criteria"),
                    "budget",
                    budget(j),
                    "deadline",
                    day(deadline(j)),
                    "status",
                    "LOCKED",
                    "created_by",
                    client(j),
                    "created_at",
                    at(created(j).plusDays(8)),
                    "locked_at",
                    at(created(j).plusDays(9)));
            for (String role : List.of("CLIENT", "FREELANCER"))
                add(
                        "scope_approvals",
                        "id",
                        rows("scope_approvals").size() + 1,
                        "scope_version_id",
                        a,
                        "user_id",
                        role.equals("CLIENT") ? client(j) : freelancer(winner(a)),
                        "party_role",
                        role,
                        "approved_at",
                        at(created(j).plusDays(9)));
            int count = completed ? 4 : 3;
            for (int k = 1; k <= count; k++) {
                String status =
                        completed
                                ? "APPROVED"
                                : k == 1
                                        ? (a <= 10
                                                ? "SUBMITTED"
                                                : a <= 15 ? "REVISION_REQUIRED" : "APPROVED")
                                        : k == 2 ? "IN_PROGRESS" : "PLANNED";
                BigDecimal amount =
                        budget(j).divide(BigDecimal.valueOf(count), 2, RoundingMode.DOWN);
                if (k == count)
                    amount = budget(j).subtract(amount.multiply(BigDecimal.valueOf(count - 1L)));
                LocalDate due =
                        completed
                                ? created(j).plusDays(25 + k * 18L)
                                : k == 1 ? reference.minusDays(3) : reference.plusDays(k * 9L);
                add(
                        "milestones",
                        "id",
                        rows("milestones").size() + 1,
                        "assignment_id",
                        a,
                        "scope_version_id",
                        a,
                        "title",
                        List.of(
                                        "Thiết kế và xác nhận luồng nghiệp vụ",
                                        "Phát triển và kiểm thử chức năng",
                                        "Đối chiếu kết quả và bàn giao",
                                        "Hướng dẫn vận hành và nghiệm thu")
                                .get(k - 1),
                        "description",
                        "Giai đoạn "
                                + k
                                + " của dự án “"
                                + row("jobs", j).get("title")
                                + "”. Đầu ra đối chiếu theo phạm vi đã thống nhất.",
                        "acceptance_criteria",
                        "Có sản phẩm kiểm tra được, bằng chứng kiểm thử, tài liệu và phản hồi xử lý đầy đủ.",
                        "due_date",
                        day(due),
                        "amount",
                        amount,
                        "is_required",
                        true,
                        "sort_order",
                        k,
                        "status",
                        status,
                        "approved_at",
                        status.equals("APPROVED")
                                ? at(completed ? due : reference.minusDays(4))
                                : null,
                        "created_at",
                        at(created(j).plusDays(10)));
            }
        }
    }

    private void submissions() {
        for (var m : rows("milestones")) {
            String status = (String) m.get("status");
            if (!Set.of("APPROVED", "SUBMITTED", "REVISION_REQUIRED").contains(status)) continue;
            int a = (Integer) m.get("assignment_id"), j = a + 65, k = (Integer) m.get("sort_order");
            LocalDate submitted =
                    a > 20 ? created(j).plusDays(24 + k * 18L) : reference.minusDays(5);
            add(
                    "milestone_submissions",
                    "id",
                    rows("milestone_submissions").size() + 1,
                    "milestone_id",
                    m.get("id"),
                    "submission_number",
                    1,
                    "submitted_by",
                    freelancer(winner(a)),
                    "evidence_url",
                    null,
                    "submission_note",
                    "Bản bàn giao demo cho “"
                            + m.get("title")
                            + "”: "
                            + OUTPUTS[theme(j)]
                            + ". Đã đối chiếu danh sách tiêu chí, ghi nhận kiểm thử luồng chính và lỗi. Đây là minh họa dữ liệu; chưa đính kèm tệp sản phẩm thực.",
                    "status",
                    status,
                    "reviewed_by",
                    status.equals("SUBMITTED") ? null : client(j),
                    "review_note",
                    status.equals("SUBMITTED")
                            ? null
                            : status.equals("APPROVED")
                                    ? "Đã đối chiếu tiêu chí, kết quả đạt yêu cầu."
                                    : "Cần bổ sung thông báo lỗi và hướng dẫn thao tác trước khi duyệt.",
                    "submitted_at",
                    at(submitted),
                    "reviewed_at",
                    status.equals("SUBMITTED") ? null : at(submitted.plusDays(1)));
        }
    }

    private void completion() {
        for (int a = 21; a <= 35; a++) {
            int id = a - 20, j = a + 65;
            add(
                    "final_acceptances",
                    "id",
                    id,
                    "assignment_id",
                    a,
                    "scope_version_id",
                    a,
                    "accepted_by",
                    client(j),
                    "acceptance_note",
                    "Đã đối chiếu phạm vi khóa, các mốc bắt buộc và tài liệu; thống nhất nghiệm thu toàn bộ dự án.",
                    "accepted_at",
                    at(created(j).plusDays(105)));
            add(
                    "reviews",
                    "id",
                    id,
                    "assignment_id",
                    a,
                    "reviewer_id",
                    client(j),
                    "freelancer_id",
                    freelancer(winner(a)),
                    "overall_rating",
                    id % 4 == 0 ? 4 : 5,
                    "quality_rating",
                    id % 3 == 0 ? 4 : 5,
                    "communication_rating",
                    id % 5 == 0 ? 3 : 5,
                    "timeliness_rating",
                    id % 4 == 0 ? 4 : 5,
                    "comment",
                    List.of(
                                    "Bàn giao đầy đủ, phản hồi nhanh và giải thích rõ phần vận hành.",
                                    "Chủ động báo cáo tiến độ, xử lý góp ý cẩn thận; tài liệu dễ theo dõi.",
                                    "Sản phẩm đáp ứng phạm vi; nên dành thêm thời gian kiểm thử ở dự án tiếp theo.")
                            .get((id - 1) % 3),
                    "created_at",
                    at(created(j).plusDays(106)));
        }
    }

    private void risks() {
        for (int a = 1; a <= 20; a++)
            add(
                    "risk_alerts",
                    "id",
                    a,
                    "assignment_id",
                    a,
                    "milestone_id",
                    (a - 1) * 3 + 1,
                    "risk_type",
                    a <= 10 ? "MILESTONE_OVERDUE" : "DEADLINE_NEAR",
                    "severity",
                    a % 3 == 0 ? "HIGH" : "MEDIUM",
                    "title",
                    a <= 10
                            ? "Mốc bàn giao đang chờ phản hồi"
                            : "Cần theo dõi lịch bàn giao tiếp theo",
                    "description",
                    "Hai bên cần rà soát sản phẩm và cập nhật kế hoạch tại workspace; cảnh báo hỗ trợ theo dõi tiến độ.",
                    "rule_code",
                    a <= 10 ? "MILESTONE_OVERDUE" : "DEADLINE_NEAR",
                    "status",
                    a % 2 == 0 ? "ACKNOWLEDGED" : "OPEN",
                    "detected_at",
                    at(reference.minusDays(1)),
                    "resolved_at",
                    null);
    }

    private void audit() {
        for (var p : rows("proposals"))
            log(
                    "proposals",
                    (Integer) p.get("id"),
                    (Integer) p.get("freelancer_id"),
                    "PROPOSAL_SUBMITTED",
                    p.get("submitted_at"));
        for (var r : rows("reviews"))
            log(
                    "reviews",
                    (Integer) r.get("id"),
                    (Integer) r.get("reviewer_id"),
                    "REVIEW_CREATED",
                    r.get("created_at"));
        for (int a = 1; a <= 35; a++)
            log(
                    "scope_versions",
                    a,
                    client(a + 65),
                    "SCOPE_LOCKED",
                    at(created(a + 65).plusDays(9)));
        for (var log : rows("audit_logs"))
            add("notification_delivery_receipts", "source_audit_id", log.get("id"));
    }

    private void log(String entity, int id, int actor, String action, Object time) {
        int n = rows("audit_logs").size() + 1;
        add(
                "audit_logs",
                "id",
                n,
                "actor_user_id",
                actor,
                "entity_type",
                entity,
                "entity_id",
                id,
                "action",
                action,
                "before_json",
                null,
                "after_json",
                json(Map.of("seedVersion", VERSION, "scenario", entity + "-" + id)),
                "request_id",
                UUID.nameUUIDFromBytes((VERSION + "-event-" + n).getBytes(StandardCharsets.UTF_8)),
                "created_at",
                time);
    }

    private void notifications() {
        for (int n = 1; n <= 93; n++) {
            var p = row("proposals", n);
            int j = (Integer) p.get("job_id"), f = (Integer) p.get("freelancer_id");
            boolean toClient = n % 2 == 1;
            notification(
                    toClient ? client(j) : f,
                    n,
                    toClient ? "PROPOSAL_SUBMITTED" : "PROPOSAL_STATUS",
                    toClient ? "Có đề xuất ứng tuyển mới" : "Theo dõi đề xuất ứng tuyển",
                    "Đề xuất cho “"
                            + row("jobs", j).get("title")
                            + "” đã được ghi nhận. Xem nội dung và trạng thái hiện tại trong danh sách đề xuất.",
                    toClient ? "JOB_PROPOSAL" : "PROPOSAL",
                    (Integer) p.get("id"),
                    j,
                    null,
                    p.get("submitted_at"));
        }
        for (int a = 1; a <= 35; a++)
            for (int recipient : List.of(client(a + 65), freelancer(winner(a))))
                notification(
                        recipient,
                        265 + a,
                        "SCOPE_LOCKED",
                        "Phạm vi dự án đã thống nhất",
                        "Hai bên đã duyệt cùng phiên bản phạm vi cho “"
                                + row("jobs", a + 65).get("title")
                                + "”. Xem phạm vi và các mốc bàn giao tại workspace.",
                        "ASSIGNMENT",
                        a,
                        a + 65,
                        "scope",
                        at(created(a + 65).plusDays(9)));
        for (int r = 1; r <= 15; r++) {
            int a = r + 20;
            notification(
                    freelancer(winner(a)),
                    250 + r,
                    "REVIEW_CREATED",
                    "Bạn nhận được đánh giá mới",
                    "Client đã đánh giá dự án hoàn thành. Xem nhận xét và điểm đánh giá trong phần nghiệm thu.",
                    "ASSIGNMENT",
                    a,
                    a + 65,
                    "acceptance",
                    row("reviews", r).get("created_at"));
        }
        for (int admin = 71; admin <= 72; admin++)
            notification(
                    admin,
                    admin - 70,
                    "DEMO_OVERVIEW",
                    "Bộ dữ liệu demo sẵn sàng",
                    "Có dữ liệu người dùng, công việc và dự án để kiểm tra tìm kiếm, trạng thái và phân trang trong khu vực quản trị.",
                    "USER",
                    admin,
                    null,
                    null,
                    at(reference));
    }

    private void notification(
            int recipient,
            int source,
            String kind,
            String title,
            String text,
            String type,
            int resource,
            Integer job,
            String section,
            Object time) {
        int n = rows("notifications").size() + 1;
        add(
                "notifications",
                "id",
                n,
                "recipient_id",
                recipient,
                "source_audit_id",
                source,
                "kind",
                kind,
                "title",
                title,
                "description",
                text,
                "resource_type",
                type,
                "resource_id",
                resource,
                "job_id",
                job,
                "section",
                section,
                "created_at",
                time,
                "read_at",
                n % 3 == 0 ? time : null);
    }

    private void offsetIds() {
        Set<String> ids =
                Set.of(
                        "id",
                        "user_id",
                        "client_id",
                        "freelancer_id",
                        "skill_id",
                        "job_id",
                        "proposal_id",
                        "assignment_id",
                        "scope_version_id",
                        "milestone_id",
                        "submitted_by",
                        "reviewed_by",
                        "created_by",
                        "accepted_by",
                        "reviewer_id",
                        "actor_user_id",
                        "entity_id",
                        "recipient_id",
                        "source_audit_id",
                        "resource_id");
        tables.values()
                .forEach(
                        t ->
                                t.rows.forEach(
                                        r ->
                                                r.replaceAll(
                                                        (key, value) ->
                                                                ids.contains(key)
                                                                                && value
                                                                                        instanceof
                                                                                        Integer n
                                                                        ? n + BASE
                                                                        : value)));
        refreshScores();
    }

    void refreshScores() {
        var scorer = new CompatibilityScorer();
        for (var score : rows("compatibility_scores")) {
            int job = ((Number) score.get("job_id")).intValue(),
                    freelancer = ((Number) score.get("freelancer_id")).intValue();
            var profile = row("freelancer_profiles", freelancer - BASE - 20);
            Map<Long, Integer> proficiency = new HashMap<>();
            rows("freelancer_skills").stream()
                    .filter(r -> ((Number) r.get("freelancer_id")).intValue() == freelancer)
                    .forEach(
                            r ->
                                    proficiency.put(
                                            ((Number) r.get("skill_id")).longValue(),
                                            (Integer) r.get("proficiency")));
            var requirements =
                    rows("job_skills").stream()
                            .filter(r -> ((Number) r.get("job_id")).intValue() == job)
                            .map(
                                    r ->
                                            new CompatibilityScorer.Requirement(
                                                    ((Number) r.get("skill_id")).longValue(),
                                                    (Integer) r.get("required_level"),
                                                    (BigDecimal) r.get("weight")))
                            .toList();
            var result =
                    scorer.score(
                            requirements,
                            proficiency,
                            (Integer) profile.get("years_experience"),
                            budget(job - BASE),
                            budget(job - BASE),
                            AvailabilityStatus.valueOf(
                                    (String) profile.get("availability_status")));
            score.put("score", result.total());
            score.put("breakdown_json", json(result));
        }
    }

    private static byte[] pdf(String text) {
        String content = "BT /F1 10 Tf 36 780 Td (" + text + ") Tj ET";
        List<String> objects =
                List.of(
                        "<< /Type /Catalog /Pages 2 0 R >>",
                        "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
                        "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
                        "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
                        "<< /Length "
                                + content.length()
                                + " >>\nstream\n"
                                + content
                                + "\nendstream");
        StringBuilder output = new StringBuilder("%PDF-1.4\n");
        List<Integer> offsets = new ArrayList<>();
        for (int i = 0; i < objects.size(); i++) {
            offsets.add(output.length());
            output.append(i + 1).append(" 0 obj\n").append(objects.get(i)).append("\nendobj\n");
        }
        int xref = output.length();
        output.append("xref\n0 6\n0000000000 65535 f \n");
        offsets.forEach(n -> output.append(String.format(Locale.ROOT, "%010d 00000 n \n", n)));
        output.append("trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n")
                .append(xref)
                .append("\n%%EOF\n");
        return output.toString().getBytes(StandardCharsets.US_ASCII);
    }

    private static String avatar(String role, int id) {
        String svg =
                "<svg xmlns='http://www.w3.org/2000/svg' width='96' height='96' viewBox='0 0 96 96'><rect width='96' height='96' rx='20' fill='#dcfce7'/><text x='48' y='57' text-anchor='middle' font-family='sans-serif' font-size='24' fill='#166534'>"
                        + role.charAt(0)
                        + id
                        + "</text></svg>";
        return "data:image/svg+xml;base64,"
                + Base64.getEncoder().encodeToString(svg.getBytes(StandardCharsets.UTF_8));
    }
}
