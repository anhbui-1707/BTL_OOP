package com.linkit.projects;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fasterxml.jackson.databind.*;
import com.linkit.audit.entity.AuditLog;
import com.linkit.audit.repository.AuditLogRepository;
import com.linkit.auth.dto.AuthDtos.*;
import com.linkit.auth.security.AuthPrincipal;
import com.linkit.auth.service.AuthService;
import com.linkit.identity.entity.UserRole.Role;
import com.linkit.jobs.dto.JobDtos;
import com.linkit.jobs.entity.Job;
import com.linkit.jobs.service.JobService;
import com.linkit.proposals.entity.Proposal;

import jakarta.persistence.EntityManagerFactory;
import jakarta.persistence.Table;

import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.*;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.*;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.*;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.security.MessageDigest;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;

@SpringBootTest(
        properties = {
            "spring.datasource.url=jdbc:sqlserver://localhost:1433;databaseName=LinkIT_V2;integratedSecurity=true;encrypt=true;trustServerCertificate=true",
            "spring.datasource.username=",
            "spring.datasource.password=",
            "spring.jpa.hibernate.ddl-auto=validate",
            "linkit.seed.enabled=false",
            "debug=false"
        })
@AutoConfigureMockMvc(print = MockMvcPrint.NONE)
@EnabledIfEnvironmentVariable(named = "LINKIT_MILESTONE_TEST", matches = "true")
class MilestoneIntegrationTest {
    private static final String KEY;

    static {
        byte[] bytes = new byte[32];
        new java.security.SecureRandom().nextBytes(bytes);
        KEY = Base64.getEncoder().encodeToString(bytes);
    }

    @DynamicPropertySource
    static void jwt(DynamicPropertyRegistry properties) {
        properties.add("LINKIT_JWT_SECRET", () -> KEY);
    }

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired AuthService auth;
    @Autowired JobService jobs;
    @Autowired JdbcTemplate jdbc;
    @Autowired PlatformTransactionManager transactions;
    @Autowired EntityManagerFactory emf;
    @MockitoSpyBean AuditLogRepository audit;
    @MockitoSpyBean com.linkit.projects.repository.AssignmentRepository assignmentRepo;
    private final List<Long> users = new ArrayList<>();
    private final String marker = "milestone-it-" + UUID.randomUUID();
    private TokenResponse client, otherClient, freelancer, otherFreelancer;
    private Map<String, String> seedBefore;

    @BeforeEach
    void setup() throws Exception {
        seedBefore = fingerprint();
        client = account(Role.CLIENT);
        otherClient = account(Role.CLIENT);
        freelancer = account(Role.FREELANCER);
        otherFreelancer = account(Role.FREELANCER);
    }

    private TokenResponse account(Role role) {
        var value =
                auth.register(
                        new RegisterRequest(
                                marker + "-" + users.size() + "@example.invalid",
                                "Test-" + UUID.randomUUID(),
                                "Proposal API test",
                                role));
        users.add(value.user().id());
        return value;
    }

