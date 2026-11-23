package com.linkit.demo;

import org.springframework.jdbc.core.JdbcTemplate;

import java.util.*;

final class DemoSeedValidator {
    private DemoSeedValidator() {}

    static Map<String, Integer> counts(JdbcTemplate jdbc, DemoSeedPlan plan) {
        Map<String, Integer> counts = new LinkedHashMap<>();
        plan.tables
                .values()
                .forEach(
                        t ->
                                counts.put(
                                        t.name(),
                                        jdbc.queryForObject(
                                                "SELECT COUNT(*) FROM dbo."
                                                        + t.name()
                                                        + " WHERE "
                                                        + predicate(t),
                                                Integer.class)));
        return Collections.unmodifiableMap(counts);
    }

    static String predicate(DemoSeedPlan.Table table) {
        if (table.name().equals("skills"))
            return "name IN ("
                    + String.join(
                            ",",
                            table.rows().stream()
                                    .map(
                                            r ->
                                                    "N'"
                                                            + r.get("name")
                                                                    .toString()
                                                                    .replace("'", "''")
                                                            + "'")
                                    .toList())
                    + ")";
        String key = table.identity() ? "id" : table.key().getFirst();
        int start = DemoSeedPlan.BASE + 1, end = DemoSeedPlan.BASE + table.target();
        switch (table.name()) {
            case "user_roles" -> end = DemoSeedPlan.BASE + 72;
            case "client_profiles" -> end = DemoSeedPlan.BASE + 20;
            case "freelancer_profiles", "freelancer_skills" -> {
                start = DemoSeedPlan.BASE + 21;
                end = DemoSeedPlan.BASE + 70;
            }
            case "job_skills" -> end = DemoSeedPlan.BASE + 100;
            case "notification_delivery_receipts" -> end = DemoSeedPlan.BASE + 300;
            default -> {}
        }
        return key + " BETWEEN " + start + " AND " + end;
    }

    private static String scoped(String sql, DemoSeedPlan plan) {
        for (var t : plan.tables.values())
            sql =
                    sql.replaceAll(
                            "dbo\\." + t.name() + "\\b",
                            java.util.regex.Matcher.quoteReplacement(
                                    "(SELECT * FROM dbo."
                                            + t.name()
                                            + " WHERE "
                                            + predicate(t)
                                            + ")"));
        return sql;
    }

