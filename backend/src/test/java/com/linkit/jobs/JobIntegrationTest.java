package com.linkit.jobs;

import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fasterxml.jackson.databind.*;
import com.linkit.auth.dto.AuthDtos.*;
import com.linkit.auth.service.AuthService;
import com.linkit.identity.entity.UserRole.Role;
import com.linkit.jobs.entity.Job;

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
import org.springframework.test.web.servlet.*;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.security.MessageDigest;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.*;
import java.util.concurrent.*;

@SpringBootTest(
        properties = {
            "spring.datasource.url=jdbc:sqlserver://localhost:1433;databaseName=LinkIT_V2;integratedSecurity=true;encrypt=true;trustServerCertificate=true",
            "spring.datasource.username=",
            "spring.datasource.password=",
            "spring.jpa.hibernate.ddl-auto=validate",
            "linkit.seed.enabled=false",
            "debug=false",
            "LINKIT_CORS_ALLOWED_ORIGINS=https://jobs.example.test"
        })
@AutoConfigureMockMvc(print = MockMvcPrint.NONE)
@EnabledIfEnvironmentVariable(named = "LINKIT_JOB_TEST", matches = "true")
class JobIntegrationTest {
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
    @Autowired JdbcTemplate jdbc;
    @Autowired PlatformTransactionManager transactions;
    @Autowired EntityManagerFactory emf;
    private final List<Long> users = new ArrayList<>();
    private final List<Long> extraSkills = new ArrayList<>();
    private final String marker = "job-it-" + UUID.randomUUID();
    private TokenResponse owner, other, freelancer, admin;
    private Map<String, String> seedBefore;

    @BeforeEach
    void setup() throws Exception {
        seedBefore = fingerprint();
        owner = account(Role.CLIENT);
        other = account(Role.CLIENT);
        freelancer = account(Role.FREELANCER);
        admin = account(Role.CLIENT);
        new TransactionTemplate(transactions)
                .executeWithoutResult(
                        status -> {
                            long id = admin.user().id();
                            jdbc.update("DELETE FROM dbo.client_profiles WHERE user_id=?", id);
                            jdbc.update("DELETE FROM dbo.user_roles WHERE user_id=?", id);
                            jdbc.update(
                                    "INSERT dbo.user_roles(user_id,role,assigned_at) VALUES (?,'ADMIN',SYSUTCDATETIME())",
                                    id);
                        });
    }

    private TokenResponse account(Role role) {
        TokenResponse response =
                auth.register(
                        new RegisterRequest(
                                marker + "-" + users.size() + "@example.invalid",
                                "Test-" + UUID.randomUUID(),
                                "Job API test",
                                role));
        users.add(response.user().id());
        return response;
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
                                String ownedJobs =
                                        "SELECT id FROM dbo.jobs WHERE client_id IN (" + ids + ")";
                                jdbc.update(
                                        "DELETE FROM dbo.assignments WHERE job_id IN ("
                                                + ownedJobs
                                                + ")",
                                        values);
                                jdbc.update(
                                        "DELETE FROM dbo.proposals WHERE job_id IN ("
                                                + ownedJobs
                                                + ")",
                                        values);
                                jdbc.update(
                                        "DELETE FROM dbo.job_quality_assessments WHERE job_id IN ("
                                                + ownedJobs
                                                + ")",
                                        values);
                                jdbc.update(
                                        "DELETE FROM dbo.job_skills WHERE job_id IN ("
                                                + ownedJobs
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
                                for (Long id : extraSkills)
                                    jdbc.update("DELETE FROM dbo.skills WHERE id=?", id);
                            });
        assertThat(fingerprint())
                .as(
                        "All 23 seed tables must retain their exact contents, including hashes and ROWVERSION")
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

