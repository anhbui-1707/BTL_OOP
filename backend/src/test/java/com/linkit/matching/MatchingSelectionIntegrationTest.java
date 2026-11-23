package com.linkit.matching;

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
@EnabledIfEnvironmentVariable(named = "LINKIT_SELECTION_TEST", matches = "true")
class MatchingSelectionIntegrationTest {
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
    private final String marker = "selection-it-" + UUID.randomUUID();
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

    @Test
    void currentRankingIsCorrectPagedPrivateAndGetDoesNotWriteSnapshots() throws Exception {
        var job = job(client, true);
        availability(otherFreelancer, "BUSY");
        experienced(freelancer);
        var low = body();
        low.put("proposedBudget", 40000000);
        call(post("/api/jobs/" + job.id() + "/proposals"), otherFreelancer, low, null, 201);
        var high = submit(job.id(), freelancer);
        JsonNode page =
                node(
                        call(
                                get("/api/jobs/" + job.id() + "/candidates").param("size", "1"),
                                client,
                                null,
                                null,
                                200));
        assertThat(page.path("totalElements").asInt()).isEqualTo(2);
        assertThat(page.path("totalPages").asInt()).isEqualTo(2);
        assertThat(page.path("content").get(0).path("proposalId").asLong()).isEqualTo(id(high));
        assertThat(page.path("content").get(0).path("score").path("total").asInt()).isEqualTo(100);
        assertThat(
                        jdbc.queryForObject(
                                "SELECT COUNT(*) FROM dbo.compatibility_scores WHERE job_id=?",
                                Integer.class,
                                job.id()))
                .isZero();
        var saved =
                node(
                        call(
                                post("/api/jobs/" + job.id() + "/matching-scores")
                                        .param("page", "1")
                                        .param("size", "1"),
                                client,
                                null,
                                null,
                                200));
        assertThat(saved.path("content").get(0).path("score").path("total").asInt()).isEqualTo(5);
        assertThat(
                        jdbc.queryForObject(
                                "SELECT COUNT(*) FROM dbo.compatibility_scores WHERE job_id=? AND rules_version='matching-v1' AND ISJSON(breakdown_json)=1",
                                Integer.class,
                                job.id()))
                .isEqualTo(2);
        call(post("/api/jobs/" + job.id() + "/matching-scores"), client, null, null, 200);
        assertThat(
                        jdbc.queryForObject(
                                "SELECT COUNT(*) FROM dbo.compatibility_scores WHERE job_id=?",
                                Integer.class,
                                job.id()))
                .isEqualTo(4);
        call(get("/api/jobs/" + job.id() + "/candidates"), otherClient, null, null, 403);
        call(get("/api/jobs/" + job.id() + "/candidates"), freelancer, null, null, 403);
    }

    @Test
    void selectionAtomicallyAcceptsCreatesAssignmentRejectsOnlyOtherPendingAndKeepsHistory()
            throws Exception {
        var job = job(client, true);
        var chosen = submit(job.id(), freelancer);
        var pending = submit(job.id(), otherFreelancer);
        var rejectedUser = account(Role.FREELANCER);
        var withdrawnUser = account(Role.FREELANCER);
        var rejected = submit(job.id(), rejectedUser);
        reject(rejected, client, 200);
        var withdrawn = submit(job.id(), withdrawnUser);
        call(
                post("/api/proposals/" + id(withdrawn) + "/withdraw"),
                withdrawnUser,
                null,
                etag(withdrawn),
                200);
        var assignment = select(chosen, client, 201);
        long assignmentId = id(assignment);
        assertThat(node(assignment).path("status").asText()).isEqualTo("PENDING_SCOPE");
        assertThat(node(assignment).path("startedAt").isNull()).isTrue();
        assertThat(node(assignment).path("agreedBudget").decimalValue())
                .isEqualByComparingTo("1234567.89");
        assertThat(
                        jdbc.queryForObject(
                                "SELECT status FROM dbo.jobs WHERE id=?", String.class, job.id()))
                .isEqualTo("ASSIGNED");
        assertThat(
                        jdbc.queryForObject(
                                "SELECT status FROM dbo.proposals WHERE id=?",
                                String.class,
                                id(chosen)))
                .isEqualTo("ACCEPTED");
        assertThat(
                        jdbc.queryForObject(
                                "SELECT status FROM dbo.proposals WHERE id=?",
                                String.class,
                                id(pending)))
                .isEqualTo("REJECTED");
        assertThat(
                        jdbc.queryForObject(
                                "SELECT status FROM dbo.proposals WHERE id=?",
                                String.class,
                                id(rejected)))
                .isEqualTo("REJECTED");
        assertThat(
                        jdbc.queryForObject(
                                "SELECT status FROM dbo.proposals WHERE id=?",
                                String.class,
                                id(withdrawn)))
                .isEqualTo("WITHDRAWN");
        assertThat(
                        jdbc.queryForObject(
                                "SELECT COUNT(*) FROM dbo.scope_versions WHERE assignment_id=?",
                                Integer.class,
                                assignmentId))
                .isZero();
        assertThat(
                        jdbc.queryForObject(
                                "SELECT COUNT(*) FROM dbo.compatibility_scores WHERE job_id=? AND freelancer_id=?",
                                Integer.class,
                                job.id(),
                                freelancer.user().id()))
                .isEqualTo(1);
        select(chosen, client, 409);
    }

