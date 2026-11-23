package com.linkit.demo;

import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fasterxml.jackson.databind.*;
import com.linkit.auth.dto.AuthDtos.LoginRequest;
import com.linkit.auth.service.AuthService;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.MockMvcPrint;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.env.Environment;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.*;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

@SpringBootTest(
        properties = {
            "spring.datasource.url=jdbc:sqlserver://localhost:1433;databaseName=LinkIT_V2;integratedSecurity=true;encrypt=true;trustServerCertificate=true",
            "spring.datasource.username=",
            "spring.datasource.password=",
            "linkit.seed.enabled=true",
            "debug=false",
            "spring.jpa.hibernate.ddl-auto=validate",
            "linkit.notifications.initial-delay-ms=3600000"
        })
@ActiveProfiles("demo")
@AutoConfigureMockMvc(print = MockMvcPrint.NONE)
@EnabledIfEnvironmentVariable(named = "LINKIT_SEED_TEST", matches = "true")
@Transactional
class DemoSeedIntegrationTest {
    @DynamicPropertySource
    static void credentials(DynamicPropertyRegistry p) {
        p.add("LINKIT_DEMO_PASSWORD", () -> System.getenv("LINKIT_DEMO_PASSWORD"));
        p.add("LINKIT_JWT_SECRET", () -> Base64.getEncoder().encodeToString(new byte[32]));
    }

    @Autowired DemoSeeder seeder;
    @Autowired JdbcTemplate jdbc;
    @Autowired Environment environment;
    @Autowired AuthService auth;
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    private static final int B = DemoSeedPlan.BASE;

    @Test
    void exactFixtureCountsRelationsAndSecondRunAreUnchanged() {
        DemoSeedValidator.validate(jdbc, new DemoSeedPlan());
        var before =
                jdbc.queryForList(
                        "SELECT id,row_ver,password_hash FROM dbo.users WHERE id BETWEEN 2000001 AND 2000072 ORDER BY id");
        var replay = seeder.seed();
        assertThat(replay.created()).isFalse();
        assertThat(replay.total()).isEqualTo(2934);
        var after =
                jdbc.queryForList(
                        "SELECT id,row_ver,password_hash FROM dbo.users WHERE id BETWEEN 2000001 AND 2000072 ORDER BY id");
        for (int i = 0; i < before.size(); i++) {
            assertThat(after.get(i).get("password_hash"))
                    .isEqualTo(before.get(i).get("password_hash"));
            assertThat((byte[]) after.get(i).get("row_ver"))
                    .containsExactly((byte[]) before.get(i).get("row_ver"));
        }
        assertThat(
                        jdbc.queryForObject(
                                "SELECT COUNT(*) FROM dbo.change_requests WHERE id BETWEEN 2000001 AND 2009999",
                                Integer.class))
                .isZero();
    }

    @Test
    void replayPreservesUserEditsAndUnrelatedRows() {
        jdbc.update(
                "UPDATE dbo.users SET full_name=N'Tên do người dùng cập nhật' WHERE id=?", B + 26);
        jdbc.update("UPDATE dbo.jobs SET status='CLOSED' WHERE id=?", B + 1);
        jdbc.update(
                "INSERT dbo.skills(name,category,is_active) VALUES (?,N'Outside seed',1)",
                "External skill " + UUID.randomUUID());
        String rowVersion =
                jdbc.queryForObject(
                        "SELECT CONVERT(varchar(18),row_ver,1) FROM dbo.users WHERE id=?",
                        String.class,
                        B + 26);
        assertThat(seeder.seed().created()).isFalse();
        assertThat(
                        jdbc.queryForObject(
                                "SELECT status FROM dbo.jobs WHERE id=?", String.class, B + 1))
                .isEqualTo("CLOSED");
        assertThat(
                        jdbc.queryForObject(
                                "SELECT CONVERT(varchar(18),row_ver,1) FROM dbo.users WHERE id=?",
                                String.class,
                                B + 26))
                .isEqualTo(rowVersion);
    }