    private Map<String, Object> body(Long... skills) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("title", marker + " Phát triển API Java");
        result.put(
                "description",
                "Xây dựng API quản lý sản phẩm cho doanh nghiệp Việt Nam. Hệ thống hỗ trợ tra cứu, phân loại sản phẩm và xuất báo cáo cho nhân viên vận hành.");
        result.put(
                "deliverables",
                "Mã nguồn, kiểm thử tự động và tài liệu vận hành chi tiết cho đội phát triển.");
        result.put(
                "acceptanceCriteria",
                "Đạt kiểm thử chức năng, không còn lỗi nghiêm trọng và bàn giao đầy đủ tài liệu cho client.");
        result.put("budgetMin", new BigDecimal("100.00"));
        result.put("budgetMax", new BigDecimal("300.00"));
        result.put("currencyCode", "VND");
        result.put("deadline", LocalDate.now(ZoneOffset.UTC).plusDays(60).toString());
        result.put(
                "skills",
                Arrays.stream(skills)
                        .map(
                                id ->
                                        Map.of(
                                                "skillId",
                                                id,
                                                "requiredLevel",
                                                3,
                                                "isRequired",
                                                true,
                                                "weight",
                                                50))
                        .toList());
        return result;
    }

    private MvcResult call(
            MockHttpServletRequestBuilder request,
            TokenResponse actor,
            Map<String, Object> body,
            String etag,
            int expected)
            throws Exception {
        if (actor != null) request.header("Authorization", "Bearer " + actor.accessToken());
        if (body != null)
            request.contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsBytes(body));
        if (etag != null) request.header("If-Match", etag);
        return mvc.perform(request).andExpect(status().is(expected)).andReturn();
    }

    private JsonNode node(MvcResult result) throws Exception {
        return json.readTree(result.getResponse().getContentAsByteArray());
    }

    private MvcResult create(TokenResponse actor, Map<String, Object> body) throws Exception {
        return call(post("/api/jobs"), actor, body, null, 201);
    }

    private long id(MvcResult result) throws Exception {
        return node(result).path("id").asLong();
    }

    private String etag(MvcResult result) {
        return result.getResponse().getHeader("ETag");
    }

    private MvcResult detail(long id, TokenResponse actor) throws Exception {
        return call(get("/api/jobs/" + id), actor, null, null, 200);
    }

    private MvcResult publish(MvcResult created) throws Exception {
        return call(post("/api/jobs/" + id(created) + "/publish"), owner, null, etag(created), 200);
    }

    private long snapshots(long id) {
        return jdbc.queryForObject(
                "SELECT COUNT_BIG(*) FROM dbo.job_quality_assessments WHERE job_id=?",
                Long.class,
                id);
    }

    @Test
    void draftCrudAndSkillReplacementPreserveQualityHistory() throws Exception {
        MvcResult created = create(owner, body(1L, 2L));
        long id = id(created);
        assertThat(node(created).path("clientId").asLong()).isEqualTo(owner.user().id());
        assertThat(node(created).path("quality").path("score").asInt()).isEqualTo(100);
        MvcResult crossOrigin =
                call(
                        get("/api/jobs/" + id).header("Origin", "https://jobs.example.test"),
                        owner,
                        null,
                        null,
                        200);
        assertThat(crossOrigin.getResponse().getHeader("Access-Control-Expose-Headers"))
                .contains("ETag", "Location");
        Map<String, Object> updated = body(2L, 3L);
        updated.put("title", marker + " Đã cập nhật");
        MvcResult response = call(put("/api/jobs/" + id), owner, updated, etag(created), 200);
        assertThat(node(response).path("skills").findValuesAsText("skillId"))
                .containsExactly("2", "3");
        assertThat(snapshots(id)).isEqualTo(2);
        assertThat(etag(response)).isNotEqualTo(etag(created));
        call(delete("/api/jobs/" + id), owner, null, etag(response), 204);
        assertThat(node(detail(id, owner)).path("status").asText()).isEqualTo("CANCELLED");
        assertThat(snapshots(id)).isEqualTo(2);
        call(get("/api/jobs/" + id), freelancer, null, null, 404);
    }

    @Test
    void incompleteDraftCanBeSavedButCannotBePublished() throws Exception {
        var request = body();
        request.put("title", "");
        request.put("description", "");
        request.put("deliverables", "");
        request.put("acceptanceCriteria", "");
        request.put("budgetMin", BigDecimal.ZERO);
        request.put("budgetMax", BigDecimal.ZERO);
        MvcResult created = create(owner, request);
        call(post("/api/jobs/" + id(created) + "/publish"), owner, null, etag(created), 422);
        assertThat(node(detail(id(created), owner))).isEqualTo(node(created));
        assertThat(snapshots(id(created))).isEqualTo(1);
    }

    @Test
    void openUpdateThatLosesQualityRollsBackJobSkillsVersionAndHistory() throws Exception {
        MvcResult opened = publish(create(owner, body(1L)));
        long id = id(opened);
        var invalid = body(2L);
        invalid.put("description", "");
        call(put("/api/jobs/" + id), owner, invalid, etag(opened), 422);
        assertThat(node(detail(id, owner))).isEqualTo(node(opened));
        assertThat(snapshots(id)).isEqualTo(2);
        invalid = body();
        call(put("/api/jobs/" + id), owner, invalid, etag(opened), 422);
        assertThat(node(detail(id, owner))).isEqualTo(node(opened));
    }

    @Test
    void exactlyEightyCanPublishAndOpenUpdateBelowEightyRollsBack() throws Exception {
        var eighty = body(1L);
        eighty.put("description", "Mô tả ngắn");
        eighty.put("deliverables", "Mã nguồn");
        MvcResult opened = publish(create(owner, eighty));
        long id = id(opened);
        assertThat(node(opened).path("quality").path("score").asInt()).isEqualTo(80);
        var seventy = new LinkedHashMap<>(eighty);
        seventy.put("acceptanceCriteria", "Chạy đúng");
        call(put("/api/jobs/" + id), owner, seventy, etag(opened), 422);
        assertThat(node(detail(id, owner))).isEqualTo(node(opened));
        assertThat(snapshots(id)).isEqualTo(2);
    }

    @Test
    void validOpenUpdateReevaluatesWithoutChangingPublicationDate() throws Exception {
        MvcResult opened = publish(create(owner, body(1L)));
        var update = body(1L, 2L);
        update.put("title", marker + " Bản sửa hợp lệ");
        MvcResult changed = call(put("/api/jobs/" + id(opened)), owner, update, etag(opened), 200);
        assertThat(node(changed).path("status").asText()).isEqualTo("OPEN");
        assertThat(node(changed).path("publishedAt")).isEqualTo(node(opened).path("publishedAt"));
        assertThat(snapshots(id(opened))).isEqualTo(3);
    }

    @Test
    void etagRejectsStaleMissingAndMalformedWrites() throws Exception {
        MvcResult created = create(owner, body(1L));
        long id = id(created);
        MvcResult updated = call(put("/api/jobs/" + id), owner, body(2L), etag(created), 200);
        call(put("/api/jobs/" + id), owner, body(3L), etag(created), 409);
        call(put("/api/jobs/" + id), owner, body(3L), null, 400);
        call(delete("/api/jobs/" + id), owner, null, "*", 400);
        assertThat(node(detail(id, owner))).isEqualTo(node(updated));
    }

    @Test
    void roleAndOwnershipChecksUseJwtRatherThanBody() throws Exception {
        MvcResult created = create(owner, body(1L));
        long id = id(created);
        for (TokenResponse denied : List.of(freelancer, admin)) {
            call(post("/api/jobs"), denied, body(1L), null, 403);
            call(put("/api/jobs/" + id), denied, body(2L), etag(created), 403);
            call(post("/api/jobs/" + id + "/publish"), denied, null, etag(created), 403);
        }
        call(put("/api/jobs/" + id), other, body(2L), etag(created), 403);
        call(delete("/api/jobs/" + id), other, null, etag(created), 403);
        call(delete("/api/jobs/" + id), freelancer, null, etag(created), 403);
        call(get("/api/jobs/" + id), other, null, null, 404);
        call(get("/api/jobs/" + id), freelancer, null, null, 404);
        var spoof = body(1L);
        spoof.put("clientId", other.user().id());
        call(post("/api/jobs"), owner, spoof, null, 400);
        spoof = body(1L);
        spoof.put("status", "ASSIGNED");
        call(put("/api/jobs/" + id), owner, spoof, etag(created), 400);
        call(delete("/api/jobs/" + id), admin, null, etag(created), 204);
        assertThat(node(detail(id, admin)).path("status").asText()).isEqualTo("CANCELLED");
    }

    @Test
    void missingJwtIsUnauthorized() throws Exception {
        call(get("/api/jobs"), null, null, null, 401);
        call(post("/api/jobs"), null, body(1L), null, 401);
    }

    @Test
    void listVisibilityCannotBeBypassedWithStatusOrMineFilters() throws Exception {
        create(owner, body(1L));
        publish(create(owner, body(1L)));
        create(other, body(1L));
        var own = node(call(get("/api/jobs").param("q", marker), owner, null, null, 200));
        assertThat(own.path("totalElements").asInt()).isEqualTo(2);
        assertThat(
                        node(call(get("/api/jobs").param("q", marker), freelancer, null, null, 200))
                                .path("totalElements")
                                .asInt())
                .isEqualTo(1);
        assertThat(
                        node(call(get("/api/jobs").param("q", marker), admin, null, null, 200))
                                .path("totalElements")
                                .asInt())
                .isEqualTo(3);
        assertThat(
                        node(call(
                                        get("/api/jobs")
                                                .param("q", marker)
                                                .param("status", "DRAFT"),
                                        freelancer,
                                        null,
                                        null,
                                        200))
                                .path("totalElements")
                                .asInt())
                .isZero();
        call(get("/api/jobs").param("mine", "true"), freelancer, null, null, 403);
        assertThat(
                        node(call(
                                        get("/api/jobs").param("q", marker).param("mine", "true"),
                                        other,
                                        null,
                                        null,
                                        200))
                                .path("totalElements")
                                .asInt())
                .isEqualTo(1);
    }

    @Test
    void searchSkillBudgetCurrencyStatusAndPaginationWorkTogether() throws Exception {
        publish(create(owner, body(1L, 2L)));
        var second = body(1L);
        second.put("budgetMin", 400);
        second.put("budgetMax", 600);
        publish(create(owner, second));
        var usd = body(2L);
        usd.put("currencyCode", "USD");
        usd.put("budgetMin", 200);
        usd.put("budgetMax", 450);
        publish(create(owner, usd));
        assertThat(
                        node(call(
                                        get("/api/jobs")
                                                .param("q", marker)
                                                .param("skillIds", "1,2"),
                                        freelancer,
                                        null,
                                        null,
                                        200))
                                .path("totalElements")
                                .asInt())
                .isEqualTo(1);
        assertThat(
                        node(call(
                                        get("/api/jobs")
                                                .param("q", marker)
                                                .param("minBudget", "250")
                                                .param("maxBudget", "350"),
                                        freelancer,
                                        null,
                                        null,
                                        200))
                                .path("totalElements")
                                .asInt())
                .isEqualTo(1);
        assertThat(
                        node(call(
                                        get("/api/jobs")
                                                .param("q", marker)
                                                .param("minBudget", "250")
                                                .param("maxBudget", "350")
                                                .param("currency", "USD"),
                                        freelancer,
                                        null,
                                        null,
                                        200))
                                .path("totalElements")
                                .asInt())
                .isEqualTo(1);
        JsonNode page =
                node(
                        call(
                                get("/api/jobs")
                                        .param("q", marker)
                                        .param("status", "OPEN")
                                        .param("page", "1")
                                        .param("size", "1"),
                                freelancer,
                                null,
                                null,
                                200));
        assertThat(page.path("content")).hasSize(1);
        assertThat(page.path("totalElements").asInt()).isEqualTo(3);
        assertThat(page.path("totalPages").asInt()).isEqualTo(3);
        assertThat(
                        node(call(
                                        get("/api/jobs").param("q", "NHÂN VIÊN VẬN HÀNH"),
                                        freelancer,
                                        null,
                                        null,
                                        200))
                                .path("totalElements")
                                .asInt())
                .isEqualTo(3);
        assertThat(
                        node(call(
                                        get("/api/jobs").param("q", marker).param("page", "99"),
                                        freelancer,
                                        null,
                                        null,
                                        200))
                                .path("content"))
                .isEmpty();
    }

    @Test
    void sqlLikeMetacharactersAreLiteralSearchText() throws Exception {
        var special = body(1L);
        special.put("title", marker + " %_[SQL]");
        publish(create(owner, special));
        publish(create(owner, body(1L)));
        assertThat(
                        node(call(
                                        get("/api/jobs").param("q", "%_[SQL]"),
                                        freelancer,
                                        null,
                                        null,
                                        200))
                                .path("totalElements")
                                .asInt())
                .isEqualTo(1);
    }

    @Test
    void invalidSkillsAndBudgetAreRejected() throws Exception {
        call(post("/api/jobs"), owner, body(1L, 1L), null, 422);
        call(post("/api/jobs"), owner, body(Long.MAX_VALUE), null, 422);
        Long inactive =
                jdbc.queryForObject(
                        "INSERT dbo.skills(name,is_active) OUTPUT INSERTED.id VALUES (?,0)",
                        Long.class,
                        marker);
        extraSkills.add(inactive);
        call(post("/api/jobs"), owner, body(inactive), null, 422);
        var invalid = body(1L);
        invalid.put("budgetMin", 400);
        call(post("/api/jobs"), owner, invalid, null, 422);
        invalid = body(1L);
        invalid.put(
                "skills",
                List.of(
                        Map.of(
                                "skillId",
                                1,
                                "requiredLevel",
                                6,
                                "isRequired",
                                true,
                                "weight",
                                101)));
        call(post("/api/jobs"), owner, invalid, null, 422);
        call(get("/api/jobs").param("page", "-1"), owner, null, null, 422);
        call(get("/api/jobs").param("size", "101"), owner, null, null, 422);
        call(get("/api/jobs").param("status", "NOT_A_STATUS"), owner, null, null, 400);
        call(
                get("/api/jobs").param("minBudget", "400").param("maxBudget", "100"),
                owner,
                null,
                null,
                422);
    }

    @Test
    void publicationRequiresFutureDeadlineAndAtLeastOneSkill() throws Exception {
        var past = body(1L);
        past.put("deadline", LocalDate.now(ZoneOffset.UTC).toString());
        MvcResult draft = create(owner, past);
        call(post("/api/jobs/" + id(draft) + "/publish"), owner, null, etag(draft), 422);
        draft = create(owner, body());
        call(post("/api/jobs/" + id(draft) + "/publish"), owner, null, etag(draft), 422);
    }

    @Test
    void proposalsPreventEditsAndCancellationWithoutChangingReferencedJob() throws Exception {
        MvcResult opened = publish(create(owner, body(1L)));
        long job = id(opened);
        jdbc.update(
                "INSERT dbo.proposals(job_id,freelancer_id,cover_letter,proposed_budget,estimated_days,status,submitted_at,updated_at) VALUES (?,?,N'Test',100,10,'PENDING',SYSUTCDATETIME(),SYSUTCDATETIME())",
                job,
                freelancer.user().id());
        call(put("/api/jobs/" + job), owner, body(2L), etag(opened), 409);
        call(delete("/api/jobs/" + job), admin, null, etag(opened), 409);
        assertThat(node(detail(job, owner))).isEqualTo(node(opened));
    }

    @ParameterizedTest
    @EnumSource(
            value = Job.Status.class,
            names = {"ASSIGNED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "CLOSED"})
    void terminalOrWorkspaceStatesCannotBeChangedByJobApi(Job.Status state) throws Exception {
        MvcResult created = create(owner, body(1L));
        long job = id(created);
        jdbc.update("UPDATE dbo.jobs SET status=? WHERE id=?", state.name(), job);
        MvcResult current = detail(job, owner);
        call(put("/api/jobs/" + job), owner, body(2L), etag(current), 409);
        call(delete("/api/jobs/" + job), admin, null, etag(current), 409);
        call(post("/api/jobs/" + job + "/publish"), owner, null, etag(current), 409);
    }

    @Test
    void concurrentWritesWithSameVersionHaveExactlyOneWinner() throws Exception {
        MvcResult created = create(owner, body(1L));
        long job = id(created);
        String version = etag(created);
        try (ExecutorService pool = Executors.newFixedThreadPool(2)) {
            CountDownLatch start = new CountDownLatch(1);
            Callable<Integer> update =
                    () -> {
                        start.await();
                        return mvc.perform(
                                        put("/api/jobs/" + job)
                                                .header(
                                                        "Authorization",
                                                        "Bearer " + owner.accessToken())
                                                .header("If-Match", version)
                                                .contentType(MediaType.APPLICATION_JSON)
                                                .content(json.writeValueAsBytes(body(2L))))
                                .andReturn()
                                .getResponse()
                                .getStatus();
                    };
            Future<Integer> first = pool.submit(update), second = pool.submit(update);
            start.countDown();
            assertThat(List.of(first.get(20, TimeUnit.SECONDS), second.get(20, TimeUnit.SECONDS)))
                    .containsExactlyInAnyOrder(200, 409);
            assertThat(snapshots(job)).isEqualTo(2);
        }
    }

    private long assignedJob(Job.Status state) throws Exception {
        long job = id(publish(create(owner, body(1L))));
        Long proposal =
                jdbc.queryForObject(
                        "INSERT dbo.proposals(job_id,freelancer_id,cover_letter,proposed_budget,estimated_days,status,submitted_at,updated_at) OUTPUT INSERTED.id VALUES (?,?,N'Ownership fixture',100,10,'ACCEPTED',SYSUTCDATETIME(),SYSUTCDATETIME())",
                        Long.class,
                        job,
                        freelancer.user().id());
        jdbc.update(
                "INSERT dbo.assignments(job_id,proposal_id,client_id,freelancer_id,agreed_budget,currency_code,status,created_at) VALUES (?,?,?,?,100,'VND','PENDING_SCOPE',SYSUTCDATETIME())",
                job,
                proposal,
                owner.user().id(),
                freelancer.user().id());
        jdbc.update("UPDATE dbo.jobs SET status=? WHERE id=?", state.name(), job);
        return job;
    }

    @ParameterizedTest
    @EnumSource(
            value = Job.Status.class,
            names = {"ASSIGNED", "IN_PROGRESS"})
    void selectedFreelancerReadsWorkspaceJobButListAndWritePermissionsStayUnchanged(
            Job.Status state) throws Exception {
        long job = assignedJob(state);
        TokenResponse stranger = account(Role.FREELANCER);
        MvcResult read = detail(job, freelancer);
        assertThat(node(read).path("status").asText()).isEqualTo(state.name());
        assertThat(etag(read)).isNotBlank();
        detail(job, owner);
        detail(job, admin);
        call(get("/api/jobs/" + job), stranger, null, null, 404);
        call(get("/api/jobs/" + job), other, null, null, 404);
        assertThat(
                        node(call(get("/api/jobs").param("q", marker), freelancer, null, null, 200))
                                .path("totalElements")
                                .asInt())
                .isZero();
        call(put("/api/jobs/" + job), freelancer, body(1L), etag(read), 403);
        call(delete("/api/jobs/" + job), freelancer, null, etag(read), 403);
        call(post("/api/jobs/" + job + "/publish"), freelancer, null, etag(read), 403);
        call(post("/api/jobs"), freelancer, body(1L), null, 403);
    }

    @Test
    void assignmentAndUserIdsFromRequestCannotGrantAnotherFreelancerJobAccess() throws Exception {
        long job = assignedJob(Job.Status.ASSIGNED);
        TokenResponse stranger = account(Role.FREELANCER);
        Long assignment =
                jdbc.queryForObject(
                        "SELECT id FROM dbo.assignments WHERE job_id=?", Long.class, job);
        call(
                get("/api/jobs/" + job)
                        .param("assignmentId", assignment.toString())
                        .param("freelancerId", freelancer.user().id().toString())
                        .param("userId", freelancer.user().id().toString()),
                stranger,
                null,
                null,
                404);
        call(
                get("/api/jobs/" + job).param("assignmentId", Long.toString(Long.MAX_VALUE)),
                stranger,
                null,
                null,
                404);
        call(get("/api/assignments/" + assignment), stranger, null, null, 404);
        call(get("/api/assignments/" + Long.MAX_VALUE), stranger, null, null, 404);
        long unassigned = id(create(owner, body(1L)));
        jdbc.update("UPDATE dbo.jobs SET status='ASSIGNED' WHERE id=?", unassigned);
        call(
                get("/api/jobs/" + unassigned).param("assignmentId", assignment.toString()),
                freelancer,
                null,
                null,
                404);
    }

    @Test
    void openJobReadAccessIsUnchangedWithoutAnyAssignment() throws Exception {
        long job = id(publish(create(owner, body(1L))));
        TokenResponse stranger = account(Role.FREELANCER);
        for (TokenResponse actor : List.of(owner, other, freelancer, stranger, admin))
            detail(job, actor);
        call(get("/api/jobs/" + job), null, null, null, 401);
        assertThat(
                        node(call(get("/api/jobs").param("q", marker), stranger, null, null, 200))
                                .path("totalElements")
                                .asInt())
                .isEqualTo(1);
    }
}