    @AfterEach
    void cleanup() throws Exception {
        if (!users.isEmpty())
            new TransactionTemplate(transactions)
                    .executeWithoutResult(
                            status -> {
                                String ids =
                                        String.join(",", Collections.nCopies(users.size(), "?"));
                                Object[] values = users.toArray();
                                String owned =
                                        "SELECT id FROM dbo.jobs WHERE client_id IN (" + ids + ")";
                                jdbc.update(
                                        "DELETE FROM dbo.compatibility_scores WHERE job_id IN ("
                                                + owned
                                                + ")",
                                        values);
                                String project =
                                        "SELECT id FROM dbo.assignments WHERE job_id IN ("
                                                + owned
                                                + ")";
                                String versions =
                                        "SELECT id FROM dbo.scope_versions WHERE assignment_id IN ("
                                                + project
                                                + ")";
                                String tasks =
                                        "SELECT id FROM dbo.milestones WHERE assignment_id IN ("
                                                + project
                                                + ")";
                                jdbc.update(
                                        "DELETE FROM dbo.milestone_submissions WHERE milestone_id IN ("
                                                + tasks
                                                + ")",
                                        values);
                                jdbc.update(
                                        "DELETE FROM dbo.milestones WHERE assignment_id IN ("
                                                + project
                                                + ")",
                                        values);
                                jdbc.update(
                                        "DELETE FROM dbo.scope_approvals WHERE scope_version_id IN ("
                                                + versions
                                                + ")",
                                        values);
                                jdbc.update(
                                        "DELETE FROM dbo.scope_versions WHERE assignment_id IN ("
                                                + project
                                                + ")",
                                        values);
                                jdbc.update(
                                        "DELETE FROM dbo.assignments WHERE job_id IN ("
                                                + owned
                                                + ")",
                                        values);
                                jdbc.update(
                                        "DELETE FROM dbo.proposals WHERE job_id IN (" + owned + ")",
                                        values);
                                jdbc.update(
                                        "DELETE FROM dbo.job_quality_assessments WHERE job_id IN ("
                                                + owned
                                                + ")",
                                        values);
                                jdbc.update(
                                        "DELETE FROM dbo.job_skills WHERE job_id IN ("
                                                + owned
                                                + ")",
                                        values);
                                jdbc.update(
                                        "DELETE FROM dbo.jobs WHERE client_id IN (" + ids + ")",
                                        values);
                                jdbc.update(
                                        "DELETE FROM dbo.audit_logs WHERE actor_user_id IN ("
                                                + ids
                                                + ")",
                                        values);
                                jdbc.update(
                                        "DELETE FROM dbo.refresh_tokens WHERE user_id IN ("
                                                + ids
                                                + ")",
                                        values);
                                jdbc.update(
                                        "DELETE FROM dbo.client_profiles WHERE user_id IN ("
                                                + ids
                                                + ")",
                                        values);
                                jdbc.update(
                                        "DELETE FROM dbo.freelancer_skills WHERE freelancer_id IN ("
                                                + ids
                                                + ")",
                                        values);
                                jdbc.update(
                                        "DELETE FROM dbo.freelancer_profiles WHERE user_id IN ("
                                                + ids
                                                + ")",
                                        values);
                                jdbc.update(
                                        "DELETE FROM dbo.user_roles WHERE user_id IN (" + ids + ")",
                                        values);
                                jdbc.update(
                                        "DELETE FROM dbo.users WHERE id IN (" + ids + ")", values);
                            });
        assertThat(fingerprint())
                .as("All 23 seed tables must remain byte-for-byte equivalent")
                .isEqualTo(seedBefore);
    }

    private Map<String, String> fingerprint() throws Exception {
        Map<String, String> result = new TreeMap<>();
        for (var type : emf.getMetamodel().getEntities()) {
            String table = type.getJavaType().getAnnotation(Table.class).name();
            byte[] bytes =
                    json.writeValueAsBytes(
                            jdbc.queryForList("SELECT * FROM dbo." + table + " ORDER BY 1,2"));
            result.put(
                    table,
                    Base64.getEncoder()
                            .encodeToString(MessageDigest.getInstance("SHA-256").digest(bytes)));
        }
        return result;
    }

    private JobDtos.Detail job(TokenResponse owner, boolean publish) {
        var request =
                new JobDtos.WriteRequest(
                        marker,
                        "Xây dựng ứng dụng cho doanh nghiệp. ".repeat(6),
                        "Mã nguồn và tài liệu bàn giao đầy đủ. ".repeat(3),
                        "Kiểm thử đạt và được xác nhận trước khi bàn giao. ".repeat(3),
                        new BigDecimal("100.00"),
                        new BigDecimal("20000000.00"),
                        "VND",
                        LocalDate.now(ZoneOffset.UTC).plusDays(60),
                        List.of(new JobDtos.SkillInput(1L, true)));
        var actor = new AuthPrincipal(owner.user().id(), owner.user().roles());
        var created = jobs.create(actor, request);
        return publish
                ? jobs.publish(actor, created.id(), "\"" + created.version() + "\"")
                : created;
    }

    private Map<String, Object> body() {
        return new LinkedHashMap<>(
                Map.of(
                        "coverLetter",
                        "Tôi có kinh nghiệm phát triển React và kiểm thử; đề xuất cập nhật tiến độ hằng tuần.",
                        "proposedBudget",
                        new BigDecimal("1234567.89"),
                        "estimatedDays",
                        21));
    }