    @Test
    void allFiftyDemoOpenJobsAreReachableThroughRealApiPaginationAndFilters() throws Exception {
        Set<Integer> found = new HashSet<>();
        int page = 0, pages;
        do {
            JsonNode body = getJson("/api/public/jobs?page=" + page + "&size=8", null);
            pages = body.path("totalPages").asInt();
            for (var job : body.path("content")) {
                int id = job.path("id").asInt();
                if (id > B && id <= B + 100) assertThat(found.add(id)).isTrue();
                assertThat(job.path("status").asText()).isEqualTo("OPEN");
            }
            page++;
        } while (page < pages);
        assertThat(found).hasSize(50);
        var filtered = getJson("/api/public/jobs?q=Terraform&size=100", null);
        assertThat(filtered.path("content").size()).isPositive();
        for (var job : filtered.path("content"))
            assertThat(job.path("title").asText()).containsIgnoringCase("Terraform");
    }

    @Test
    void primaryAccountsLoginAndWorkspacePrivacyIsEnforced() throws Exception {
        String freelancer = login("freelancer@demo.linkit.test"),
                client = login("client@demo.linkit.test"),
                admin = login("admin@demo.linkit.test");
        for (String token : List.of(freelancer, client, admin))
            mvc.perform(get("/api/notifications").header("Authorization", "Bearer " + token))
                    .andExpect(status().isOk());
        mvc.perform(
                        get("/api/assignments/" + (B + 1))
                                .header("Authorization", "Bearer " + freelancer))
                .andExpect(status().isOk());
        mvc.perform(
                        get("/api/assignments/" + (B + 1) + "/scopes")
                                .header("Authorization", "Bearer " + client))
                .andExpect(status().isOk());
        mvc.perform(
                        get("/api/assignments/" + (B + 2))
                                .header("Authorization", "Bearer " + freelancer))
                .andExpect(status().isNotFound());
        mvc.perform(get("/api/admin/stats").header("Authorization", "Bearer " + admin))
                .andExpect(status().isOk());
        mvc.perform(get("/api/admin/stats").header("Authorization", "Bearer " + freelancer))
                .andExpect(status().isForbidden());
    }

    @Test
    void savingWritesDatabaseAndReplayDoesNotRestoreRemovedSavedJob() throws Exception {
        String token = login("freelancer@demo.linkit.test");
        int job = B + 50;
        mvc.perform(
                        put("/api/freelancer/saved-jobs/" + job)
                                .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());
        assertThat(
                        jdbc.queryForObject(
                                "SELECT COUNT(*) FROM dbo.saved_jobs WHERE freelancer_id=? AND job_id=?",
                                Integer.class,
                                B + 26,
                                job))
                .isEqualTo(1);
        mvc.perform(
                        delete("/api/freelancer/saved-jobs/" + (B + 6))
                                .header("Authorization", "Bearer " + token))
                .andExpect(status().isNoContent());
        seeder.seed();
        assertThat(
                        jdbc.queryForObject(
                                "SELECT COUNT(*) FROM dbo.saved_jobs WHERE freelancer_id=? AND job_id=?",
                                Integer.class,
                                B + 26,
                                B + 6))
                .isZero();
    }

    @Test
    void seededWorkspaceProfileAndReviewLinksReturnRealData() throws Exception {
        String freelancer = login("freelancer@demo.linkit.test"),
                client = login("client@demo.linkit.test");
        for (String path :
                List.of(
                        "/api/freelancers/me",
                        "/api/cvs/me",
                        "/api/work-experiences/me",
                        "/api/portfolios/me",
                        "/api/proposals/me",
                        "/api/freelancer/saved-jobs")) getJson(path, freelancer);
        mvc.perform(
                        get("/api/cvs/" + (B + 6) + "/download")
                                .header("Authorization", "Bearer " + freelancer))
                .andExpect(status().isOk())
                .andExpect(content().contentType("application/pdf"));
        mvc.perform(
                        get("/api/cvs/" + (B + 7) + "/download")
                                .header("Authorization", "Bearer " + freelancer))
                .andExpect(status().isNotFound());
        for (String path :
                List.of(
                        "/api/assignments/" + (B + 1) + "/milestones",
                        "/api/milestones/" + (B + 1) + "/submissions",
                        "/api/assignments/" + (B + 31) + "/review",
                        "/api/assignments/" + (B + 31) + "/final-acceptance"))
            getJson(path, freelancer);
        var candidates = getJson("/api/jobs/" + (B + 6) + "/candidates", client);
        assertThat(candidates.path("totalElements").asInt()).isEqualTo(3);
        getJson("/api/public/clients/" + (B + 6), null);
        getJson("/api/public/freelancers/" + (B + 26), null);
    }

