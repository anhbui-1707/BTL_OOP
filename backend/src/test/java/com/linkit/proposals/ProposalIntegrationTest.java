package com.linkit.proposals;

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
@EnabledIfEnvironmentVariable(named = "LINKIT_PROPOSAL_TEST", matches = "true")
class ProposalIntegrationTest {
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
    private final List<Long> users = new ArrayList<>();
    private final String marker = "proposal-it-" + UUID.randomUUID();
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

    @Test
    void submitAndReadOwnProposalWithoutExposingPrivateEntityFields() throws Exception {
        var job = job(client, true);
        MvcResult result = submit(job.id(), freelancer);
        assertThat(node(result).path("status").asText()).isEqualTo("PENDING");
        assertThat(node(result).path("freelancerId").asLong()).isEqualTo(freelancer.user().id());
        assertThat(result.getResponse().getHeader("Location"))
                .isEqualTo("/api/proposals/" + id(result));
        assertThat(result.getResponse().getHeader("Cache-Control")).contains("no-store");
        assertThat(node(detail(id(result), freelancer)))
                .isEqualTo(node(detail(id(result), client)));
        assertThat(node(result).has("passwordHash")).isFalse();
        assertThat(node(result).has("refreshTokens")).isFalse();
        assertThat(
                        node(call(get("/api/proposals/me"), freelancer, null, null, 200))
                                .path("totalElements")
                                .asInt())
                .isEqualTo(1);
    }

    @ParameterizedTest
    @EnumSource(
            value = Job.Status.class,
            names = {"DRAFT", "CANCELLED", "CLOSED", "ASSIGNED", "IN_PROGRESS", "COMPLETED"})
    void onlyOpenJobsAcceptProposals(Job.Status state) throws Exception {
        var job = job(client, false);
        jdbc.update("UPDATE dbo.jobs SET status=? WHERE id=?", state.name(), job.id());
        call(post("/api/jobs/" + job.id() + "/proposals"), freelancer, body(), null, 409);
        assertThat(
                        jdbc.queryForObject(
                                "SELECT COUNT(*) FROM dbo.proposals WHERE job_id=?",
                                Integer.class,
                                job.id()))
                .isZero();
    }

    @Test
    void duplicateAndResubmissionAfterWithdrawalAreRejected() throws Exception {
        var job = job(client, true);
        MvcResult created = submit(job.id(), freelancer);
        call(post("/api/jobs/" + job.id() + "/proposals"), freelancer, body(), null, 409);
        call(
                post("/api/proposals/" + id(created) + "/withdraw"),
                freelancer,
                null,
                etag(created),
                200);
        call(post("/api/jobs/" + job.id() + "/proposals"), freelancer, body(), null, 409);
    }

    @Test
    void clientMayRejectAndFreelancerMayWithdrawOnlyPending() throws Exception {
        var job = job(client, true);
        MvcResult first = submit(job.id(), freelancer), second = submit(job.id(), otherFreelancer);
        MvcResult rejected = reject(first, client, 200);
        assertThat(node(rejected).path("status").asText()).isEqualTo("REJECTED");
        assertThat(etag(rejected)).isNotEqualTo(etag(first));
        call(
                post("/api/proposals/" + id(rejected) + "/withdraw"),
                freelancer,
                null,
                etag(rejected),
                409);
        MvcResult withdrawn =
                call(
                        post("/api/proposals/" + id(second) + "/withdraw"),
                        otherFreelancer,
                        null,
                        etag(second),
                        200);
        assertThat(node(withdrawn).path("status").asText()).isEqualTo("WITHDRAWN");
        reject(withdrawn, client, 409);
    }