    @Test
    void busyLowScoreFreelancerCanBeSelectedWithoutThreshold() throws Exception {
        var job = job(client, true);
        availability(freelancer, "BUSY");
        var low = body();
        low.put("proposedBudget", 40000000);
        var proposal =
                call(post("/api/jobs/" + job.id() + "/proposals"), freelancer, low, null, 201);
        select(proposal, client, 201);
        assertThat(
                        jdbc.queryForObject(
                                "SELECT score FROM dbo.compatibility_scores WHERE job_id=?",
                                java.math.BigDecimal.class,
                                job.id()))
                .isEqualByComparingTo("5");
    }

    @ParameterizedTest
    @org.junit.jupiter.params.provider.ValueSource(
            strings = {"UNAVAILABLE", "LOCKED", "DISABLED", "ROLE_MISSING"})
    void invalidFreelancersCannotBeSelectedAndDoNotCreatePartialData(String invalid)
            throws Exception {
        var job = job(client, true);
        var proposal = submit(job.id(), freelancer);
        if (invalid.equals("UNAVAILABLE")) availability(freelancer, invalid);
        else if (invalid.equals("ROLE_MISSING"))
            jdbc.update("DELETE dbo.user_roles WHERE user_id=?", freelancer.user().id());
        else
            jdbc.update(
                    "UPDATE dbo.users SET status=? WHERE id=?", invalid, freelancer.user().id());
        var candidates =
                node(call(get("/api/jobs/" + job.id() + "/candidates"), client, null, null, 200));
        assertThat(candidates.path("content").get(0).path("selectable").asBoolean()).isFalse();
        select(proposal, client, 409);
        assertThat(
                        jdbc.queryForObject(
                                "SELECT COUNT(*) FROM dbo.assignments WHERE job_id=?",
                                Integer.class,
                                job.id()))
                .isZero();
        assertThat(
                        jdbc.queryForObject(
                                "SELECT COUNT(*) FROM dbo.compatibility_scores WHERE job_id=?",
                                Integer.class,
                                job.id()))
                .isZero();
        assertThat(
                        jdbc.queryForObject(
                                "SELECT status FROM dbo.proposals WHERE id=?",
                                String.class,
                                id(proposal)))
                .isEqualTo("PENDING");
    }

    @ParameterizedTest
    @EnumSource(
            value = Proposal.Status.class,
            names = {"REJECTED", "WITHDRAWN", "ACCEPTED"})
    void onlyPendingCanBeSelected(Proposal.Status status) throws Exception {
        var job = job(client, true);
        var proposal = submit(job.id(), freelancer);
        jdbc.update("UPDATE dbo.proposals SET status=? WHERE id=?", status.name(), id(proposal));
        select(detail(id(proposal), client), client, 409);
    }

    @ParameterizedTest
    @EnumSource(
            value = Job.Status.class,
            names = {"DRAFT", "CANCELLED", "ASSIGNED", "IN_PROGRESS", "COMPLETED", "CLOSED"})
    void onlyOpenJobsCanBeSelected(Job.Status status) throws Exception {
        var job = job(client, true);
        var proposal = submit(job.id(), freelancer);
        jdbc.update("UPDATE dbo.jobs SET status=? WHERE id=?", status.name(), job.id());
        select(proposal, client, 409);
    }

