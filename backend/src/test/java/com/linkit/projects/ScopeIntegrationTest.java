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
@EnabledIfEnvironmentVariable(named = "LINKIT_SCOPE_TEST", matches = "true")
class ScopeIntegrationTest {
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
    private final String marker = "scope-it-" + UUID.randomUUID();
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

    @Test
    void defaultsBothPartiesApproveSameVersionAndActivateAtomically() throws Exception {
        var a = assignment();
        long job = node(a).path("jobId").asLong();
        var s = create(a, freelancer, Map.of(), 201);
        assertThat(
                        node(call(get("/api/jobs/" + job), freelancer, null, null, 200))
                                .path("status")
                                .asText())
                .isEqualTo("ASSIGNED");
        var stored = node(s);
        assertThat(stored.path("versionNumber").asInt()).isEqualTo(1);
        assertThat(stored.path("budget").decimalValue())
                .isEqualByComparingTo(node(a).path("agreedBudget").decimalValue());
        assertThat(stored.path("deliverables").asText())
                .isEqualTo(
                        jdbc.queryForObject(
                                "SELECT deliverables FROM dbo.jobs WHERE id=?", String.class, job));
        assertThat(stored.path("acceptanceCriteria").asText())
                .isEqualTo(
                        jdbc.queryForObject(
                                "SELECT acceptance_criteria FROM dbo.jobs WHERE id=?",
                                String.class,
                                job));
        assertThat(stored.path("deadline").asText())
                .isEqualTo(
                        jdbc.queryForObject(
                                "SELECT CONVERT(varchar(10),deadline,23) FROM dbo.jobs WHERE id=?",
                                String.class,
                                job));
        assertThat(stored.path("createdBy").asLong()).isEqualTo(freelancer.user().id());
        assertThat(etag(s)).isNotEqualTo(etag(a));
        var pending = send(s, client, 200);
        var first = approve(pending, freelancer, 200);
        assertThat(node(first).path("status").asText()).isEqualTo("PENDING_APPROVAL");
        assertThat(node(first).path("approvals").size()).isEqualTo(1);
        assertThat(node(assignmentGet(id(a))).path("status").asText()).isEqualTo("PENDING_SCOPE");
        approve(first, freelancer, 409);
        var locked = approve(first, client, 200);
        assertThat(node(locked).path("status").asText()).isEqualTo("LOCKED");
        assertThat(node(locked).path("approvals").size()).isEqualTo(2);
        assertThat(node(locked).path("lockedAt").isNull()).isFalse();
        var active = node(assignmentGet(id(a)));
        assertThat(active.path("status").asText()).isEqualTo("ACTIVE");
        assertThat(active.path("startedAt").asText())
                .isEqualTo(node(locked).path("lockedAt").asText());
        assertThat(jdbc.queryForObject("SELECT status FROM dbo.jobs WHERE id=?", String.class, job))
                .isEqualTo("IN_PROGRESS");
        for (var reader : List.of(client, freelancer))
            assertThat(
                            node(call(get("/api/jobs/" + job), reader, null, null, 200))
                                    .path("status")
                                    .asText())
                    .isEqualTo("IN_PROGRESS");
        call(get("/api/jobs/" + job), otherFreelancer, null, null, 404);
        assertThat(
                        jdbc.queryForObject(
                                "SELECT COUNT(*) FROM dbo.milestones WHERE assignment_id=?",
                                Integer.class,
                                id(a)))
                .isZero();
        approve(locked, client, 409);
        send(locked, client, 409);
        create(assignmentGet(id(a)), client, Map.of(), 409);
        call(
                put("/api/scopes/" + id(s)),
                client,
                Map.of("deliverables", "overwrite"),
                etag(locked),
                403);
    }