    @Test
    void privacyRbacAndOwnershipAreEnforcedFromJwt() throws Exception {
        var job = job(client, true);
        MvcResult created = submit(job.id(), freelancer);
        long id = id(created);
        call(get("/api/proposals/" + id), otherFreelancer, null, null, 404);
        call(get("/api/proposals/" + id), otherClient, null, null, 404);
        call(get("/api/jobs/" + job.id() + "/proposals"), otherClient, null, null, 403);
        call(get("/api/jobs/" + job.id() + "/proposals"), freelancer, null, null, 403);
        reject(created, otherClient, 403);
        reject(created, freelancer, 403);
        call(post("/api/proposals/" + id + "/withdraw"), otherFreelancer, null, etag(created), 403);
        call(post("/api/proposals/" + id + "/withdraw"), client, null, etag(created), 403);
        call(post("/api/jobs/" + job.id() + "/proposals"), client, body(), null, 403);
        call(get("/api/proposals/me"), client, null, null, 403);
        call(get("/api/proposals/me"), null, null, null, 401);
        call(post("/api/jobs/" + job.id() + "/proposals"), null, body(), null, 401);
        var spoof = body();
        spoof.put("freelancerId", otherFreelancer.user().id());
        call(post("/api/jobs/" + job.id() + "/proposals"), otherFreelancer, spoof, null, 400);
    }

    @Test
    void dualRoleClientCannotApplyToOwnJobAndAdminCannotImpersonateAParty() throws Exception {
        var job = job(client, true);
        new TransactionTemplate(transactions)
                .executeWithoutResult(
                        status -> {
                            jdbc.update(
                                    "INSERT dbo.freelancer_profiles(user_id,years_experience,availability_status,updated_at) VALUES (?,0,'AVAILABLE',SYSUTCDATETIME())",
                                    client.user().id());
                            jdbc.update(
                                    "INSERT dbo.user_roles(user_id,role,assigned_at) VALUES (?,'FREELANCER',SYSUTCDATETIME())",
                                    client.user().id());
                        });
        call(post("/api/jobs/" + job.id() + "/proposals"), client, body(), null, 403);
        TokenResponse admin = account(Role.CLIENT);
        jdbc.update("UPDATE dbo.user_roles SET role='ADMIN' WHERE user_id=?", admin.user().id());
        call(get("/api/jobs/" + job.id() + "/proposals"), admin, null, null, 403);
    }

    @Test
    void paginationAndStatusFiltersRemainOwnershipScoped() throws Exception {
        var firstJob = job(client, true);
        var secondJob = job(otherClient, true);
        var first = submit(firstJob.id(), freelancer);
        submit(firstJob.id(), otherFreelancer);
        submit(secondJob.id(), freelancer);
        reject(first, client, 200);
        var page =
                node(
                        call(
                                get("/api/proposals/me").param("page", "0").param("size", "1"),
                                freelancer,
                                null,
                                null,
                                200));
        assertThat(page.path("totalElements").asInt()).isEqualTo(2);
        assertThat(page.path("totalPages").asInt()).isEqualTo(2);
        assertThat(page.path("content")).hasSize(1);
        assertThat(
                        node(call(
                                        get("/api/proposals/me").param("status", "REJECTED"),
                                        freelancer,
                                        null,
                                        null,
                                        200))
                                .path("totalElements")
                                .asInt())
                .isEqualTo(1);
        assertThat(
                        node(call(
                                        get("/api/jobs/" + firstJob.id() + "/proposals")
                                                .param("status", "PENDING"),
                                        client,
                                        null,
                                        null,
                                        200))
                                .path("totalElements")
                                .asInt())
                .isEqualTo(1);
        call(get("/api/proposals/me").param("page", "-1"), freelancer, null, null, 422);
        call(get("/api/proposals/me").param("size", "101"), freelancer, null, null, 422);
    }