    @Test
    void ownershipRbacEtagsAndParametersAreValidated() throws Exception {
        var job = job(client, true);
        var proposal = submit(job.id(), freelancer);
        select(proposal, otherClient, 403);
        select(proposal, freelancer, 403);
        call(post("/api/proposals/" + id(proposal) + "/select"), null, null, etag(proposal), 401);
        call(post("/api/proposals/" + id(proposal) + "/select"), client, null, null, 400);
        call(post("/api/proposals/" + id(proposal) + "/select"), client, null, "*", 400);
        call(
                post("/api/proposals/" + id(proposal) + "/select"),
                client,
                null,
                "\"AAAAAAAAAAA=\"",
                409);
        call(
                get("/api/jobs/" + job.id() + "/candidates").param("size", "101"),
                client,
                null,
                null,
                422);
        call(get("/api/assignments"), null, null, null, 401);
    }

    @Test
    void assignmentsArePrivateToPartiesAndAdminCanAuditWithScopedPagination() throws Exception {
        var job = job(client, true);
        var proposal = submit(job.id(), freelancer);
        var assignment = select(proposal, client, 201);
        long id = id(assignment);
        for (var actor : List.of(client, freelancer))
            call(get("/api/assignments/" + id), actor, null, null, 200);
        for (var actor : List.of(otherClient, otherFreelancer))
            call(get("/api/assignments/" + id), actor, null, null, 404);
        assertThat(
                        node(call(get("/api/assignments"), client, null, null, 200))
                                .path("totalElements")
                                .asInt())
                .isEqualTo(1);
        assertThat(
                        node(call(get("/api/assignments"), otherFreelancer, null, null, 200))
                                .path("totalElements")
                                .asInt())
                .isZero();
        var admin = account(Role.CLIENT);
        jdbc.update("UPDATE dbo.user_roles SET role='ADMIN' WHERE user_id=?", admin.user().id());
        call(get("/api/assignments/" + id), admin, null, null, 200);
        assertThat(
                        node(call(
                                        get("/api/assignments").param("size", "1"),
                                        admin,
                                        null,
                                        null,
                                        200))
                                .path("totalElements")
                                .asInt())
                .isEqualTo(31);
        assertThat(
                        node(call(
                                        get("/api/assignments").param("status", "PENDING_SCOPE"),
                                        client,
                                        null,
                                        null,
                                        200))
                                .path("content")
                                .get(0)
                                .has("passwordHash"))
                .isFalse();
        call(post("/api/proposals/" + id(proposal) + "/select"), admin, null, etag(proposal), 403);
    }

    @Test
    void assignmentFailureRollsBackMatchingAllProposalsJobAndAudits() throws Exception {
        var job = job(client, true);
        var proposal = submit(job.id(), freelancer);
        var other = submit(job.id(), otherFreelancer);
        long auditBefore =
                jdbc.queryForObject("SELECT COUNT_BIG(*) FROM dbo.audit_logs", Long.class);
        doThrow(
                        new org.springframework.dao.DataIntegrityViolationException(
                                "simulated assignment failure"))
                .when(assignmentRepo)
                .saveAndFlush(any(com.linkit.projects.entity.Assignment.class));
        select(proposal, client, 409);
        assertThat(
                        jdbc.queryForObject(
                                "SELECT status FROM dbo.jobs WHERE id=?", String.class, job.id()))
                .isEqualTo("OPEN");
        for (var p : List.of(proposal, other))
            assertThat(node(detail(id(p), client))).isEqualTo(node(p));
        assertThat(
                        jdbc.queryForObject(
                                "SELECT COUNT(*) FROM dbo.assignments WHERE job_id=?",
                                Integer.class,
                                job.id()))
                .isZero();
        assertThat(
                        jdbc.queryForObject(
                                "SELECT COUNT(*) FROM dbo.compatibility_scores WHERE job_id=?",
                                Integer.class,
                                job.id()))
                .isZero();
        assertThat(jdbc.queryForObject("SELECT COUNT_BIG(*) FROM dbo.audit_logs", Long.class))
                .isEqualTo(auditBefore);
    }