    @Test
    void adminDashboardTotalsMatchSqlAndInboxReadsEnforceOwnership() throws Exception {
        String admin = login("admin@demo.linkit.test"),
                freelancer = login("freelancer@demo.linkit.test");
        var stats = getJson("/api/admin/stats", admin);
        for (String[] metric :
                List.of(
                        new String[] {"totalUsers", "users"},
                        new String[] {"totalJobs", "jobs"},
                        new String[] {"totalProposals", "proposals"}))
            assertThat(stats.path(metric[0]).asLong())
                    .isEqualTo(
                            jdbc.queryForObject(
                                    "SELECT COUNT_BIG(*) FROM dbo." + metric[1], Long.class));
        int own =
                jdbc.queryForObject(
                        "SELECT TOP(1) id FROM dbo.notifications WHERE recipient_id=? AND read_at IS NULL ORDER BY id",
                        Integer.class,
                        B + 26);
        int foreign =
                jdbc.queryForObject(
                        "SELECT TOP(1) id FROM dbo.notifications WHERE recipient_id=? ORDER BY id",
                        Integer.class,
                        B + 6);
        mvc.perform(
                        patch("/api/notifications/" + own + "/read")
                                .header("Authorization", "Bearer " + freelancer))
                .andExpect(status().isOk());
        assertThat(
                        jdbc.queryForObject(
                                "SELECT read_at FROM dbo.notifications WHERE id=?",
                                java.sql.Timestamp.class,
                                own))
                .isNotNull();
        mvc.perform(
                        patch("/api/notifications/" + foreign + "/read")
                                .header("Authorization", "Bearer " + freelancer))
                .andExpect(status().isNotFound());
    }