    @Test
    void validationRejectsInvalidDataAndNonRejectedPatchTargets() throws Exception {
        var job = job(client, true);
        var invalid = body();
        invalid.put("estimatedDays", 0);
        call(post("/api/jobs/" + job.id() + "/proposals"), freelancer, invalid, null, 422);
        invalid = body();
        invalid.put("proposedBudget", -1);
        call(post("/api/jobs/" + job.id() + "/proposals"), freelancer, invalid, null, 422);
        invalid = body();
        invalid.put("coverLetter", " ");
        call(post("/api/jobs/" + job.id() + "/proposals"), freelancer, invalid, null, 422);
        var created = submit(job.id(), freelancer);
        for (String state : List.of("ACCEPTED", "WITHDRAWN", "PENDING"))
            call(
                    patch("/api/proposals/" + id(created) + "/status"),
                    client,
                    Map.of("status", state),
                    etag(created),
                    422);
        call(
                patch("/api/proposals/" + id(created) + "/status"),
                client,
                Map.of("status", "SHORTLIST"),
                etag(created),
                400);
        assertThat(node(detail(id(created), client)).path("status").asText()).isEqualTo("PENDING");
    }

    @ParameterizedTest
    @EnumSource(
            value = Proposal.Status.class,
            names = {"ACCEPTED", "REJECTED", "WITHDRAWN"})
    void terminalProposalsCannotBeChanged(Proposal.Status state) throws Exception {
        var created = submit(job(client, true).id(), freelancer);
        jdbc.update("UPDATE dbo.proposals SET status=? WHERE id=?", state.name(), id(created));
        var current = detail(id(created), freelancer);
        reject(current, client, 409);
        call(
                post("/api/proposals/" + id(current) + "/withdraw"),
                freelancer,
                null,
                etag(current),
                409);
    }

    @Test
    void assignmentReferenceBlocksMutationEvenIfPendingStatusIsInconsistent() throws Exception {
        var job = job(client, true);
        var created = submit(job.id(), freelancer);
        jdbc.update(
                "INSERT dbo.assignments(job_id,proposal_id,client_id,freelancer_id,agreed_budget,currency_code,status,created_at) VALUES (?,?,?,?,100,'VND','PENDING_SCOPE',SYSUTCDATETIME())",
                job.id(),
                id(created),
                client.user().id(),
                freelancer.user().id());
        reject(created, client, 409);
        call(
                post("/api/proposals/" + id(created) + "/withdraw"),
                freelancer,
                null,
                etag(created),
                409);
    }

    @Test
    void malformedMissingAndStaleEtagsDoNotMutate() throws Exception {
        var created = submit(job(client, true).id(), freelancer);
        long id = id(created);
        call(post("/api/proposals/" + id + "/withdraw"), freelancer, null, null, 400);
        call(post("/api/proposals/" + id + "/withdraw"), freelancer, null, "*", 400);
        var changed = reject(created, client, 200);
        call(post("/api/proposals/" + id + "/withdraw"), freelancer, null, etag(created), 409);
        assertThat(node(detail(id, freelancer))).isEqualTo(node(changed));
    }

    @Test
    void pendingProposalsOnNonOpenJobsCannotTransition() throws Exception {
        var job = job(client, true);
        var created = submit(job.id(), freelancer);
        jdbc.update("UPDATE dbo.jobs SET status='CANCELLED' WHERE id=?", job.id());
        var before = node(detail(id(created), freelancer));
        reject(created, client, 409);
        call(
                post("/api/proposals/" + id(created) + "/withdraw"),
                freelancer,
                null,
                etag(created),
                409);
        assertThat(node(detail(id(created), freelancer))).isEqualTo(before);
    }

    @Test
    void auditFailureRollsBackStatusAndNewSubmission() throws Exception {
        var job = job(client, true);
        var created = submit(job.id(), freelancer);
        var before = node(detail(id(created), client));
        doThrow(
                        new org.springframework.dao.DataIntegrityViolationException(
                                "simulated audit failure"))
                .when(audit)
                .saveAndFlush(any(AuditLog.class));
        reject(created, client, 409);
        assertThat(node(detail(id(created), client))).isEqualTo(before);
        call(post("/api/jobs/" + job.id() + "/proposals"), otherFreelancer, body(), null, 409);
        assertThat(
                        jdbc.queryForObject(
                                "SELECT COUNT(*) FROM dbo.proposals WHERE job_id=?",
                                Integer.class,
                                job.id()))
                .isEqualTo(1);
    }