    @Test
    void newVersionSupersedesPendingPreservesApprovalsAndRequiresFreshConsent() throws Exception {
        var a = assignment();
        var first = approve(send(create(a, client, Map.of(), 201), freelancer, 200), client, 200);
        var second =
                create(
                        assignmentGet(id(a)),
                        freelancer,
                        Map.of(
                                "deliverables",
                                "New agreed deliverables",
                                "budget",
                                9876.54,
                                "deadline",
                                "2027-12-01"),
                        201);
        assertThat(node(second).path("versionNumber").asInt()).isEqualTo(2);
        assertThat(node(second).path("approvals").size()).isZero();
        var old = scopeGet(id(first), client);
        assertThat(node(old).path("status").asText()).isEqualTo("SUPERSEDED");
        assertThat(node(old).path("approvals").size()).isEqualTo(1);
        approve(old, freelancer, 409);
        send(old, client, 409);
        var pending = send(second, freelancer, 200);
        var partial = approve(pending, freelancer, 200);
        assertThat(node(partial).path("status").asText()).isEqualTo("PENDING_APPROVAL");
        approve(partial, client, 200);
        var page =
                node(
                        call(
                                get("/api/assignments/" + id(a) + "/scopes").param("size", "1"),
                                client,
                                null,
                                null,
                                200));
        assertThat(page.path("totalElements").asInt()).isEqualTo(2);
        assertThat(page.path("content").get(0).path("id").asLong()).isEqualTo(id(second));
    }

    @Test
    void draftReplacementCopiesLatestContentAndCannotApproveDraft() throws Exception {
        var a = assignment();
        var first = create(a, client, Map.of("exclusions", "Hosting excluded"), 201);
        approve(first, freelancer, 409);
        var second = create(assignmentGet(id(a)), freelancer, Map.of(), 201);
        assertThat(node(scopeGet(id(first), client)).path("status").asText())
                .isEqualTo("SUPERSEDED");
        assertThat(node(second).path("exclusions").asText()).isEqualTo("Hosting excluded");
    }

    @Test
    void privacyRbacJwtAndValidation() throws Exception {
        var a = assignment();
        var s = create(a, client, Map.of(), 201);
        call(get("/api/scopes/" + id(s)), null, null, null, 401);
        call(get("/api/scopes/" + id(s)), otherClient, null, null, 404);
        call(get("/api/scopes/" + id(s)), otherFreelancer, null, null, 404);
        call(get("/api/assignments/" + id(a) + "/scopes"), otherFreelancer, null, null, 404);
        create(assignmentGet(id(a)), otherClient, Map.of(), 404);
        send(s, otherFreelancer, 404);
        approve(s, otherClient, 404);
        var admin = account(Role.CLIENT);
        jdbc.update(
                "INSERT dbo.user_roles(user_id,role,assigned_at) VALUES (?,'ADMIN',SYSUTCDATETIME())",
                admin.user().id());
        call(get("/api/scopes/" + id(s)), admin, null, null, 404);
        jdbc.update(
                "DELETE FROM dbo.user_roles WHERE user_id=? AND role='CLIENT'", admin.user().id());
        call(get("/api/scopes/" + id(s)), admin, null, null, 403);
        call(post("/api/assignments/" + id(a) + "/scopes"), client, Map.of(), null, 400);
        call(post("/api/assignments/" + id(a) + "/scopes"), client, Map.of(), "invalid", 400);
        create(a, client, Map.of(), 409);
        var current = assignmentGet(id(a));
        create(current, client, Map.of("userId", freelancer.user().id()), 400);
        create(current, client, Map.of("budget", -1), 422);
        create(current, client, Map.of("budget", 1.234), 422);
        create(current, client, Map.of("deliverables", "   "), 422);
        create(current, client, Map.of("acceptanceCriteria", ""), 422);
        create(current, client, Map.of("deadline", "+10000-01-01"), 422);
        call(
                get("/api/assignments/" + id(a) + "/scopes").param("size", "101"),
                client,
                null,
                null,
                422);
        var pending = send(s, freelancer, 200);
        var approved =
                call(
                        post("/api/scopes/" + id(s) + "/approve"),
                        client,
                        Map.of("userId", otherClient.user().id()),
                        etag(pending),
                        200);
        assertThat(node(approved).path("approvals").get(0).path("userId").asLong())
                .isEqualTo(client.user().id());
    }