    @Test
    void demoAccountsCanCompleteRealWorkflowWithoutCreatingChangeRequests() throws Exception {
        int before = jdbc.queryForObject("SELECT COUNT(*) FROM dbo.change_requests", Integer.class);
        String client = login("client@demo.linkit.test"),
                freelancer = login("freelancer@demo.linkit.test");
        int jobId = B + 26;
        var job = getJson("/api/jobs/" + jobId, client);
        var proposal =
                write(
                        post("/api/jobs/" + jobId + "/proposals"),
                        freelancer,
                        null,
                        Map.of(
                                "coverLetter",
                                "Đề xuất triển khai và kiểm thử sản phẩm theo phạm vi đã thống nhất.",
                                "proposedBudget",
                                job.path("budgetMax").asText(),
                                "estimatedDays",
                                30,
                                "cvId",
                                B + 6),
                        201);
        long proposalId = body(proposal).path("id").asLong();
        mvc.perform(
                        get("/api/proposals/" + proposalId + "/cv/download")
                                .header("Authorization", "Bearer " + client))
                .andExpect(status().isOk())
                .andExpect(content().contentType("application/pdf"));
        write(post("/api/jobs/" + jobId + "/matching-scores"), client, null, null, 200);
        var selected =
                write(
                        post("/api/proposals/" + proposalId + "/select"),
                        client,
                        proposal.getResponse().getHeader("ETag"),
                        null,
                        201);
        long assignmentId = body(selected).path("id").asLong();
        var scope =
                write(
                        post("/api/assignments/" + assignmentId + "/scopes"),
                        client,
                        selected.getResponse().getHeader("ETag"),
                        Map.of(
                                "acceptanceCriteria",
                                "Kiểm thử luồng chính và lỗi đạt, có tài liệu và mã nguồn bàn giao."),
                        201);
        long scopeId = body(scope).path("id").asLong();
        var submittedScope =
                write(
                        post("/api/scopes/" + scopeId + "/submit"),
                        client,
                        scope.getResponse().getHeader("ETag"),
                        null,
                        200);
        var locked =
                write(
                        post("/api/scopes/" + scopeId + "/approve"),
                        freelancer,
                        submittedScope.getResponse().getHeader("ETag"),
                        null,
                        200);
        assertThat(body(locked).path("status").asText()).isEqualTo("LOCKED");
        var milestone =
                write(
                        post("/api/assignments/" + assignmentId + "/milestones"),
                        client,
                        null,
                        Map.of(
                                "title",
                                "Bàn giao sản phẩm demo",
                                "description",
                                "Hoàn thành và kiểm thử sản phẩm trong phạm vi đã duyệt.",
                                "acceptanceCriteria",
                                "Đạt kiểm thử và có tài liệu vận hành.",
                                "dueDate",
                                job.path("deadline").asText(),
                                "amount",
                                job.path("budgetMax").asText(),
                                "isRequired",
                                true,
                                "sortOrder",
                                1),
                        201);
        long milestoneId = body(milestone).path("id").asLong();
        var submission =
                write(
                        post("/api/milestones/" + milestoneId + "/submissions"),
                        freelancer,
                        milestone.getResponse().getHeader("ETag"),
                        Map.of(
                                "submissionNote",
                                "Đã bàn giao mã nguồn, hướng dẫn và kết quả kiểm thử."),
                        201);
        write(
                post("/api/submissions/" + body(submission).path("id").asLong() + "/approve"),
                client,
                submission.getResponse().getHeader("ETag"),
                Map.of("reviewNote", "Đối chiếu tiêu chí, kết quả đạt."),
                200);
        var acceptance =
                mvc.perform(
                                get("/api/assignments/" + assignmentId + "/final-acceptance")
                                        .header("Authorization", "Bearer " + client))
                        .andExpect(status().isOk())
                        .andReturn();
        write(
                post("/api/assignments/" + assignmentId + "/final-acceptance"),
                client,
                acceptance.getResponse().getHeader("ETag"),
                Map.of("acceptanceNote", "Đã kiểm tra phạm vi và mốc bắt buộc."),
                201);
        write(
                post("/api/assignments/" + assignmentId + "/review"),
                client,
                null,
                Map.of(
                        "overallRating",
                        5,
                        "qualityRating",
                        5,
                        "communicationRating",
                        5,
                        "timelinessRating",
                        5,
                        "comment",
                        "Bàn giao đúng phạm vi và tài liệu rõ ràng."),
                201);
        assertThat(
                        jdbc.queryForObject(
                                "SELECT status FROM dbo.jobs WHERE id=?", String.class, jobId))
                .isEqualTo("COMPLETED");
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM dbo.change_requests", Integer.class))
                .isEqualTo(before);
    }

    private MvcResult write(
            MockHttpServletRequestBuilder request,
            String token,
            String etag,
            Object input,
            int expected)
            throws Exception {
        request.header("Authorization", "Bearer " + token);
        if (etag != null) request.header("If-Match", etag);
        if (input != null)
            request.contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsBytes(input));
        return mvc.perform(request).andExpect(status().is(expected)).andReturn();
    }

    private JsonNode body(MvcResult result) throws Exception {
        return json.readTree(result.getResponse().getContentAsString());
    }

    private String login(String email) {
        return auth.login(
                        new LoginRequest(
                                email, environment.getRequiredProperty("LINKIT_DEMO_PASSWORD")))
                .accessToken();
    }

    private JsonNode getJson(String url, String token) throws Exception {
        var request = get(url);
        if (token != null) request.header("Authorization", "Bearer " + token);
        return json.readTree(
                mvc.perform(request)
                        .andExpect(status().isOk())
                        .andReturn()
                        .getResponse()
                        .getContentAsString());
    }
}