    @Test
    void concurrentRejectAndWithdrawHaveOnlyOneWinner() throws Exception {
        var created = submit(job(client, true).id(), freelancer);
        long id = id(created);
        var statuses =
                race(
                        () ->
                                mvc.perform(
                                                request(
                                                        patch("/api/proposals/" + id + "/status"),
                                                        client,
                                                        Map.of("status", "REJECTED"),
                                                        etag(created)))
                                        .andReturn()
                                        .getResponse()
                                        .getStatus(),
                        () ->
                                mvc.perform(
                                                request(
                                                        post("/api/proposals/" + id + "/withdraw"),
                                                        freelancer,
                                                        null,
                                                        etag(created)))
                                        .andReturn()
                                        .getResponse()
                                        .getStatus());
        assertThat(statuses).containsExactlyInAnyOrder(200, 409);
        assertThat(node(detail(id, freelancer)).path("status").asText())
                .isIn("REJECTED", "WITHDRAWN");
    }

    @Test
    void concurrentDuplicateSubmissionsCreateOnlyOneRow() throws Exception {
        var job = job(client, true);
        Callable<Integer> submit =
                () ->
                        mvc.perform(
                                        request(
                                                post("/api/jobs/" + job.id() + "/proposals"),
                                                freelancer,
                                                body(),
                                                null))
                                .andReturn()
                                .getResponse()
                                .getStatus();
        assertThat(race(submit, submit)).containsExactlyInAnyOrder(201, 409);
        assertThat(
                        jdbc.queryForObject(
                                "SELECT COUNT(*) FROM dbo.proposals WHERE job_id=?",
                                Integer.class,
                                job.id()))
                .isEqualTo(1);
    }

    @Test
    void concurrentJobCancellationAndSubmissionCannotBothSucceed() throws Exception {
        var job = job(client, true);
        var outcomes =
                race(
                        () ->
                                mvc.perform(
                                                request(
                                                        delete("/api/jobs/" + job.id()),
                                                        client,
                                                        null,
                                                        "\"" + job.version() + "\""))
                                        .andReturn()
                                        .getResponse()
                                        .getStatus(),
                        () ->
                                mvc.perform(
                                                request(
                                                        post(
                                                                "/api/jobs/"
                                                                        + job.id()
                                                                        + "/proposals"),
                                                        freelancer,
                                                        body(),
                                                        null))
                                        .andReturn()
                                        .getResponse()
                                        .getStatus());
        assertThat(outcomes).contains(409);
        assertThat(outcomes).anyMatch(code -> code == 201 || code == 204);
        int count =
                jdbc.queryForObject(
                        "SELECT COUNT(*) FROM dbo.proposals WHERE job_id=?",
                        Integer.class,
                        job.id());
        String state =
                jdbc.queryForObject(
                        "SELECT status FROM dbo.jobs WHERE id=?", String.class, job.id());
        assertThat(count == 0 && state.equals("CANCELLED") || count == 1 && state.equals("OPEN"))
                .isTrue();
    }

    private List<Integer> race(Callable<Integer> first, Callable<Integer> second) throws Exception {
        try (ExecutorService pool = Executors.newFixedThreadPool(2)) {
            CountDownLatch start = new CountDownLatch(1);
            Future<Integer>
                    a =
                            pool.submit(
                                    () -> {
                                        start.await();
                                        return first.call();
                                    }),
                    b =
                            pool.submit(
                                    () -> {
                                        start.await();
                                        return second.call();
                                    });
            start.countDown();
            return List.of(a.get(20, TimeUnit.SECONDS), b.get(20, TimeUnit.SECONDS));
        }
    }
}
