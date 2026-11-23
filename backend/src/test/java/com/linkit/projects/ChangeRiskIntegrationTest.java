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
@EnabledIfEnvironmentVariable(named = "LINKIT_CHANGE_RISK_TEST", matches = "true")
class ChangeRiskIntegrationTest {
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
    private final String marker = "change-risk-it-" + UUID.randomUUID();
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
                                jdbc.update(
                                        "DELETE FROM dbo.risk_alerts WHERE assignment_id IN ("
                                                + project
                                                + ")",
                                        values);
                                jdbc.update(
                                        "DELETE FROM dbo.change_request_approvals WHERE change_request_id IN (SELECT id FROM dbo.change_requests WHERE assignment_id IN ("
                                                + project
                                                + "))",
                                        values);
                                jdbc.update(
                                        "DELETE FROM dbo.change_requests WHERE assignment_id IN ("
                                                + project
                                                + ")",
                                        values);
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

    private Map<String, Object> changeBody(String delta, int days) {
        return new LinkedHashMap<>(
                Map.of(
                        "title",
                        "Extend portfolio delivery",
                        "reason",
                        "Additional reporting requirements agreed for the project",
                        "proposedDeliverables",
                        "Deliver portfolio, reporting module and acceptance tests",
                        "budgetDelta",
                        new BigDecimal(delta),
                        "daysDelta",
                        days));
    }

    private MvcResult change(MvcResult a, TokenResponse actor, String delta, int days)
            throws Exception {
        return call(
                post("/api/assignments/" + id(a) + "/change-requests"),
                actor,
                changeBody(delta, days),
                null,
                201);
    }

    private MvcResult changeGet(long id) throws Exception {
        return call(get("/api/change-requests/" + id), client, null, null, 200);
    }

    private MvcResult decide(MvcResult c, TokenResponse actor, String decision, int expected)
            throws Exception {
        return call(
                post("/api/change-requests/" + id(c) + "/decisions"),
                actor,
                Map.of("decision", decision),
                etag(c),
                expected);
    }

    private MvcResult agreed(MvcResult c) throws Exception {
        return decide(decide(c, client, "APPROVED", 200), freelancer, "APPROVED", 200);
    }

    private MvcResult apply(MvcResult c, int expected) throws Exception {
        return call(
                post("/api/change-requests/" + id(c) + "/apply"), client, null, etag(c), expected);
    }

    private JsonNode evaluate(MvcResult a, TokenResponse actor) throws Exception {
        return node(
                call(
                        post("/api/assignments/" + id(a) + "/risk-alerts/evaluate"),
                        actor,
                        null,
                        null,
                        200));
    }

    private JsonNode alerts(MvcResult a) throws Exception {
        return node(call(
                        get("/api/assignments/" + id(a) + "/risk-alerts"), client, null, null, 200))
                .path("content");
    }