    @Test
    void concurrentSelectionsHaveExactlyOneAssignmentAndAcceptedProposal() throws Exception {
        var job = job(client, true);
        var first = submit(job.id(), freelancer);
        var second = submit(job.id(), otherFreelancer);
        try (ExecutorService pool = Executors.newFixedThreadPool(2)) {
            CountDownLatch start = new CountDownLatch(1);
            Callable<Integer> a =
                    () -> {
                        start.await();
                        return mvc.perform(
                                        request(
                                                post("/api/proposals/" + id(first) + "/select"),
                                                client,
                                                null,
                                                etag(first)))
                                .andReturn()
                                .getResponse()
                                .getStatus();
                    };
            Callable<Integer> b =
                    () -> {
                        start.await();
                        return mvc.perform(
                                        request(
                                                post("/api/proposals/" + id(second) + "/select"),
                                                client,
                                                null,
                                                etag(second)))
                                .andReturn()
                                .getResponse()
                                .getStatus();
                    };
            Future<Integer> one = pool.submit(a), two = pool.submit(b);
            start.countDown();
            assertThat(List.of(one.get(20, TimeUnit.SECONDS), two.get(20, TimeUnit.SECONDS)))
                    .containsExactlyInAnyOrder(201, 409);
        }
        assertThat(
                        jdbc.queryForObject(
                                "SELECT COUNT(*) FROM dbo.assignments WHERE job_id=?",
                                Integer.class,
                                job.id()))
                .isEqualTo(1);
        assertThat(
                        jdbc.queryForObject(
                                "SELECT COUNT(*) FROM dbo.proposals WHERE job_id=? AND status='ACCEPTED'",
                                Integer.class,
                                job.id()))
                .isEqualTo(1);
        assertThat(
                        jdbc.queryForObject(
                                "SELECT COUNT(*) FROM dbo.proposals WHERE job_id=? AND status='REJECTED'",
                                Integer.class,
                                job.id()))
                .isEqualTo(1);
    }

    @Test
    void databaseUniqueJobConstraintRemainsTheFinalRaceGuard() throws Exception {
        var job = job(client, true);
        var proposal = submit(job.id(), freelancer);
        var other = submit(job.id(), otherFreelancer);
        select(proposal, client, 201);
        assertThatThrownBy(
                        () ->
                                jdbc.update(
                                        "INSERT dbo.assignments(job_id,proposal_id,client_id,freelancer_id,agreed_budget,currency_code,status,created_at) VALUES (?,?,?,?,100,'VND','PENDING_SCOPE',SYSUTCDATETIME())",
                                        job.id(),
                                        id(other),
                                        client.user().id(),
                                        otherFreelancer.user().id()))
                .isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
        assertThat(
                        jdbc.queryForObject(
                                "SELECT COUNT(*) FROM dbo.assignments WHERE job_id=?",
                                Integer.class,
                                job.id()))
                .isEqualTo(1);
    }

    @Test
    void lateAuditFailureRollsBackAlreadyFlushedAssignmentAndAssignedJob() throws Exception {
        var job = job(client, true);
        var selected = submit(job.id(), freelancer);
        var other = submit(job.id(), otherFreelancer);
        long before = jdbc.queryForObject("SELECT COUNT_BIG(*) FROM dbo.audit_logs", Long.class);
        doThrow(
                        new org.springframework.dao.DataIntegrityViolationException(
                                "simulated late audit failure"))
                .when(audit)
                .flush();
        select(selected, client, 409);
        assertThat(
                        jdbc.queryForObject(
                                "SELECT status FROM dbo.jobs WHERE id=?", String.class, job.id()))
                .isEqualTo("OPEN");
        for (var proposal : List.of(selected, other))
            assertThat(node(detail(id(proposal), client))).isEqualTo(node(proposal));
        assertThat(
                        jdbc.queryForObject(
                                "SELECT COUNT(*) FROM dbo.assignments WHERE job_id=?",
                                Integer.class,
                                job.id()))
                .isZero();
        assertThat(
                        jdbc.queryForObject(
                                "SELECT COUNT(*) FROM dbo.compatibility_scores WHERE job_id=?",
                                Integer.class,
                                job.id()))
                .isZero();
        assertThat(jdbc.queryForObject("SELECT COUNT_BIG(*) FROM dbo.audit_logs", Long.class))
                .isEqualTo(before);
    }
}