    @Test
    void concurrentApprovalsRequireFreshVersionThenLockExactlyOnce() throws Exception {
        var a = assignment();
        var s = send(create(a, client, Map.of(), 201), client, 200);
        var gate = new CountDownLatch(1);
        var pool = Executors.newFixedThreadPool(2);
        try {
            var f1 =
                    pool.submit(
                            () -> {
                                gate.await();
                                return mvc.perform(
                                                request(
                                                        post("/api/scopes/" + id(s) + "/approve"),
                                                        client,
                                                        null,
                                                        etag(s)))
                                        .andReturn()
                                        .getResponse()
                                        .getStatus();
                            });
            var f2 =
                    pool.submit(
                            () -> {
                                gate.await();
                                return mvc.perform(
                                                request(
                                                        post("/api/scopes/" + id(s) + "/approve"),
                                                        freelancer,
                                                        null,
                                                        etag(s)))
                                        .andReturn()
                                        .getResponse()
                                        .getStatus();
                            });
            gate.countDown();
            int first = f1.get(30, TimeUnit.SECONDS), second = f2.get(30, TimeUnit.SECONDS);
            assertThat(List.of(first, second)).containsExactlyInAnyOrder(200, 409);
            approve(scopeGet(id(s), client), first == 200 ? freelancer : client, 200);
            assertThat(
                            jdbc.queryForObject(
                                    "SELECT COUNT(*) FROM dbo.scope_versions WHERE assignment_id=? AND status='LOCKED'",
                                    Integer.class,
                                    id(a)))
                    .isEqualTo(1);
            assertThat(
                            jdbc.queryForObject(
                                    "SELECT COUNT(*) FROM dbo.scope_approvals WHERE scope_version_id=?",
                                    Integer.class,
                                    id(s)))
                    .isEqualTo(2);
        } finally {
            pool.shutdownNow();
        }
    }

    @Test
    void samePartyConcurrentApprovalCreatesOnlyOneDecision() throws Exception {
        var a = assignment();
        var s = send(create(a, client, Map.of(), 201), client, 200);
        var gate = new CountDownLatch(1);
        var pool = Executors.newFixedThreadPool(2);
        try {
            Callable<Integer> task =
                    () -> {
                        gate.await();
                        return mvc.perform(
                                        request(
                                                post("/api/scopes/" + id(s) + "/approve"),
                                                client,
                                                null,
                                                etag(s)))
                                .andReturn()
                                .getResponse()
                                .getStatus();
                    };
            var one = pool.submit(task);
            var two = pool.submit(task);
            gate.countDown();
            assertThat(List.of(one.get(30, TimeUnit.SECONDS), two.get(30, TimeUnit.SECONDS)))
                    .containsExactlyInAnyOrder(200, 409);
            assertThat(node(scopeGet(id(s), client)).path("status").asText())
                    .isEqualTo("PENDING_APPROVAL");
        } finally {
            pool.shutdownNow();
        }
    }

    @Test
    void concurrentNewVersionsCannotLoseUpdate() throws Exception {
        var a = assignment();
        var gate = new CountDownLatch(1);
        var pool = Executors.newFixedThreadPool(2);
        try {
            Callable<Integer> task =
                    () -> {
                        gate.await();
                        return mvc.perform(
                                        request(
                                                post("/api/assignments/" + id(a) + "/scopes"),
                                                client,
                                                Map.of(),
                                                etag(a)))
                                .andReturn()
                                .getResponse()
                                .getStatus();
                    };
            var one = pool.submit(task);
            var two = pool.submit(task);
            gate.countDown();
            assertThat(List.of(one.get(30, TimeUnit.SECONDS), two.get(30, TimeUnit.SECONDS)))
                    .containsExactlyInAnyOrder(201, 409);
            assertThat(
                            jdbc.queryForObject(
                                    "SELECT COUNT(*) FROM dbo.scope_versions WHERE assignment_id=?",
                                    Integer.class,
                                    id(a)))
                    .isEqualTo(1);
        } finally {
            pool.shutdownNow();
        }
    }

    @Test
    void finalApprovalFailureRollsBackScopeAssignmentJobApprovalVersionAndAudit() throws Exception {
        var a = assignment();
        var first = approve(send(create(a, client, Map.of(), 201), client, 200), client, 200);
        var before = fingerprint();
        doThrow(new org.springframework.dao.DataIntegrityViolationException("test late failure"))
                .when(audit)
                .flush();
        try {
            approve(first, freelancer, 409);
        } finally {
            reset(audit);
        }
        assertThat(fingerprint()).isEqualTo(before);
        approve(first, freelancer, 200);
    }

    @Test
    void replacementAndSubmissionFailuresRollBackAllChanges() throws Exception {
        var a = assignment();
        var s = create(a, client, Map.of(), 201);
        var before = fingerprint();
        doThrow(new org.springframework.dao.DataIntegrityViolationException("test failure"))
                .when(audit)
                .flush();
        try {
            create(assignmentGet(id(a)), freelancer, Map.of("deliverables", "replacement"), 409);
            send(s, client, 409);
        } finally {
            reset(audit);
        }
        assertThat(fingerprint()).isEqualTo(before);
    }