    private MockHttpServletRequestBuilder request(
            MockHttpServletRequestBuilder request,
            TokenResponse actor,
            Map<String, Object> body,
            String etag)
            throws Exception {
        if (actor != null) request.header("Authorization", "Bearer " + actor.accessToken());
        if (body != null)
            request.contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsBytes(body));
        if (etag != null) request.header("If-Match", etag);
        return request;
    }

    private MvcResult call(
            MockHttpServletRequestBuilder request,
            TokenResponse actor,
            Map<String, Object> body,
            String etag,
            int expected)
            throws Exception {
        return mvc.perform(request(request, actor, body, etag))
                .andExpect(status().is(expected))
                .andReturn();
    }

    private JsonNode node(MvcResult result) throws Exception {
        return json.readTree(result.getResponse().getContentAsByteArray());
    }

    private long id(MvcResult result) throws Exception {
        return node(result).path("id").asLong();
    }

    private String etag(MvcResult result) {
        return result.getResponse().getHeader("ETag");
    }

    private MvcResult submit(Long jobId, TokenResponse actor) throws Exception {
        return call(post("/api/jobs/" + jobId + "/proposals"), actor, body(), null, 201);
    }

    private MvcResult detail(long id, TokenResponse actor) throws Exception {
        return call(get("/api/proposals/" + id), actor, null, null, 200);
    }

    private MvcResult reject(MvcResult proposal, TokenResponse actor, int expected)
            throws Exception {
        return call(
                patch("/api/proposals/" + id(proposal) + "/status"),
                actor,
                Map.of("status", "REJECTED"),
                etag(proposal),
                expected);
    }

    private MvcResult select(MvcResult proposal, TokenResponse actor, int expected)
            throws Exception {
        return call(
                post("/api/proposals/" + id(proposal) + "/select"),
                actor,
                null,
                etag(proposal),
                expected);
    }

    private void availability(TokenResponse user, String status) {
        jdbc.update(
                "UPDATE dbo.freelancer_profiles SET availability_status=? WHERE user_id=?",
                status,
                user.user().id());
    }

    private void experienced(TokenResponse user) {
        jdbc.update(
                "UPDATE dbo.freelancer_profiles SET years_experience=5 WHERE user_id=?",
                user.user().id());
        jdbc.update(
                "INSERT dbo.freelancer_skills(freelancer_id,skill_id,proficiency,years_experience) VALUES (?,1,5,5)",
                user.user().id());
    }

    private MvcResult assignment() throws Exception {
        var job = job(client, true);
        return select(submit(job.id(), freelancer), client, 201);
    }

    private MvcResult create(
            MvcResult a, TokenResponse actor, Map<String, Object> content, int expected)
            throws Exception {
        return call(
                post("/api/assignments/" + id(a) + "/scopes"), actor, content, etag(a), expected);
    }

    private MvcResult scopeGet(long scope, TokenResponse actor) throws Exception {
        return call(get("/api/scopes/" + scope), actor, null, null, 200);
    }

    private MvcResult send(MvcResult s, TokenResponse actor, int expected) throws Exception {
        return call(post("/api/scopes/" + id(s) + "/submit"), actor, null, etag(s), expected);
    }

    private MvcResult approve(MvcResult s, TokenResponse actor, int expected) throws Exception {
        return call(post("/api/scopes/" + id(s) + "/approve"), actor, null, etag(s), expected);
    }

    private MvcResult assignmentGet(long id) throws Exception {
        return call(get("/api/assignments/" + id), client, null, null, 200);
    }

    private MvcResult active() throws Exception {
        var a = assignment();
        approve(
                approve(
                        send(create(a, client, Map.of("budget", 1000), 201), client, 200),
                        client,
                        200),
                freelancer,
                200);
        return assignmentGet(id(a));
    }

    private Map<String, Object> taskBody(String amount, int order) {
        return new LinkedHashMap<>(
                Map.of(
                        "title",
                        "Develop freelancer portfolio",
                        "description",
                        "Implement the agreed portfolio and tests",
                        "acceptanceCriteria",
                        "Acceptance tests pass and source code is delivered",
                        "dueDate",
                        LocalDate.now(ZoneOffset.UTC).plusDays(30).toString(),
                        "amount",
                        new BigDecimal(amount),
                        "isRequired",
                        true,
                        "sortOrder",
                        order));
    }

    private MvcResult task(MvcResult a, String amount, int order) throws Exception {
        return call(
                post("/api/assignments/" + id(a) + "/milestones"),
                client,
                taskBody(amount, order),
                null,
                201);
    }

    private MvcResult taskGet(long id) throws Exception {
        return call(get("/api/milestones/" + id), client, null, null, 200);
    }

    private MvcResult deliver(MvcResult m, TokenResponse actor, int expected) throws Exception {
        return call(
                post("/api/milestones/" + id(m) + "/submissions"),
                actor,
                Map.of(
                        "submissionNote",
                        "Source code, test report and delivery notes",
                        "evidenceUrl",
                        "https://example.com/deliverable"),
                etag(m),
                expected);
    }

    private MvcResult accept(MvcResult s, int expected) throws Exception {
        return call(
                post("/api/submissions/" + id(s) + "/approve"), client, null, etag(s), expected);
    }

    private MvcResult revise(MvcResult s, int expected) throws Exception {
        return call(
                post("/api/submissions/" + id(s) + "/request-revision"),
                client,
                Map.of("reviewNote", "Please add the missing acceptance tests"),
                etag(s),
                expected);
    }

    private MvcResult update(MvcResult m, String amount, int order, int expected) throws Exception {
        return call(
                put("/api/milestones/" + id(m)),
                client,
                taskBody(amount, order),
                etag(m),
                expected);
    }

    private MvcResult cancel(MvcResult m, int expected) throws Exception {
        return call(delete("/api/milestones/" + id(m)), client, null, etag(m), expected);
    }

    private long scalar(String sql, Long id) {
        return jdbc.queryForObject(sql, Long.class, id);
    }

    private String taskStatus(long id) {
        return jdbc.queryForObject(
                "SELECT status FROM dbo.milestones WHERE id=?", String.class, id);
    }

    @Test
    void crudBudgetPaginationSoftCancelAndNoRequiredSequence() throws Exception {
        var a = active();
        var first = task(a, "600", 2);
        var second = task(a, "400", 1);
        var page =
                node(
                        call(
                                get("/api/assignments/" + id(a) + "/milestones").param("size", "1"),
                                freelancer,
                                null,
                                null,
                                200));
        assertThat(page.path("totalElements").asInt()).isEqualTo(2);
        assertThat(page.path("content").get(0).path("id").asLong()).isEqualTo(id(second));
        var unchanged = update(first, "600", 2, 200);
        assertThat(etag(unchanged)).isNotEqualTo(etag(first));
        update(first, "500", 2, 409);
        update(unchanged, "600.01", 2, 422);
        var smaller = update(unchanged, "500", 2, 200);
        cancel(smaller, 204);
        assertThat(taskStatus(id(first))).isEqualTo("CANCELLED");
        var remaining = task(a, "600", 2);
        assertThat(node(remaining).path("status").asText()).isEqualTo("PLANNED");

        accept(deliver(remaining, freelancer, 201), 200);
        assertThat(taskStatus(id(second))).isEqualTo("PLANNED");
        assertThat(node(assignmentGet(id(a))).path("status").asText()).isEqualTo("ACTIVE");
    }

    @Test
    void submitRevisionResubmitAcceptKeepsHistoryAndParties() throws Exception {
        var a = active();
        var m = task(a, "1000", 1);
        var first = deliver(m, freelancer, 201);
        assertThat(node(first).path("submissionNumber").asInt()).isEqualTo(1);
        assertThat(node(first).path("submittedBy").asLong()).isEqualTo(freelancer.user().id());
        assertThat(taskStatus(id(m))).isEqualTo("SUBMITTED");
        deliver(taskGet(id(m)), freelancer, 409);
        var revision = revise(first, 200);
        assertThat(taskStatus(id(m))).isEqualTo("REVISION_REQUIRED");
        assertThat(node(revision).path("reviewedBy").asLong()).isEqualTo(client.user().id());
        var second = deliver(taskGet(id(m)), freelancer, 201);
        assertThat(node(second).path("submissionNumber").asInt()).isEqualTo(2);
        var approved = accept(second, 200);
        assertThat(taskStatus(id(m))).isEqualTo("APPROVED");
        assertThat(node(approved).path("status").asText()).isEqualTo("APPROVED");
        var page =
                node(
                        call(
                                get("/api/milestones/" + id(m) + "/submissions"),
                                freelancer,
                                null,
                                null,
                                200));
        assertThat(page.path("totalElements").asInt()).isEqualTo(2);
        assertThat(page.path("content").get(1).path("status").asText())
                .isEqualTo("REVISION_REQUIRED");
        assertThat(page.path("content").get(1).path("reviewNote").asText())
                .contains("acceptance tests");
        assertThat(node(taskGet(id(m))).path("approvedAt").asText())
                .isEqualTo(node(approved).path("reviewedAt").asText());
        accept(approved, 409);
        revise(approved, 409);
        update(taskGet(id(m)), "900", 1, 409);
        cancel(taskGet(id(m)), 409);
        deliver(taskGet(id(m)), freelancer, 409);
        assertThat(node(assignmentGet(id(a))).path("status").asText()).isEqualTo("ACTIVE");
        assertThat(
                        scalar(
                                "SELECT COUNT(*) FROM dbo.final_acceptances WHERE assignment_id=?",
                                id(a)))
                .isZero();
    }

    @Test
    void rbacOwnershipAndMissingJwt() throws Exception {
        var a = active();
        var m = task(a, "500", 1);
        call(get("/api/milestones/" + id(m)), null, null, null, 401);
        call(get("/api/milestones/" + id(m)), otherClient, null, null, 404);
        call(get("/api/milestones/" + id(m)), otherFreelancer, null, null, 404);
        call(get("/api/assignments/" + id(a) + "/milestones"), otherClient, null, null, 404);
        call(get("/api/milestones/" + id(m) + "/submissions"), otherFreelancer, null, null, 404);
        call(
                post("/api/assignments/" + id(a) + "/milestones"),
                freelancer,
                taskBody("100", 2),
                null,
                403);
        call(
                post("/api/assignments/" + id(a) + "/milestones"),
                otherClient,
                taskBody("100", 2),
                null,
                404);
        call(put("/api/milestones/" + id(m)), freelancer, taskBody("100", 2), etag(m), 403);
        call(put("/api/milestones/" + id(m)), otherClient, taskBody("100", 2), etag(m), 404);
        call(delete("/api/milestones/" + id(m)), freelancer, null, etag(m), 403);
        deliver(m, client, 403);
        deliver(m, otherFreelancer, 404);
        var s = deliver(m, freelancer, 201);
        call(post("/api/submissions/" + id(s) + "/approve"), freelancer, null, etag(s), 403);
        call(post("/api/submissions/" + id(s) + "/approve"), otherClient, null, etag(s), 404);
        call(
                post("/api/submissions/" + id(s) + "/request-revision"),
                freelancer,
                Map.of("reviewNote", "No"),
                etag(s),
                403);
        var admin = account(Role.CLIENT);
        jdbc.update(
                "INSERT dbo.user_roles(user_id,role,assigned_at) VALUES (?,'ADMIN',SYSUTCDATETIME())",
                admin.user().id());
        jdbc.update(
                "DELETE FROM dbo.user_roles WHERE user_id=? AND role='CLIENT'", admin.user().id());
        call(get("/api/milestones/" + id(m)), admin, null, null, 403);
    }

    @Test
    void inputValidationUnknownFieldsEtagsUrlsAndRevisionReason() throws Exception {
        var a = active();
        var base = taskBody("100", 1);
        for (var override :
                List.of(
                        Map.of("title", " "),
                        Map.of("amount", -1),
                        Map.of("sortOrder", 0),
                        Map.of("amount", 1.234))) {
            var bad = new LinkedHashMap<String, Object>(base);
            bad.putAll(override);
            call(post("/api/assignments/" + id(a) + "/milestones"), client, bad, null, 422);
        }
        var wrong = new LinkedHashMap<String, Object>(base);
        wrong.put("scopeVersionId", 1);
        call(post("/api/assignments/" + id(a) + "/milestones"), client, wrong, null, 400);
        wrong = new LinkedHashMap<>(base);
        wrong.put("dueDate", LocalDate.now(ZoneOffset.UTC).plusDays(61).toString());
        call(post("/api/assignments/" + id(a) + "/milestones"), client, wrong, null, 422);
        var m = task(a, "100", 1);
        call(put("/api/milestones/" + id(m)), client, base, null, 400);
        call(delete("/api/milestones/" + id(m)), client, null, "bad", 400);
        call(
                post("/api/milestones/" + id(m) + "/submissions"),
                freelancer,
                Map.of("submissionNote", " "),
                etag(m),
                422);
        for (String url :
                List.of(
                        "file:///secret",
                        "javascript:alert(1)",
                        "https://user:pass@example.com/file",
                        "not a url"))
            call(
                    post("/api/milestones/" + id(m) + "/submissions"),
                    freelancer,
                    Map.of("submissionNote", "Delivery", "evidenceUrl", url),
                    etag(m),
                    422);
        call(
                post("/api/milestones/" + id(m) + "/submissions"),
                freelancer,
                Map.of("submissionNote", "Delivery", "submittedBy", client.user().id()),
                etag(m),
                400);
        call(
                post("/api/milestones/" + id(m) + "/submissions"),
                freelancer,
                Map.of("submissionNote", "Delivery"),
                null,
                400);
        var s =
                call(
                        post("/api/milestones/" + id(m) + "/submissions"),
                        freelancer,
                        Map.of("submissionNote", "Delivery without URL"),
                        etag(m),
                        201);
        call(
                post("/api/submissions/" + id(s) + "/request-revision"),
                client,
                Map.of("reviewNote", " "),
                etag(s),
                422);
        call(
                post("/api/submissions/" + id(s) + "/approve"),
                client,
                Map.of("userId", otherClient.user().id()),
                etag(s),
                400);
        call(post("/api/submissions/" + id(s) + "/approve"), client, null, etag(m), 409);
        call(
                get("/api/milestones/" + id(m) + "/submissions").param("size", "101"),
                client,
                null,
                null,
                422);
        accept(s, 200);
    }

    @ParameterizedTest
    @EnumSource(
            value = com.linkit.projects.entity.Milestone.Status.class,
            names = {"IN_PROGRESS", "SUBMITTED", "REVISION_REQUIRED", "APPROVED", "CANCELLED"})
    void cannotEditOrCancelNonPlanned(com.linkit.projects.entity.Milestone.Status state)
            throws Exception {
        var a = active();
        var m = task(a, "100", 1);
        jdbc.update("UPDATE dbo.milestones SET status=? WHERE id=?", state.name(), id(m));
        var current = taskGet(id(m));
        update(current, "90", 1, 409);
        cancel(current, 409);
    }

    @Test
    void plannedWithHistoryCannotBeEditedAndClientCannotSkipSubmissionOrReviewOldVersion()
            throws Exception {
        var a = active();
        var m = task(a, "100", 1);
        var first = deliver(m, freelancer, 201);
        revise(first, 200);
        jdbc.update("UPDATE dbo.milestones SET status='PLANNED' WHERE id=?", id(m));
        var inconsistent = taskGet(id(m));
        update(inconsistent, "90", 1, 409);
        cancel(inconsistent, 409);
        deliver(inconsistent, freelancer, 409);
        call(post("/api/submissions/99999999/approve"), client, null, etag(inconsistent), 404);
        jdbc.update("UPDATE dbo.milestones SET status='REVISION_REQUIRED' WHERE id=?", id(m));
        var second = deliver(taskGet(id(m)), freelancer, 201);
        call(post("/api/submissions/" + id(first) + "/approve"), client, null, etag(second), 409);
        call(
                post("/api/submissions/" + id(first) + "/request-revision"),
                client,
                Map.of("reviewNote", "old"),
                etag(second),
                409);
        accept(second, 200);
    }

    @Test
    void inProgressAllowsFirstSubmissionAndDeadlineBoundaryIsInclusive() throws Exception {
        var a = active();
        var input = taskBody("1000", 1);
        input.put("dueDate", LocalDate.now(ZoneOffset.UTC).plusDays(60).toString());
        var m = call(post("/api/assignments/" + id(a) + "/milestones"), client, input, null, 201);
        jdbc.update("UPDATE dbo.milestones SET status='IN_PROGRESS' WHERE id=?", id(m));
        accept(deliver(taskGet(id(m)), freelancer, 201), 200);
    }

    @ParameterizedTest
    @EnumSource(
            value = com.linkit.projects.entity.Assignment.Status.class,
            names = {"PENDING_SCOPE", "AWAITING_ACCEPTANCE", "COMPLETED", "CANCELLED"})
    void assignmentMustRemainActiveForAllWrites(com.linkit.projects.entity.Assignment.Status state)
            throws Exception {
        var a = active();
        var m = task(a, "100", 1);
        var s = deliver(m, freelancer, 201);
        jdbc.update("UPDATE dbo.assignments SET status=? WHERE id=?", state.name(), id(a));
        call(
                post("/api/assignments/" + id(a) + "/milestones"),
                client,
                taskBody("100", 2),
                null,
                409);
        var current = taskGet(id(m));
        update(current, "90", 1, 409);
        cancel(current, 409);
        deliver(current, freelancer, 409);
        accept(s, 409);
        revise(s, 409);
        call(get("/api/assignments/" + id(a) + "/milestones"), freelancer, null, null, 200);
    }

    @Test
    void jobAndCurrentLockedScopeAreMandatoryAndOldScopeIsReadOnly() throws Exception {
        var a = active();
        var m = task(a, "100", 1);
        var s = deliver(m, freelancer, 201);
        long job = node(a).path("jobId").asLong();
        jdbc.update("UPDATE dbo.jobs SET status='ASSIGNED' WHERE id=?", job);
        accept(s, 409);
        call(
                post("/api/assignments/" + id(a) + "/milestones"),
                client,
                taskBody("100", 2),
                null,
                409);
        jdbc.update("UPDATE dbo.jobs SET status='IN_PROGRESS' WHERE id=?", job);
        jdbc.update(
                "UPDATE dbo.scope_versions SET status='SUPERSEDED' WHERE assignment_id=?", id(a));
        accept(s, 409);
        call(
                post("/api/assignments/" + id(a) + "/milestones"),
                client,
                taskBody("100", 2),
                null,
                409);
        jdbc.update(
                "INSERT dbo.scope_versions(assignment_id,version_number,deliverables,acceptance_criteria,budget,deadline,status,created_by,created_at,locked_at) SELECT assignment_id,version_number+1,deliverables,acceptance_criteria,budget,deadline,'LOCKED',created_by,created_at,locked_at FROM dbo.scope_versions WHERE assignment_id=?",
                id(a));
        accept(s, 409);
        deliver(taskGet(id(m)), freelancer, 409);
    }

    @Test
    void noLockedScopeBeforeScopeLockPreventsCreation() throws Exception {
        var a = assignment();
        call(
                post("/api/assignments/" + id(a) + "/milestones"),
                client,
                taskBody("100", 1),
                null,
                409);
    }

    private List<Integer> race(Callable<Integer> one, Callable<Integer> two) throws Exception {
        var pool = Executors.newFixedThreadPool(2);
        var gate = new CountDownLatch(1);
        try {
            var first =
                    pool.submit(
                            () -> {
                                gate.await();
                                return one.call();
                            });
            var second =
                    pool.submit(
                            () -> {
                                gate.await();
                                return two.call();
                            });
            gate.countDown();
            return List.of(first.get(30, TimeUnit.SECONDS), second.get(30, TimeUnit.SECONDS));
        } finally {
            pool.shutdownNow();
        }
    }

    private int raw(
            MockHttpServletRequestBuilder req,
            TokenResponse actor,
            Map<String, Object> body,
            String version)
            throws Exception {
        return mvc.perform(request(req, actor, body, version))
                .andReturn()
                .getResponse()
                .getStatus();
    }

    @Test
    void concurrentCreationSerializesBudgetAndRollbackPreservesWinner() throws Exception {
        var a = active();
        String path = "/api/assignments/" + id(a) + "/milestones";
        assertThat(
                        race(
                                () -> raw(post(path), client, taskBody("600", 1), null),
                                () -> raw(post(path), client, taskBody("600", 2), null)))
                .containsExactlyInAnyOrder(201, 422);
        assertThat(scalar("SELECT SUM(amount) FROM dbo.milestones WHERE assignment_id=?", id(a)))
                .isEqualTo(600);
    }

    @Test
    void concurrentUpdateSerializesBudgetAcrossDifferentMilestones() throws Exception {
        var a = active();
        var one = task(a, "300", 1);
        var two = task(a, "300", 2);
        assertThat(
                        race(
                                () ->
                                        raw(
                                                put("/api/milestones/" + id(one)),
                                                client,
                                                taskBody("600", 1),
                                                etag(one)),
                                () ->
                                        raw(
                                                put("/api/milestones/" + id(two)),
                                                client,
                                                taskBody("600", 2),
                                                etag(two))))
                .containsExactlyInAnyOrder(200, 422);
        assertThat(scalar("SELECT SUM(amount) FROM dbo.milestones WHERE assignment_id=?", id(a)))
                .isEqualTo(900);
    }

    @Test
    void concurrentSubmissionsCreateOneNumberAndStaleWriteIsRejected() throws Exception {
        var a = active();
        var m = task(a, "100", 1);
        String path = "/api/milestones/" + id(m) + "/submissions";
        var in = Map.<String, Object>of("submissionNote", "Concurrent delivery");
        assertThat(
                        race(
                                () -> raw(post(path), freelancer, in, etag(m)),
                                () -> raw(post(path), freelancer, in, etag(m))))
                .containsExactlyInAnyOrder(201, 409);
        assertThat(
                        scalar(
                                "SELECT COUNT(*) FROM dbo.milestone_submissions WHERE milestone_id=?",
                                id(m)))
                .isEqualTo(1);
    }

    @Test
    void concurrentApproveAndRevisionHaveOnlyOneWinner() throws Exception {
        var a = active();
        var m = task(a, "100", 1);
        var s = deliver(m, freelancer, 201);
        assertThat(
                        race(
                                () ->
                                        raw(
                                                post("/api/submissions/" + id(s) + "/approve"),
                                                client,
                                                null,
                                                etag(s)),
                                () ->
                                        raw(
                                                post(
                                                        "/api/submissions/"
                                                                + id(s)
                                                                + "/request-revision"),
                                                client,
                                                Map.of("reviewNote", "Fix tests"),
                                                etag(s))))
                .containsExactlyInAnyOrder(200, 409);
        String actual = taskStatus(id(m));
        assertThat(actual).isIn("APPROVED", "REVISION_REQUIRED");
        assertThat(
                        jdbc.queryForObject(
                                "SELECT status FROM dbo.milestone_submissions WHERE id=?",
                                String.class,
                                id(s)))
                .isEqualTo(actual);
    }

    @Test
    void createUpdateCancelSubmitAndReviewFailuresRollBackEveryTableAndRowversion()
            throws Exception {
        var a = active();
        var m = task(a, "100", 1);
        var before = fingerprint();
        doThrow(
                        new org.springframework.dao.DataIntegrityViolationException(
                                "test late audit failure"))
                .when(audit)
                .flush();
        try {
            call(
                    post("/api/assignments/" + id(a) + "/milestones"),
                    client,
                    taskBody("100", 2),
                    null,
                    409);
            update(m, "200", 1, 409);
            cancel(m, 409);
            deliver(m, freelancer, 409);
        } finally {
            reset(audit);
        }
        assertThat(fingerprint()).isEqualTo(before);
        var s = deliver(m, freelancer, 201);
        before = fingerprint();
        doThrow(
                        new org.springframework.dao.DataIntegrityViolationException(
                                "test late review failure"))
                .when(audit)
                .flush();
        try {
            accept(s, 409);
            revise(s, 409);
        } finally {
            reset(audit);
        }
        assertThat(fingerprint()).isEqualTo(before);
        accept(s, 200);
    }

    @Test
    void databaseRejectsDuplicateSubmissionNumberAndWrongAssignmentScope() throws Exception {
        var a = active();
        var m = task(a, "100", 1);
        var s = deliver(m, freelancer, 201);
        assertThatThrownBy(
                        () ->
                                new TransactionTemplate(transactions)
                                        .executeWithoutResult(
                                                t ->
                                                        jdbc.update(
                                                                "INSERT dbo.milestone_submissions(milestone_id,submission_number,submitted_by,submission_note,status,submitted_at) VALUES (?,1,?,'Duplicate','SUBMITTED',SYSUTCDATETIME())",
                                                                idUnchecked(m),
                                                                freelancer.user().id())))
                .isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
        var another = active();
        Long otherScope =
                jdbc.queryForObject(
                        "SELECT id FROM dbo.scope_versions WHERE assignment_id=?",
                        Long.class,
                        id(another));
        assertThatThrownBy(
                        () ->
                                new TransactionTemplate(transactions)
                                        .executeWithoutResult(
                                                t ->
                                                        jdbc.update(
                                                                "UPDATE dbo.milestones SET scope_version_id=? WHERE id=?",
                                                                otherScope,
                                                                idUnchecked(m))))
                .isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
    }

    private long idUnchecked(MvcResult value) {
        try {
            return id(value);
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }
}