    private Long scopeId(MvcResult a) throws Exception {
        return jdbc.queryForObject(
                "SELECT id FROM dbo.scope_versions WHERE assignment_id=? AND status='LOCKED'",
                Long.class,
                id(a));
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
    void bothDecisionsThenExplicitApplyCreatesNewScopeWithoutScopeApprovals() throws Exception {
        var a = active();
        Long original = scopeId(a);
        var work = task(a, "100", 1);
        var submission = deliver(work, freelancer, 201);
        accept(submission, 200);
        var originalWork = fingerprintRow("milestones", id(work));
        var old = jdbc.queryForMap("SELECT * FROM dbo.scope_versions WHERE id=?", original);
        var jobBefore = fingerprintRow("jobs", node(a).path("jobId").asLong());
        var c = change(a, freelancer, "200", 7);
        assertThat(node(c).path("status").asText()).isEqualTo("PENDING");
        assertThat(node(c).path("decisions").size()).isZero();
        apply(c, 409);
        var first = decide(c, freelancer, "APPROVED", 200);
        assertThat(node(first).path("status").asText()).isEqualTo("PENDING");
        decide(first, freelancer, "APPROVED", 409);
        var approved = decide(first, client, "APPROVED", 200);
        assertThat(node(approved).path("status").asText()).isEqualTo("APPROVED");
        assertThat(scopeId(a)).isEqualTo(original);
        var applied = apply(approved, 200);
        assertThat(node(applied).path("status").asText()).isEqualTo("APPLIED");
        long next = node(applied).path("resultScopeVersionId").asLong();
        assertThat(next).isNotEqualTo(original);
        var nextScope = jdbc.queryForMap("SELECT * FROM dbo.scope_versions WHERE id=?", next);
        assertThat(nextScope.get("budget")).isEqualTo(new BigDecimal("1200.00"));
        assertThat(nextScope.get("deadline").toString())
                .isEqualTo(LocalDate.parse(old.get("deadline").toString()).plusDays(7).toString());
        assertThat(nextScope.get("deliverables"))
                .isEqualTo(node(c).path("proposedDeliverables").asText());
        assertThat(nextScope.get("acceptance_criteria")).isEqualTo(old.get("acceptance_criteria"));
        assertThat(nextScope.get("exclusions")).isEqualTo(old.get("exclusions"));
        assertThat(
                        jdbc.queryForObject(
                                "SELECT status FROM dbo.scope_versions WHERE id=?",
                                String.class,
                                original))
                .isEqualTo("SUPERSEDED");
        assertThat(
                        scalar(
                                "SELECT COUNT(*) FROM dbo.scope_approvals WHERE scope_version_id=?",
                                next))
                .isZero();
        assertThat(
                        scalar(
                                "SELECT COUNT(*) FROM dbo.scope_approvals WHERE scope_version_id=?",
                                original))
                .isEqualTo(2);
        assertThat(
                        scalar(
                                "SELECT COUNT(*) FROM dbo.change_request_approvals WHERE change_request_id=?",
                                id(c)))
                .isEqualTo(2);
        assertThat(node(assignmentGet(id(a))).path("agreedBudget").decimalValue())
                .isEqualByComparingTo("1200");
        assertThat(node(assignmentGet(id(a))).path("status").asText()).isEqualTo("ACTIVE");
        assertThat(fingerprintRow("jobs", node(a).path("jobId").asLong())).isEqualTo(jobBefore);
        assertThat(fingerprintRow("milestones", id(work))).isEqualTo(originalWork);
        apply(applied, 409);
        task(a, "1100", 2);
    }

    private byte[] fingerprintRow(String table, long id) throws Exception {
        return json.writeValueAsBytes(
                jdbc.queryForMap("SELECT * FROM dbo." + table + " WHERE id=?", id));
    }

    @Test
    void reducedBudgetStillHonoursApprovedMilestoneAllocationsFrom3F() throws Exception {
        var a = active();
        var milestone = task(a, "500", 1);
        accept(deliver(milestone, freelancer, 201), 200);
        var tooSmall = agreed(change(a, client, "-500.01", 0));
        var before = fingerprint();
        apply(tooSmall, 422);
        assertThat(fingerprint()).isEqualTo(before);
        var exact = agreed(change(a, client, "-500", 0));
        apply(exact, 200);
        assertThat(node(assignmentGet(id(a))).path("agreedBudget").decimalValue())
                .isEqualByComparingTo("500");
        assertThat(taskStatus(id(milestone))).isEqualTo("APPROVED");
    }

    @Test
    void rejectionIsTerminalAndCreatorDoesNotDecideAutomatically() throws Exception {
        var a = active();
        var c = change(a, client, "10", 0);
        assertThat(node(c).path("decisions").size()).isZero();
        var rejected = decide(c, freelancer, "REJECTED", 200);
        assertThat(node(rejected).path("status").asText()).isEqualTo("REJECTED");
        decide(rejected, client, "APPROVED", 409);
        decide(rejected, freelancer, "APPROVED", 409);
        apply(rejected, 409);
    }

    @Test
    void staleBaseScopeBlocksApplyAndPreservesBothChangeHistories() throws Exception {
        var a = active();
        var one = agreed(change(a, client, "10", 0));
        var two = agreed(change(a, freelancer, "20", 0));
        apply(one, 200);
        var before = fingerprint();
        apply(two, 409);
        assertThat(fingerprint()).isEqualTo(before);
        assertThat(node(changeGet(id(two))).path("status").asText()).isEqualTo("APPROVED");
    }

    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.EnumSource(
            value = com.linkit.projects.entity.Milestone.Status.class,
            names = {"PLANNED", "IN_PROGRESS", "SUBMITTED", "REVISION_REQUIRED"})
    void unfinishedMilestonesBlockApplication(com.linkit.projects.entity.Milestone.Status state)
            throws Exception {
        var a = active();
        var m = task(a, "100", 1);
        jdbc.update("UPDATE dbo.milestones SET status=? WHERE id=?", state.name(), id(m));
        var c = agreed(change(a, client, "10", 0));
        var before = fingerprint();
        apply(c, 409);
        assertThat(fingerprint()).isEqualTo(before);
    }

    @Test
    void plannedMustBeCancelledAndCancelledHistoryIsUnchanged() throws Exception {
        var a = active();
        var m = task(a, "100", 1);
        var c = agreed(change(a, client, "10", 0));
        apply(c, 409);
        cancel(m, 204);
        var old = fingerprintRow("milestones", id(m));
        apply(c, 200);
        assertThat(fingerprintRow("milestones", id(m))).isEqualTo(old);
    }

    @Test
    void evenApprovedMilestoneWithUnreviewedSubmissionBlocksApply() throws Exception {
        var a = active();
        var m = task(a, "100", 1);
        deliver(m, freelancer, 201);
        jdbc.update("UPDATE dbo.milestones SET status='APPROVED' WHERE id=?", id(m));
        apply(agreed(change(a, client, "10", 0)), 409);
    }

    @Test
    void changeRbacOwnershipPaginationAndInputValidation() throws Exception {
        var a = active();
        var c = change(a, client, "10", 0);
        call(get("/api/change-requests/" + id(c)), null, null, null, 401);
        call(get("/api/change-requests/" + id(c)), otherClient, null, null, 404);
        call(
                get("/api/assignments/" + id(a) + "/change-requests"),
                otherFreelancer,
                null,
                null,
                404);
        call(
                post("/api/assignments/" + id(a) + "/change-requests"),
                otherClient,
                changeBody("10", 0),
                null,
                404);
        decide(c, otherFreelancer, "APPROVED", 404);
        call(
                post("/api/change-requests/" + id(c) + "/decisions"),
                client,
                Map.of("decision", "APPROVED"),
                null,
                400);
        call(
                post("/api/change-requests/" + id(c) + "/decisions"),
                client,
                Map.of("decision", "APPROVED"),
                "invalid",
                400);
        var bad = changeBody("10", 0);
        bad.put("userId", freelancer.user().id());
        call(post("/api/assignments/" + id(a) + "/change-requests"), client, bad, null, 400);
        for (var content :
                List.of(
                        changeBody("-1000", 0),
                        changeBody("99999999999999999.99", 0),
                        changeBody("0", Integer.MAX_VALUE)))
            call(
                    post("/api/assignments/" + id(a) + "/change-requests"),
                    client,
                    content,
                    null,
                    422);
        var first = decide(c, client, "APPROVED", 200);
        decide(c, freelancer, "APPROVED", 409);
        var approved = decide(first, freelancer, "APPROVED", 200);
        call(
                post("/api/change-requests/" + id(c) + "/apply"),
                freelancer,
                null,
                etag(approved),
                403);
        call(
                post("/api/change-requests/" + id(c) + "/apply"),
                otherClient,
                null,
                etag(approved),
                404);
        change(a, freelancer, "-999.99", -1);
        var page =
                node(
                        call(
                                get("/api/assignments/" + id(a) + "/change-requests")
                                        .param("size", "1"),
                                freelancer,
                                null,
                                null,
                                200));
        assertThat(page.path("totalElements").asInt()).isEqualTo(2);
        assertThat(page.path("totalPages").asInt()).isEqualTo(2);
        var notActive = assignment();
        call(
                post("/api/assignments/" + id(notActive) + "/change-requests"),
                client,
                changeBody("10", 0),
                null,
                409);
    }

    @Test
    void concurrentDecisionsAndDoubleApplyHaveOneWinner() throws Exception {
        var a = active();
        var c = change(a, client, "10", 0);
        String decisions = "/api/change-requests/" + id(c) + "/decisions";
        assertThat(
                        race(
                                () ->
                                        raw(
                                                post(decisions),
                                                client,
                                                Map.of("decision", "APPROVED"),
                                                etag(c)),
                                () ->
                                        raw(
                                                post(decisions),
                                                freelancer,
                                                Map.of("decision", "APPROVED"),
                                                etag(c))))
                .containsExactlyInAnyOrder(200, 409);
        var current = changeGet(id(c));
        long decided = node(current).path("decisions").get(0).path("userId").asLong();
        var agreed =
                decide(
                        current,
                        decided == client.user().id() ? freelancer : client,
                        "APPROVED",
                        200);
        String path = "/api/change-requests/" + id(c) + "/apply";
        assertThat(
                        race(
                                () -> raw(post(path), client, null, etag(agreed)),
                                () -> raw(post(path), client, null, etag(agreed))))
                .containsExactlyInAnyOrder(200, 409);
        assertThat(scalar("SELECT COUNT(*) FROM dbo.scope_versions WHERE assignment_id=?", id(a)))
                .isEqualTo(2);
        assertThat(
                        scalar(
                                "SELECT COUNT(*) FROM dbo.scope_versions WHERE assignment_id=? AND status='LOCKED'",
                                id(a)))
                .isEqualTo(1);
    }

    @Test
    void competingApprovedChangesCannotBothReplaceTheSameScope() throws Exception {
        var a = active();
        var one = agreed(change(a, client, "10", 0));
        var two = agreed(change(a, client, "20", 0));
        assertThat(
                        race(
                                () ->
                                        raw(
                                                post("/api/change-requests/" + id(one) + "/apply"),
                                                client,
                                                null,
                                                etag(one)),
                                () ->
                                        raw(
                                                post("/api/change-requests/" + id(two) + "/apply"),
                                                client,
                                                null,
                                                etag(two))))
                .containsExactlyInAnyOrder(200, 409);
        assertThat(scalar("SELECT COUNT(*) FROM dbo.scope_versions WHERE assignment_id=?", id(a)))
                .isEqualTo(2);
    }

    @Test
    void changeCreateDecisionAndAppliedScopeBudgetAllRollBackOnLateFailure() throws Exception {
        var a = active();
        var c = change(a, client, "10", 0);
        var before = fingerprint();
        doThrow(new org.springframework.dao.DataIntegrityViolationException("test failure"))
                .when(audit)
                .flush();
        try {
            call(
                    post("/api/assignments/" + id(a) + "/change-requests"),
                    client,
                    changeBody("20", 0),
                    null,
                    409);
            decide(c, client, "APPROVED", 409);
        } finally {
            reset(audit);
        }
        assertThat(fingerprint()).isEqualTo(before);
        var approved = agreed(c);
        before = fingerprint();
        doThrow(new org.springframework.dao.DataIntegrityViolationException("test apply failure"))
                .when(audit)
                .flush();
        try {
            apply(approved, 409);
        } finally {
            reset(audit);
        }
        assertThat(fingerprint()).isEqualTo(before);
        apply(approved, 200);
    }

    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.CsvSource({
        "199.99,0,0",
        "200,0,1",
        "-200,0,1",
        "-199.99,0,0",
        "0,6,0",
        "0,7,1",
        "0,-7,1"
    })
    void largeChangeThresholdsAreExact(String delta, int days, int expected) throws Exception {
        var a = active();
        var c = change(a, client, delta, days);
        assertThat(evaluate(a, client).path("created").asInt()).isEqualTo(expected);
        if (expected == 1) {
            var alert = alerts(a).get(0);
            assertThat(alert.path("ruleCode").asText()).isEqualTo("LARGE_SCOPE_CHANGE:CR:" + id(c));
            assertThat(alert.path("severity").asText()).isEqualTo("HIGH");
        }
    }

    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.EnumSource(
            com.linkit.projects.entity.ChangeRequest.Status.class)
    void largeChangeOnlyPendingAndApproved(com.linkit.projects.entity.ChangeRequest.Status state)
            throws Exception {
        var a = active();
        var c = change(a, client, "200", 0);
        jdbc.update("UPDATE dbo.change_requests SET status=? WHERE id=?", state.name(), id(c));
        int expected =
                state == com.linkit.projects.entity.ChangeRequest.Status.PENDING
                                || state == com.linkit.projects.entity.ChangeRequest.Status.APPROVED
                        ? 1
                        : 0;
        assertThat(evaluate(a, client).path("created").asInt()).isEqualTo(expected);
    }

    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.CsvSource({"-1,0", "0,1", "3,1", "4,0"})
    void approachingDeadlineUsesUtcInclusiveZeroToThree(int days, int expected) throws Exception {
        var a = active();
        jdbc.update(
                "UPDATE dbo.scope_versions SET deadline=? WHERE id=?",
                LocalDate.now(ZoneOffset.UTC).plusDays(days),
                scopeId(a));
        assertThat(evaluate(a, client).path("created").asInt()).isEqualTo(expected);
        if (expected == 1) {
            assertThat(alerts(a).get(0).path("ruleCode").asText())
                    .isEqualTo("DEADLINE_APPROACHING:SCOPE:" + scopeId(a));
            assertThat(alerts(a).get(0).path("severity").asText()).isEqualTo("MEDIUM");
        }
    }

    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.CsvSource({"2,0", "3,1"})
    void revisionThresholdCountsHistoricalRevisionSubmissions(int times, int expected)
            throws Exception {
        var a = active();
        var m = task(a, "100", 1);
        for (int i = 0; i < times; i++) revise(deliver(taskGet(id(m)), freelancer, 201), 200);
        assertThat(evaluate(a, client).path("created").asInt()).isEqualTo(expected);
        if (expected == 1) {
            assertThat(alerts(a).get(0).path("riskType").asText()).isEqualTo("EXCESSIVE_REVISIONS");
            assertThat(alerts(a).get(0).path("milestoneId").asLong()).isEqualTo(id(m));
        }
    }

    @Test
    void overdueDeduplicatesAcknowledgesAutoResolvesAndRetainsHistoryOnRecurrence()
            throws Exception {
        var a = active();
        var m = task(a, "100", 1);
        jdbc.update(
                "UPDATE dbo.milestones SET due_date=? WHERE id=?",
                LocalDate.now(ZoneOffset.UTC).minusDays(1),
                id(m));
        assertThat(evaluate(a, client).path("created").asInt()).isEqualTo(1);
        var alert = alerts(a).get(0);
        long alertId = alert.path("id").asLong();
        assertThat(alert.path("severity").asText()).isEqualTo("HIGH");
        assertThat(alert.path("milestoneId").asLong()).isEqualTo(id(m));
        call(post("/api/risk-alerts/" + alertId + "/acknowledge"), client, null, null, 200);
        assertThat(evaluate(a, client).path("created").asInt()).isZero();
        cancel(taskGet(id(m)), 204);
        assertThat(evaluate(a, client).path("resolved").asInt()).isEqualTo(1);
        assertThat(
                        node(call(get("/api/risk-alerts/" + alertId), freelancer, null, null, 200))
                                .path("status")
                                .asText())
                .isEqualTo("RESOLVED");
        jdbc.update("UPDATE dbo.milestones SET status='PLANNED' WHERE id=?", id(m));
        assertThat(evaluate(a, client).path("created").asInt()).isEqualTo(1);
        assertThat(alerts(a)).hasSize(2);
        assertThat(alerts(a).get(0).path("id").asLong()).isNotEqualTo(alertId);
    }

    @Test
    void twoChangesHaveDistinctSourcesAndTerminalChangesResolveIndependently() throws Exception {
        var a = active();
        var one = change(a, client, "200", 0);
        var two = change(a, client, "0", 7);
        assertThat(evaluate(a, client).path("created").asInt()).isEqualTo(2);
        assertThat(alerts(a).get(0).path("ruleCode").asText())
                .isNotEqualTo(alerts(a).get(1).path("ruleCode").asText());
        decide(one, freelancer, "REJECTED", 200);
        assertThat(evaluate(a, client).path("resolved").asInt()).isEqualTo(1);
        var approved = agreed(two);
        assertThat(evaluate(a, client).path("created").asInt()).isZero();
        apply(approved, 200);
        assertThat(evaluate(a, client).path("resolved").asInt()).isEqualTo(1);
        assertThat(alerts(a)).hasSize(2);
    }

    @Test
    void newScopeHasDifferentDeadlineSourceAndResolvesOldScopeAlert() throws Exception {
        var a = active();
        jdbc.update(
                "UPDATE dbo.scope_versions SET deadline=? WHERE id=?",
                LocalDate.now(ZoneOffset.UTC).plusDays(2),
                scopeId(a));
        evaluate(a, client);
        String before = alerts(a).get(0).path("ruleCode").asText();
        apply(agreed(change(a, client, "10", 0)), 200);
        var evaluated = evaluate(a, client);
        assertThat(evaluated.path("created").asInt()).isEqualTo(1);
        assertThat(evaluated.path("resolved").asInt()).isEqualTo(1);
        assertThat(alerts(a)).hasSize(2);
        assertThat(alerts(a).get(0).path("ruleCode").asText()).isNotEqualTo(before);
    }

    @Test
    void concurrentEvaluateDoesNotDuplicateAndDoesNotChangeProjectStatuses() throws Exception {
        var a = active();
        change(a, client, "200", 0);
        String path = "/api/assignments/" + id(a) + "/risk-alerts/evaluate";
        var assignmentBefore = fingerprintRow("assignments", id(a));
        var jobBefore = fingerprintRow("jobs", node(a).path("jobId").asLong());
        assertThat(
                        race(
                                () -> raw(post(path), client, null, null),
                                () -> raw(post(path), client, null, null)))
                .containsExactly(200, 200);
        assertThat(alerts(a)).hasSize(1);
        assertThat(evaluate(a, client).path("created").asInt()).isZero();
        assertThat(fingerprintRow("assignments", id(a))).isEqualTo(assignmentBefore);
        assertThat(fingerprintRow("jobs", node(a).path("jobId").asLong())).isEqualTo(jobBefore);
        assertThat(alerts(a).get(0).path("ruleCode").asText().length()).isLessThanOrEqualTo(60);
    }

    @Test
    void riskRbacOwnerAdminActionsAndIdempotentResolve() throws Exception {
        var a = active();
        change(a, client, "200", 0);
        evaluate(a, client);
        long risk = alerts(a).get(0).path("id").asLong();
        call(get("/api/risk-alerts/" + risk), null, null, null, 401);
        call(get("/api/risk-alerts/" + risk), otherClient, null, null, 404);
        call(get("/api/assignments/" + id(a) + "/risk-alerts"), otherFreelancer, null, null, 404);
        call(
                post("/api/assignments/" + id(a) + "/risk-alerts/evaluate"),
                freelancer,
                null,
                null,
                403);
        call(
                post("/api/assignments/" + id(a) + "/risk-alerts/evaluate"),
                otherClient,
                null,
                null,
                404);
        call(post("/api/risk-alerts/" + risk + "/resolve"), freelancer, null, null, 403);
        call(post("/api/risk-alerts/" + risk + "/acknowledge"), freelancer, null, null, 403);
        call(post("/api/risk-alerts/" + risk + "/resolve"), otherClient, null, null, 404);
        call(post("/api/risk-alerts/" + risk + "/acknowledge"), client, null, null, 200);
        call(post("/api/risk-alerts/" + risk + "/acknowledge"), client, null, null, 200);
        var admin = account(Role.CLIENT);
        jdbc.update(
                "INSERT dbo.user_roles(user_id,role,assigned_at) VALUES (?,'ADMIN',SYSUTCDATETIME())",
                admin.user().id());
        jdbc.update(
                "DELETE FROM dbo.user_roles WHERE user_id=? AND role='CLIENT'", admin.user().id());
        evaluate(a, admin);
        call(post("/api/risk-alerts/" + risk + "/resolve"), admin, null, null, 200);
        var before = fingerprint();
        call(post("/api/risk-alerts/" + risk + "/resolve"), admin, null, null, 200);
        assertThat(fingerprint()).isEqualTo(before);
        call(post("/api/risk-alerts/" + risk + "/acknowledge"), client, null, null, 409);
    }

    @Test
    void riskCreationAcknowledgementResolutionAndAutoResolveRollBack() throws Exception {
        var a = active();
        var c = change(a, client, "200", 0);
        var before = fingerprint();
        doThrow(new org.springframework.dao.DataIntegrityViolationException("test risk failure"))
                .when(audit)
                .flush();
        try {
            call(
                    post("/api/assignments/" + id(a) + "/risk-alerts/evaluate"),
                    client,
                    null,
                    null,
                    409);
        } finally {
            reset(audit);
        }
        assertThat(fingerprint()).isEqualTo(before);
        evaluate(a, client);
        long risk = alerts(a).get(0).path("id").asLong();
        before = fingerprint();
        doThrow(
                        new org.springframework.dao.DataIntegrityViolationException(
                                "test risk update failure"))
                .when(audit)
                .flush();
        try {
            call(post("/api/risk-alerts/" + risk + "/acknowledge"), client, null, null, 409);
            call(post("/api/risk-alerts/" + risk + "/resolve"), client, null, null, 409);
        } finally {
            reset(audit);
        }
        assertThat(fingerprint()).isEqualTo(before);
        decide(c, client, "REJECTED", 200);
        before = fingerprint();
        doThrow(
                        new org.springframework.dao.DataIntegrityViolationException(
                                "test auto resolve failure"))
                .when(audit)
                .flush();
        try {
            call(
                    post("/api/assignments/" + id(a) + "/risk-alerts/evaluate"),
                    client,
                    null,
                    null,
                    409);
        } finally {
            reset(audit);
        }
        assertThat(fingerprint()).isEqualTo(before);
        assertThat(evaluate(a, client).path("resolved").asInt()).isEqualTo(1);
    }

    @Test
    void riskReadAdminAccessDoesNotExpandOtherEndpointsOrPartyOwnership() throws Exception {
        var a = active();
        change(a, client, "200", 0);
        evaluate(a, client);
        long risk = alerts(a).get(0).path("id").asLong();
        var admin = account(Role.CLIENT);
        jdbc.update(
                "INSERT dbo.user_roles(user_id,role,assigned_at) VALUES (?,'ADMIN',SYSUTCDATETIME())",
                admin.user().id());
        jdbc.update(
                "DELETE FROM dbo.user_roles WHERE user_id=? AND role='CLIENT'", admin.user().id());
        var before = fingerprint();
        for (var reader : List.of(client, freelancer, admin)) {
            var list =
                    node(
                            call(
                                    get("/api/assignments/" + id(a) + "/risk-alerts"),
                                    reader,
                                    null,
                                    null,
                                    200));
            assertThat(list.path("content").get(0).path("id").asLong()).isEqualTo(risk);
            assertThat(
                            node(call(get("/api/risk-alerts/" + risk), reader, null, null, 200))
                                    .path("assignmentId")
                                    .asLong())
                    .isEqualTo(id(a));
        }
        for (var stranger : List.of(otherClient, otherFreelancer)) {
            call(get("/api/assignments/" + id(a) + "/risk-alerts"), stranger, null, null, 404);
            call(get("/api/risk-alerts/" + risk), stranger, null, null, 404);
        }
        call(post("/api/risk-alerts/" + risk + "/acknowledge"), admin, null, null, 403);
        call(
                post("/api/assignments/" + id(a) + "/risk-alerts/evaluate"),
                freelancer,
                null,
                null,
                403);
        call(post("/api/risk-alerts/" + risk + "/resolve"), freelancer, null, null, 403);
        call(get("/api/assignments/" + id(a) + "/change-requests"), admin, null, null, 403);
        call(get("/api/assignments/" + id(a) + "/scopes"), admin, null, null, 403);
        call(get("/api/assignments/" + id(a) + "/risk-alerts"), null, null, null, 401);
        assertThat(fingerprint()).isEqualTo(before);
    }
}
