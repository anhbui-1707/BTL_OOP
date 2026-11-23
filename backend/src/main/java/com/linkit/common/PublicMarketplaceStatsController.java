package com.linkit.common;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
public class PublicMarketplaceStatsController {
    private final JdbcTemplate jdbc;

    public PublicMarketplaceStatsController(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public record Stats(
            long freelancers,
            long jobs,
            long completedJobs,
            long activeClients,
            Map<String, Long> categories) {}

    private long count(String sql, Object... params) {
        Long result = jdbc.queryForObject(sql, Long.class, params);
        return result == null ? 0 : result;
    }

    @GetMapping("/api/public/marketplace-stats")
    public Stats stats() {
        long freelancers =
                count(
                        "SELECT COUNT_BIG(*) FROM dbo.freelancer_profiles f JOIN dbo.users u ON u.id=f.user_id WHERE u.status='ACTIVE'");
        long jobs = count("SELECT COUNT_BIG(*) FROM dbo.jobs WHERE published_at IS NOT NULL");
        long completed = count("SELECT COUNT_BIG(*) FROM dbo.assignments WHERE status='COMPLETED'");
        long clients =
                count(
                        "SELECT COUNT_BIG(DISTINCT cp.user_id) FROM dbo.client_profiles cp JOIN dbo.users u ON u.id=cp.user_id WHERE u.status='ACTIVE'");
        Map<String, List<String>> keywords = new LinkedHashMap<>();
        keywords.put(
                "Web Development",
                List.of(
                        "web",
                        "frontend",
                        "front-end",
                        "backend",
                        "back-end",
                        "fullstack",
                        "full-stack",
                        "react",
                        "angular",
                        "vue",
                        "javascript",
                        "typescript",
                        "spring",
                        "php"));
        keywords.put(
                "Mobile App",
                List.of("mobile", "android", "ios", "flutter", "swift", "kotlin", "react native"));
        keywords.put(
                "UI/UX Design",
                List.of("ui/ux", "ui ux", "figma", "designer", "design", "thiết kế giao diện"));
        keywords.put(
                "Data & AI",
                List.of(
                        "data",
                        "machine learning",
                        "deep learning",
                        "python",
                        "artificial intelligence",
                        "trí tuệ nhân tạo",
                        "sql",
                        "power bi"));
        keywords.put(
                "Cloud & DevOps",
                List.of("cloud", "devops", "docker", "kubernetes", "aws", "azure", "gcp", "ci/cd"));
        keywords.put(
                "Cyber Security",
                List.of("security", "cyber", "bảo mật", "pentest", "an ninh mạng", "owasp"));
        Map<String, Long> categories = new LinkedHashMap<>();
        for (var entry : keywords.entrySet()) {
            StringBuilder jobWhere = new StringBuilder();
            StringBuilder freelancerWhere = new StringBuilder();
            java.util.ArrayList<Object> jobArgs = new java.util.ArrayList<>();
            java.util.ArrayList<Object> freelancerArgs = new java.util.ArrayList<>();
            for (String keyword : entry.getValue()) {
                if (jobWhere.length() > 0) {
                    jobWhere.append(" OR ");
                    freelancerWhere.append(" OR ");
                }
                jobWhere.append(
                        "(LOWER(j.title) LIKE ? OR EXISTS (SELECT 1 FROM dbo.job_skills js JOIN dbo.skills s ON s.id=js.skill_id WHERE js.job_id=j.id AND LOWER(s.name) LIKE ?))");
                freelancerWhere.append(
                        "(LOWER(COALESCE(f.headline,'')) LIKE ? OR EXISTS (SELECT 1 FROM dbo.freelancer_skills fs JOIN dbo.skills s ON s.id=fs.skill_id WHERE fs.freelancer_id=f.user_id AND LOWER(s.name) LIKE ?))");
                String pattern = "%" + keyword + "%";
                jobArgs.add(pattern);
                jobArgs.add(pattern);
                freelancerArgs.add(pattern);
                freelancerArgs.add(pattern);
            }
            long jobCount =
                    count(
                            "SELECT COUNT_BIG(*) FROM dbo.jobs j WHERE j.published_at IS NOT NULL AND ("
                                    + jobWhere
                                    + ")",
                            jobArgs.toArray());
            long freelancerCount =
                    count(
                            "SELECT COUNT_BIG(*) FROM dbo.freelancer_profiles f JOIN dbo.users u ON u.id=f.user_id WHERE u.status='ACTIVE' AND ("
                                    + freelancerWhere
                                    + ")",
                            freelancerArgs.toArray());
            categories.put(entry.getKey(), jobCount + freelancerCount);
        }
        return new Stats(freelancers, jobs, completed, clients, categories);
    }
}