    static void validate(JdbcTemplate jdbc, DemoSeedPlan plan) {
        var actual = counts(jdbc, plan);
        for (var t : plan.tables.values())
            if (!Objects.equals(actual.get(t.name()), t.target()))
                throw new IllegalStateException(
                        "Count mismatch: "
                                + t.name()
                                + " expected "
                                + t.target()
                                + " actual "
                                + actual.get(t.name()));
        distribution(
                jdbc,
                plan,
                "jobs",
                "status",
                Map.of("OPEN", 50, "CLOSED", 15, "IN_PROGRESS", 20, "COMPLETED", 15));
        distribution(jdbc, plan, "assignments", "status", Map.of("ACTIVE", 20, "COMPLETED", 15));
        distribution(
                jdbc,
                plan,
                "user_roles",
                "role",
                Map.of("CLIENT", 20, "FREELANCER", 50, "ADMIN", 2));
        zero(
                jdbc,
                plan,
                "open deadlines",
                "SELECT COUNT(*) FROM dbo.jobs j WHERE j.status='OPEN' AND (j.deadline<'"
                        + plan.reference
                        + "' OR j.published_at IS NULL OR j.published_at<j.created_at)");
        zero(
                jdbc,
                plan,
                "job skills and quality",
                "SELECT COUNT(*) FROM dbo.jobs j WHERE (SELECT COUNT(*) FROM dbo.job_skills s WHERE s.job_id=j.id)<>3 OR NOT EXISTS (SELECT 1 FROM dbo.job_quality_assessments q WHERE q.job_id=j.id AND q.score>=80)");
        zero(
                jdbc,
                plan,
                "selection ownership and status",
                "SELECT COUNT(*) FROM dbo.assignments a JOIN dbo.jobs j ON j.id=a.job_id JOIN dbo.proposals p ON p.id=a.proposal_id WHERE p.job_id<>a.job_id OR p.freelancer_id<>a.freelancer_id OR p.status<>'ACCEPTED' OR a.client_id<>j.client_id OR j.status<>CASE WHEN a.status='COMPLETED' THEN 'COMPLETED' ELSE 'IN_PROGRESS' END OR a.started_at<a.created_at");
        zero(
                jdbc,
                plan,
                "one selected freelancer",
                "SELECT COUNT(*) FROM dbo.proposals p WHERE (p.status='ACCEPTED' AND (SELECT COUNT(*) FROM dbo.assignments a WHERE a.proposal_id=p.id)<>1) OR (p.status='PENDING' AND EXISTS (SELECT 1 FROM dbo.assignments a WHERE a.job_id=p.job_id))");
        zero(
                jdbc,
                plan,
                "proposal dates",
                "SELECT COUNT(*) FROM dbo.proposals p JOIN dbo.jobs j ON j.id=p.job_id WHERE p.submitted_at<j.published_at OR p.updated_at<p.submitted_at");
        zero(
                jdbc,
                plan,
                "scope approval parties",
                "SELECT COUNT(*) FROM dbo.scope_approvals p JOIN dbo.scope_versions s ON s.id=p.scope_version_id JOIN dbo.assignments a ON a.id=s.assignment_id WHERE p.user_id<>CASE WHEN p.party_role='CLIENT' THEN a.client_id ELSE a.freelancer_id END OR p.approved_at<s.created_at OR p.approved_at>s.locked_at");
        zero(
                jdbc,
                plan,
                "scope lock and budget",
                "SELECT COUNT(*) FROM dbo.assignments a WHERE (SELECT COUNT(*) FROM dbo.scope_versions s WHERE s.assignment_id=a.id AND s.status='LOCKED' AND s.budget=a.agreed_budget AND s.locked_at<=a.started_at AND (SELECT COUNT(*) FROM dbo.scope_approvals p WHERE p.scope_version_id=s.id)=2)<>1");
        zero(
                jdbc,
                plan,
                "milestone ownership and allocation",
                "SELECT COUNT(*) FROM dbo.scope_versions s WHERE s.budget<>(SELECT COALESCE(SUM(m.amount),0) FROM dbo.milestones m WHERE m.scope_version_id=s.id AND m.assignment_id=s.assignment_id) OR EXISTS (SELECT 1 FROM dbo.milestones m WHERE m.scope_version_id=s.id AND (m.assignment_id<>s.assignment_id OR m.created_at<s.locked_at OR m.due_date>s.deadline))");
        zero(
                jdbc,
                plan,
                "submission parties and chronology",
                "SELECT COUNT(*) FROM dbo.milestone_submissions s JOIN dbo.milestones m ON m.id=s.milestone_id JOIN dbo.assignments a ON a.id=m.assignment_id WHERE s.submitted_by<>a.freelancer_id OR s.submitted_at<m.created_at OR (s.status<>'SUBMITTED' AND (s.reviewed_by IS NULL OR s.reviewed_by<>a.client_id OR s.reviewed_at IS NULL OR s.reviewed_at<s.submitted_at)) OR (s.status='SUBMITTED' AND (s.reviewed_by IS NOT NULL OR s.reviewed_at IS NOT NULL))");
        zero(
                jdbc,
                plan,
                "latest submission status",
                "SELECT COUNT(*) FROM dbo.milestones m OUTER APPLY (SELECT TOP (1) s.status,s.reviewed_at FROM dbo.milestone_submissions s WHERE s.milestone_id=m.id ORDER BY s.submission_number DESC) s WHERE m.status IN ('APPROVED','SUBMITTED','REVISION_REQUIRED') AND (s.status IS NULL OR s.status<>m.status OR (m.status='APPROVED' AND (m.approved_at IS NULL OR m.approved_at<>s.reviewed_at)))");
        zero(
                jdbc,
                plan,
                "final acceptance eligibility",
                "SELECT COUNT(*) FROM dbo.final_acceptances f JOIN dbo.assignments a ON a.id=f.assignment_id JOIN dbo.scope_versions s ON s.id=f.scope_version_id WHERE a.status<>'COMPLETED' OR f.accepted_by<>a.client_id OR s.assignment_id<>a.id OR s.status<>'LOCKED' OR f.accepted_at<>a.completed_at OR EXISTS (SELECT 1 FROM dbo.milestones m WHERE m.assignment_id=a.id AND (m.status<>'APPROVED' OR m.approved_at>f.accepted_at))");
        zero(
                jdbc,
                plan,
                "reviews after acceptance",
                "SELECT COUNT(*) FROM dbo.reviews r JOIN dbo.assignments a ON a.id=r.assignment_id JOIN dbo.final_acceptances f ON f.assignment_id=a.id WHERE r.reviewer_id<>a.client_id OR r.freelancer_id<>a.freelancer_id OR r.created_at<f.accepted_at OR a.status<>'COMPLETED'");
        zero(
                jdbc,
                plan,
                "risk milestone ownership",
                "SELECT COUNT(*) FROM dbo.risk_alerts r JOIN dbo.milestones m ON m.id=r.milestone_id WHERE m.assignment_id<>r.assignment_id");
        zero(
                jdbc,
                plan,
                "saved jobs owned by freelancers",
                "SELECT COUNT(*) FROM dbo.saved_jobs s WHERE NOT EXISTS (SELECT 1 FROM dbo.freelancer_profiles f WHERE f.user_id=s.freelancer_id) OR NOT EXISTS (SELECT 1 FROM dbo.jobs j WHERE j.id=s.job_id AND j.status='OPEN')");
        zero(
                jdbc,
                plan,
                "proposal notification ownership",
                "SELECT COUNT(*) FROM dbo.notifications n JOIN dbo.proposals p ON p.id=n.resource_id JOIN dbo.jobs j ON j.id=p.job_id WHERE n.resource_type IN ('JOB_PROPOSAL','PROPOSAL') AND (n.job_id<>p.job_id OR n.recipient_id<>CASE n.resource_type WHEN 'JOB_PROPOSAL' THEN j.client_id ELSE p.freelancer_id END)");
        zero(
                jdbc,
                plan,
                "notification audit and receipt",
                "SELECT COUNT(*) FROM dbo.notifications n WHERE NOT EXISTS (SELECT 1 FROM dbo.audit_logs a WHERE a.id=n.source_audit_id) OR NOT EXISTS (SELECT 1 FROM dbo.notification_delivery_receipts r WHERE r.source_audit_id=n.source_audit_id)");
        zero(
                jdbc,
                plan,
                "no change request events",
                "SELECT COUNT(*) FROM dbo.audit_logs a WHERE a.entity_type LIKE 'change%' OR a.action LIKE 'CHANGE%'");
    }

    private static void distribution(
            JdbcTemplate jdbc,
            DemoSeedPlan plan,
            String table,
            String field,
            Map<String, Integer> counts) {
        var actual =
                jdbc.queryForList(
                        scoped(
                                "SELECT "
                                        + field
                                        + " AS label,COUNT(*) AS amount FROM dbo."
                                        + table
                                        + " fixture GROUP BY "
                                        + field,
                                plan));
        if (actual.size() != counts.size()
                || actual.stream()
                        .anyMatch(
                                r ->
                                        !counts.containsKey(r.get("label"))
                                                || ((Number) r.get("amount")).intValue()
                                                        != counts.get(r.get("label"))))
            throw new IllegalStateException("Distribution mismatch: " + table);
    }

    private static void zero(JdbcTemplate jdbc, DemoSeedPlan plan, String rule, String sql) {
        Long count = jdbc.queryForObject(scoped(sql, plan), Long.class);
        if (count == null || count != 0)
            throw new IllegalStateException("Demo seed invariant failed: " + rule);
    }
}