    @ParameterizedTest
    @EnumSource(
            value = com.linkit.projects.entity.Assignment.Status.class,
            names = {"ACTIVE", "AWAITING_ACCEPTANCE", "COMPLETED", "CANCELLED"})
    void invalidAssignmentStatesBlockMutations(com.linkit.projects.entity.Assignment.Status state)
            throws Exception {
        var a = assignment();
        var s = create(a, client, Map.of(), 201);
        jdbc.update("UPDATE dbo.assignments SET status=? WHERE id=?", state.name(), id(a));
        var current = assignmentGet(id(a));
        create(current, client, Map.of(), 409);
        var scope = scopeGet(id(s), client);
        send(scope, client, 409);
        approve(scope, freelancer, 409);
    }

    @Test
    void databaseFilteredUniqueRejectsDoubleLockAndUniqueRejectsDuplicateParty() throws Exception {
        var a = assignment();
        var old = create(a, client, Map.of(), 201);
        var current = create(assignmentGet(id(a)), client, Map.of(), 201);
        var locked = approve(approve(send(current, client, 200), client, 200), freelancer, 200);
        assertThatThrownBy(
                        () ->
                                new TransactionTemplate(transactions)
                                        .executeWithoutResult(
                                                t ->
                                                        jdbc.update(
                                                                "UPDATE dbo.scope_versions SET status='LOCKED' WHERE id=?",
                                                                idUnchecked(old))))
                .isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
        assertThatThrownBy(
                        () ->
                                new TransactionTemplate(transactions)
                                        .executeWithoutResult(
                                                t ->
                                                        jdbc.update(
                                                                "INSERT dbo.scope_approvals(scope_version_id,user_id,party_role,approved_at) VALUES (?,?,'CLIENT',SYSUTCDATETIME())",
                                                                idUnchecked(locked),
                                                                client.user().id())))
                .isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
    }

    @Test
    void incompatibleJobStatusRollsBackSecondApproval() throws Exception {
        var a = assignment();
        var s = approve(send(create(a, client, Map.of(), 201), client, 200), client, 200);
        jdbc.update(
                "UPDATE dbo.jobs SET status='CANCELLED' WHERE id=?",
                node(a).path("jobId").asLong());
        var before = fingerprint();
        approve(s, freelancer, 409);
        assertThat(fingerprint()).isEqualTo(before);
    }

    @Test
    void approvalRacingReplacementNeverCarriesConsentToNewVersion() throws Exception {
        var a = assignment();
        var s = send(create(a, client, Map.of(), 201), client, 200);
        var gate = new CountDownLatch(1);
        var pool = Executors.newFixedThreadPool(2);
        try {
            var one =
                    pool.submit(
                            () -> {
                                gate.await();
                                return mvc.perform(
                                                request(
                                                        post("/api/scopes/" + id(s) + "/approve"),
                                                        client,
                                                        null,
                                                        etag(s)))
                                        .andReturn()
                                        .getResponse()
                                        .getStatus();
                            });
            var two =
                    pool.submit(
                            () -> {
                                gate.await();
                                return mvc.perform(
                                                request(
                                                        post(
                                                                "/api/assignments/"
                                                                        + id(a)
                                                                        + "/scopes"),
                                                        freelancer,
                                                        Map.of(),
                                                        etag(s)))
                                        .andReturn()
                                        .getResponse()
                                        .getStatus();
                            });
            gate.countDown();
            int approved = one.get(30, TimeUnit.SECONDS), created = two.get(30, TimeUnit.SECONDS);
            if (approved == 200) {
                assertThat(created).isEqualTo(409);
                create(assignmentGet(id(a)), freelancer, Map.of(), 201);
            } else {
                assertThat(approved).isEqualTo(409);
                assertThat(created).isEqualTo(201);
            }
            var page =
                    node(
                            call(
                                    get("/api/assignments/" + id(a) + "/scopes"),
                                    client,
                                    null,
                                    null,
                                    200));
            assertThat(page.path("content").get(0).path("approvals").size()).isZero();
            assertThat(page.path("content").get(1).path("status").asText()).isEqualTo("SUPERSEDED");
        } finally {
            pool.shutdownNow();
        }
    }

    private long idUnchecked(MvcResult value) {
        try {
            return id(value);
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }
}
