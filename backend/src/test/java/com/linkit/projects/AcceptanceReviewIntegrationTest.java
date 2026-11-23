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
@EnabledIfEnvironmentVariable(named = "LINKIT_ACCEPTANCE_REVIEW_TEST", matches = "true")
class AcceptanceReviewIntegrationTest {
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
    private final String marker = "accept-review-it-" + UUID.randomUUID();
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
                                        "DELETE FROM dbo.reviews WHERE assignment_id IN ("
                                                + project
                                                + ")",
                                        values);
                                jdbc.update(
                                        "DELETE FROM dbo.final_acceptances WHERE assignment_id IN ("
                                                + project
                                                + ")",
                                        values);
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

    private MvcResult finalState(MvcResult a, TokenResponse actor) throws Exception {
        return call(get("/api/assignments/" + id(a) + "/final-acceptance"), actor, null, null, 200);
    }

    private MvcResult ready() throws Exception {
        var a = active();
        var m = task(a, "100", 1);
        accept(deliver(m, freelancer, 201), 200);
        return assignmentGet(id(a));
    }

    private MvcResult finish(MvcResult a, TokenResponse actor, int expected) throws Exception {
        return call(
                post("/api/assignments/" + id(a) + "/final-acceptance"),
                actor,
                Map.of("acceptanceNote", "All agreed deliverables have been verified"),
                etag(finalState(a, client)),
                expected);
    }

    private Map<String, Object> rating() {
        return new LinkedHashMap<>(
                Map.of(
                        "overallRating",
                        5,
                        "qualityRating",
                        4,
                        "communicationRating",
                        5,
                        "timelinessRating",
                        3,
                        "comment",
                        "Delivered the agreed portfolio with clear documentation."));
    }

    private MvcResult review(
            MvcResult a, TokenResponse actor, Map<String, Object> input, int expected)
            throws Exception {
        return call(post("/api/assignments/" + id(a) + "/review"), actor, input, null, expected);
    }

    private byte[] row(String table, long id) throws Exception {
        String key = table.equals("freelancer_profiles") ? "user_id" : "id";
        return json.writeValueAsBytes(
                jdbc.queryForMap("SELECT * FROM dbo." + table + " WHERE " + key + "=?", id));
    }

    private Map<String, String> history() throws Exception {
        var result = new TreeMap<>(fingerprint());
        for (String table :
                List.of("assignments", "jobs", "audit_logs", "final_acceptances", "reviews"))
            result.remove(table);
        return result;
    }

    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.EnumSource(
            value = com.linkit.projects.entity.Assignment.Status.class,
            names = {"ACTIVE", "AWAITING_ACCEPTANCE"})
    void completesAssignmentAndJobAtomicallyAndPreservesHistory(
            com.linkit.projects.entity.Assignment.Status status) throws Exception {
        var a = ready();
        jdbc.update("UPDATE dbo.assignments SET status=? WHERE id=?", status.name(), id(a));
        var optional = taskBody("100", 2);
        optional.put("isRequired", false);
        if (status == com.linkit.projects.entity.Assignment.Status.ACTIVE)
            call(post("/api/assignments/" + id(a) + "/milestones"), client, optional, null, 201);
        var before = history();
        var pending = finalState(a, freelancer);
        assertThat(node(pending).path("accepted").asBoolean()).isFalse();
        assertThat(node(pending).path("acceptance").isNull()).isTrue();
        var done = finish(a, client, 201);
        assertThat(node(done).path("accepted").asBoolean()).isTrue();
        assertThat(node(done).path("assignmentStatus").asText()).isEqualTo("COMPLETED");
        assertThat(node(done).path("acceptance").path("acceptedBy").asLong())
                .isEqualTo(client.user().id());
        assertThat(etag(done)).isNotEqualTo(etag(pending));
        var assigned = node(assignmentGet(id(a)));
        assertThat(assigned.path("completedAt").asText())
                .isEqualTo(node(done).path("acceptance").path("acceptedAt").asText());
        assertThat(
                        jdbc.queryForObject(
                                "SELECT status FROM dbo.jobs WHERE id=?",
                                String.class,
                                node(a).path("jobId").asLong()))
                .isEqualTo("COMPLETED");
        assertThat(history()).isEqualTo(before);
        finish(a, client, 409);
        assertThat(
                        scalar(
                                "SELECT COUNT(*) FROM dbo.final_acceptances WHERE assignment_id=?",
                                id(a)))
                .isEqualTo(1);
        var read = node(finalState(a, freelancer));
        assertThat(read.path("acceptance").path("scopeVersionId").asLong()).isEqualTo(scopeId(a));
    }

    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.EnumSource(
            value = com.linkit.projects.entity.Milestone.Status.class,
            names = {"PLANNED", "IN_PROGRESS", "SUBMITTED", "REVISION_REQUIRED"})
    void currentRequiredUnapprovedBlocksAcceptance(
            com.linkit.projects.entity.Milestone.Status status) throws Exception {
        var a = ready();
        var m = task(a, "100", 2);
        jdbc.update("UPDATE dbo.milestones SET status=? WHERE id=?", status.name(), id(m));
        var before = fingerprint();
        finish(a, client, 409);
        assertThat(fingerprint()).isEqualTo(before);
    }

    @Test
    void ignoresCancelledRequiredAndUnapprovedOptionalMilestonesAndOpenRisks() throws Exception {
        var a = ready();
        var cancelled = task(a, "100", 2);
        cancel(cancelled, 204);
        var in = taskBody("100", 3);
        in.put("isRequired", false);
        var optional =
                call(post("/api/assignments/" + id(a) + "/milestones"), client, in, null, 201);
        deliver(optional, freelancer, 201);
        jdbc.update(
                "UPDATE dbo.scope_versions SET deadline=? WHERE id=?",
                LocalDate.now(ZoneOffset.UTC).plusDays(2),
                scopeId(a));
        evaluate(a, client);
        long risk = alerts(a).get(0).path("id").asLong();
        call(post("/api/risk-alerts/" + risk + "/acknowledge"), client, null, null, 200);
        var before = history();
        finish(a, client, 201);
        assertThat(history()).isEqualTo(before);
        assertThat(
                        jdbc.queryForObject(
                                "SELECT status FROM dbo.risk_alerts WHERE id=?",
                                String.class,
                                risk))
                .isEqualTo("ACKNOWLEDGED");
        assertThat(taskStatus(id(optional))).isEqualTo("SUBMITTED");
    }

    @Test
    void requiresAtLeastOneCurrentRequiredApprovedMilestone() throws Exception {
        var a = active();
        finish(a, client, 409);
        var cancelled = task(a, "100", 1);
        cancel(cancelled, 204);
        finish(a, client, 409);
        var in = taskBody("100", 2);
        in.put("isRequired", false);
        var optional =
                call(post("/api/assignments/" + id(a) + "/milestones"), client, in, null, 201);
        accept(deliver(optional, freelancer, 201), 200);
        finish(a, client, 409);
    }

    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.EnumSource(
            com.linkit.projects.entity.ChangeRequest.Status.class)
    void onlyPendingAndApprovedChangesOnCurrentScopeBlock(
            com.linkit.projects.entity.ChangeRequest.Status status) throws Exception {
        var a = ready();
        var c = change(a, client, "10", 0);
        jdbc.update("UPDATE dbo.change_requests SET status=? WHERE id=?", status.name(), id(c));
        finish(
                a,
                client,
                status == com.linkit.projects.entity.ChangeRequest.Status.PENDING
                                || status
                                        == com.linkit.projects.entity.ChangeRequest.Status.APPROVED
                        ? 409
                        : 201);
    }

    @Test
    void oldRequiredAndOldUnresolvedChangesDoNotReplaceCurrentScopeRequirements() throws Exception {
        var a = ready();
        var oldPending = change(a, client, "10", 0);
        var oldApproved = agreed(change(a, client, "20", 0));
        apply(agreed(change(a, client, "30", 0)), 200);
        finish(a, client, 409);
        var current = task(a, "100", 2);
        accept(deliver(current, freelancer, 201), 200);
        var before = history();
        finish(a, client, 201);
        assertThat(history()).isEqualTo(before);
        assertThat(node(changeGet(id(oldPending))).path("status").asText()).isEqualTo("PENDING");
        assertThat(node(changeGet(id(oldApproved))).path("status").asText()).isEqualTo("APPROVED");
    }

    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.EnumSource(
            value = com.linkit.projects.entity.Assignment.Status.class,
            names = {"PENDING_SCOPE", "COMPLETED", "CANCELLED"})
    void invalidAssignmentStatesBlock(com.linkit.projects.entity.Assignment.Status status)
            throws Exception {
        var a = ready();
        jdbc.update("UPDATE dbo.assignments SET status=? WHERE id=?", status.name(), id(a));
        finish(a, client, 409);
    }

    @Test
    void invalidJobAndMissingLockedScopeBlock() throws Exception {
        var a = ready();
        jdbc.update(
                "UPDATE dbo.jobs SET status='ASSIGNED' WHERE id=?", node(a).path("jobId").asLong());
        finish(a, client, 409);
        jdbc.update(
                "UPDATE dbo.jobs SET status='IN_PROGRESS' WHERE id=?",
                node(a).path("jobId").asLong());
        jdbc.update(
                "UPDATE dbo.scope_versions SET status='SUPERSEDED' WHERE assignment_id=?", id(a));
        finish(a, client, 409);
    }

    @Test
    void acceptanceRbacOwnershipUnknownIdentityAndStaleVersions() throws Exception {
        var a = ready();
        String path = "/api/assignments/" + id(a) + "/final-acceptance";
        var state = finalState(a, client);
        call(get(path), null, null, null, 401);
        call(post(path), null, Map.of(), etag(state), 401);
        call(get(path), otherClient, null, null, 404);
        call(get(path), otherFreelancer, null, null, 404);
        finish(a, freelancer, 403);
        finish(a, otherClient, 404);
        call(post(path), client, Map.of(), null, 400);
        call(post(path), client, Map.of(), "bad", 400);
        call(post(path), client, Map.of("acceptedBy", otherClient.user().id()), etag(state), 400);
        call(post(path), client, Map.of("acceptanceNote", "x".repeat(20001)), etag(state), 422);
        jdbc.update("UPDATE dbo.assignments SET status=status WHERE id=?", id(a));
        call(post(path), client, Map.of(), etag(state), 409);
        finish(a, client, 201);
    }

    @Test
    void reviewOnlyAfterFinalAcceptanceAndCompletedProject() throws Exception {
        var a = ready();
        review(a, client, rating(), 409);
        jdbc.update("UPDATE dbo.assignments SET status='COMPLETED' WHERE id=?", id(a));
        jdbc.update(
                "UPDATE dbo.jobs SET status='COMPLETED' WHERE id=?",
                node(a).path("jobId").asLong());
        review(a, client, rating(), 409);
    }

    @Test
    void reviewIsPrivateClientToFreelancerImmutableAndDoesNotChangeReputation() throws Exception {
        var a = ready();
        finish(a, client, 201);
        var before = row("freelancer_profiles", freelancer.user().id());
        var assignmentBefore = row("assignments", id(a));
        var in = rating();
        in.put("comment", "x".repeat(2000));
        var made = review(a, client, in, 201);
        assertThat(node(made).path("reviewerId").asLong()).isEqualTo(client.user().id());
        assertThat(node(made).path("freelancerId").asLong()).isEqualTo(freelancer.user().id());
        assertThat(node(made).path("overallRating").asInt()).isEqualTo(5);
        assertThat(node(made).path("comment").asText()).hasSize(2000);
        String path = "/api/assignments/" + id(a) + "/review";
        call(get(path), client, null, null, 200);
        call(get(path), freelancer, null, null, 200);
        call(get(path), otherClient, null, null, 404);
        call(get(path), otherFreelancer, null, null, 404);
        call(get(path), null, null, null, 401);
        review(a, freelancer, rating(), 403);
        review(a, otherClient, rating(), 404);
        review(a, client, rating(), 409);
        var admin = account(Role.CLIENT);
        jdbc.update(
                "INSERT dbo.user_roles(user_id,role,assigned_at) VALUES (?,'ADMIN',SYSUTCDATETIME())",
                admin.user().id());
        jdbc.update(
                "DELETE FROM dbo.user_roles WHERE user_id=? AND role='CLIENT'", admin.user().id());
        call(get(path), admin, null, null, 200);
        review(a, admin, rating(), 403);
        call(put(path), client, rating(), null, 403);
        call(delete(path), client, null, null, 403);
        assertThat(row("freelancer_profiles", freelancer.user().id())).isEqualTo(before);
        assertThat(row("assignments", id(a))).isEqualTo(assignmentBefore);
    }

    @Test
    void reviewValidatesEveryScoreFractionalInputCommentAndUnknownFields() throws Exception {
        var a = ready();
        finish(a, client, 201);
        for (String field :
                List.of(
                        "overallRating",
                        "qualityRating",
                        "communicationRating",
                        "timelinessRating")) {
            for (Object bad : List.of(0, 6, 1.5)) {
                var in = rating();
                in.put(field, bad);
                review(a, client, in, 422);
            }
            var missing = rating();
            missing.remove(field);
            review(a, client, missing, 422);
        }
        var in = rating();
        in.put("comment", "x".repeat(2001));
        review(a, client, in, 422);
        in = rating();
        in.put("freelancerId", otherFreelancer.user().id());
        review(a, client, in, 400);
        call(get("/api/assignments/" + id(a) + "/review"), client, null, null, 404);
        in = rating();
        in.remove("comment");
        in.put("overallRating", 1);
        in.put("qualityRating", 1);
        review(a, client, in, 201);
    }

    @Test
    void concurrentAcceptanceCreatesExactlyOneRecord() throws Exception {
        var a = ready();
        String path = "/api/assignments/" + id(a) + "/final-acceptance";
        String version = etag(finalState(a, client));
        assertThat(
                        race(
                                () -> raw(post(path), client, Map.of(), version),
                                () -> raw(post(path), client, Map.of(), version)))
                .containsExactlyInAnyOrder(201, 409);
        assertThat(
                        scalar(
                                "SELECT COUNT(*) FROM dbo.final_acceptances WHERE assignment_id=?",
                                id(a)))
                .isEqualTo(1);
    }

    @Test
    void acceptanceRacingChangeCreationLeavesAConsistentWinner() throws Exception {
        var a = ready();
        String version = etag(finalState(a, client));
        var result =
                race(
                        () ->
                                raw(
                                        post("/api/assignments/" + id(a) + "/final-acceptance"),
                                        client,
                                        Map.of(),
                                        version),
                        () ->
                                raw(
                                        post("/api/assignments/" + id(a) + "/change-requests"),
                                        client,
                                        changeBody("10", 0),
                                        null));
        assertThat(result).containsExactlyInAnyOrder(201, 409);
        long finalCount =
                scalar("SELECT COUNT(*) FROM dbo.final_acceptances WHERE assignment_id=?", id(a));
        long changes =
                scalar("SELECT COUNT(*) FROM dbo.change_requests WHERE assignment_id=?", id(a));
        assertThat(finalCount + changes).isEqualTo(1);
    }

    @Test
    void concurrentReviewCreatesExactlyOneRecord() throws Exception {
        var a = ready();
        finish(a, client, 201);
        String path = "/api/assignments/" + id(a) + "/review";
        assertThat(
                        race(
                                () -> raw(post(path), client, rating(), null),
                                () -> raw(post(path), client, rating(), null)))
                .containsExactlyInAnyOrder(201, 409);
        assertThat(scalar("SELECT COUNT(*) FROM dbo.reviews WHERE assignment_id=?", id(a)))
                .isEqualTo(1);
    }

    @Test
    void lateFailuresRollbackAcceptanceCompletionReviewAndAllVersions() throws Exception {
        var a = ready();
        var before = fingerprint();
        doThrow(
                        new org.springframework.dao.DataIntegrityViolationException(
                                "test late acceptance failure"))
                .when(audit)
                .flush();
        try {
            finish(a, client, 409);
        } finally {
            reset(audit);
        }
        assertThat(fingerprint()).isEqualTo(before);
        finish(a, client, 201);
        before = fingerprint();
        doThrow(
                        new org.springframework.dao.DataIntegrityViolationException(
                                "test late review failure"))
                .when(audit)
                .flush();
        try {
            review(a, client, rating(), 409);
        } finally {
            reset(audit);
        }
        assertThat(fingerprint()).isEqualTo(before);
        review(a, client, rating(), 201);
    }

    @Test
    void databaseUniquenessRatingsAndAcceptancePrerequisiteAreReal() throws Exception {
        var a = ready();
        assertThatThrownBy(
                        () ->
                                new TransactionTemplate(transactions)
                                        .executeWithoutResult(
                                                t ->
                                                        jdbc.update(
                                                                "INSERT dbo.reviews(assignment_id,reviewer_id,freelancer_id,overall_rating,quality_rating,communication_rating,timeliness_rating,created_at) VALUES (?,?,?,5,5,5,5,SYSUTCDATETIME())",
                                                                idUnchecked(a),
                                                                client.user().id(),
                                                                freelancer.user().id())))
                .isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
        finish(a, client, 201);
        review(a, client, rating(), 201);
        assertThatThrownBy(
                        () ->
                                new TransactionTemplate(transactions)
                                        .executeWithoutResult(
                                                t ->
                                                        jdbc.update(
                                                                "INSERT dbo.final_acceptances(assignment_id,scope_version_id,accepted_by,accepted_at) SELECT assignment_id,scope_version_id,accepted_by,accepted_at FROM dbo.final_acceptances WHERE assignment_id=?",
                                                                idUnchecked(a))))
                .isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
        assertThatThrownBy(
                        () ->
                                new TransactionTemplate(transactions)
                                        .executeWithoutResult(
                                                t ->
                                                        jdbc.update(
                                                                "INSERT dbo.reviews(assignment_id,reviewer_id,freelancer_id,overall_rating,quality_rating,communication_rating,timeliness_rating,created_at) SELECT assignment_id,reviewer_id,freelancer_id,5,5,5,5,created_at FROM dbo.reviews WHERE assignment_id=?",
                                                                idUnchecked(a))))
                .isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
        assertThatThrownBy(
                        () ->
                                new TransactionTemplate(transactions)
                                        .executeWithoutResult(
                                                t ->
                                                        jdbc.update(
                                                                "UPDATE dbo.reviews SET overall_rating=6 WHERE assignment_id=?",
                                                                idUnchecked(a))))
                .isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
    }

    private long idUnchecked(MvcResult result) {
        try {
            return id(result);
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }
}
