package com.linkit.identity;

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
@EnabledIfEnvironmentVariable(named = "LINKIT_SKILL_TEST", matches = "true")
class SkillCatalogIntegrationTest {
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
    private final String marker = "skill-it-" + UUID.randomUUID();
    private TokenResponse client, otherClient, freelancer, otherFreelancer;
    private Map<String, String> seedBefore;
    private final List<Long> skillIds = new ArrayList<>();

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
        for (Long skillId : skillIds) jdbc.update("DELETE FROM dbo.skills WHERE id=?", skillId);
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

    private void fixture() {
        for (int i = 0; i < 3; i++) {
            Long id =
                    jdbc.queryForObject(
                            "INSERT dbo.skills(name,category,is_active) OUTPUT INSERTED.id VALUES (?,?,?)",
                            Long.class,
                            marker + (i == 0 ? " _[]% A" : i == 1 ? " B" : " C"),
                            marker + " Quality",
                            i < 2);
            skillIds.add(id);
        }
    }

    private ResultActions catalog(TokenResponse actor, String q, int page, int size)
            throws Exception {
        var request =
                get("/api/skills")
                        .param("q", q)
                        .param("page", String.valueOf(page))
                        .param("size", String.valueOf(size));
        if (actor != null) request.header("Authorization", "Bearer " + actor.accessToken());
        return mvc.perform(request);
    }

    @ParameterizedTest
    @EnumSource(Role.class)
    void threeRolesCanReadOnlyActiveSkills(Role role) throws Exception {
        fixture();
        TokenResponse actor =
                role == Role.CLIENT ? client : role == Role.FREELANCER ? freelancer : otherClient;
        if (role == Role.ADMIN) {
            jdbc.update(
                    "INSERT dbo.user_roles(user_id,role,assigned_at) VALUES (?,'ADMIN',SYSUTCDATETIME())",
                    actor.user().id());
            jdbc.update(
                    "DELETE FROM dbo.user_roles WHERE user_id=? AND role='CLIENT'",
                    actor.user().id());
        }
        var before = fingerprint();
        var response = catalog(actor, marker, 0, 100).andExpect(status().isOk()).andReturn();
        var page = json.readTree(response.getResponse().getContentAsByteArray());
        assertThat(page.path("totalElements").asInt()).isEqualTo(2);
        assertThat(page.path("content").size()).isEqualTo(2);
        assertThat(page.path("content").get(0).path("id").asLong()).isEqualTo(skillIds.get(0));
        assertThat(page.path("content").get(0).properties()).hasSize(3);
        assertThat(page.path("content").get(0).has("isActive")).isFalse();
        assertThat(fingerprint()).isEqualTo(before);
    }

    @Test
    void searchPaginationAndLiteralLikeCharacters() throws Exception {
        fixture();
        var first =
                catalog(client, marker.toUpperCase(Locale.ROOT), 0, 1)
                        .andExpect(status().isOk())
                        .andReturn();
        var page = json.readTree(first.getResponse().getContentAsByteArray());
        assertThat(page.path("page").asInt()).isZero();
        assertThat(page.path("totalPages").asInt()).isEqualTo(2);
        var next = catalog(client, marker, 1, 1).andExpect(status().isOk()).andReturn();
        assertThat(
                        json.readTree(next.getResponse().getContentAsByteArray())
                                .path("content")
                                .get(0)
                                .path("id")
                                .asLong())
                .isEqualTo(skillIds.get(1));
        var literal = catalog(client, "_[]%", 0, 100).andExpect(status().isOk()).andReturn();
        assertThat(
                        json.readTree(literal.getResponse().getContentAsByteArray())
                                .path("totalElements")
                                .asInt())
                .isEqualTo(1);
        var category =
                catalog(client, marker + " quality", 0, 100).andExpect(status().isOk()).andReturn();
        assertThat(
                        json.readTree(category.getResponse().getContentAsByteArray())
                                .path("totalElements")
                                .asInt())
                .isEqualTo(2);
    }

    @Test
    void requiresJwtAndProvidesNoMutationEndpoints() throws Exception {
        catalog(null, "", 0, 20).andExpect(status().isUnauthorized());
        for (var request :
                List.of(post("/api/skills"), put("/api/skills/1"), delete("/api/skills/1")))
            mvc.perform(request.header("Authorization", "Bearer " + client.accessToken()))
                    .andExpect(status().isForbidden());
    }

    @Test
    void rejectsInvalidPaginationAndSearchLength() throws Exception {
        catalog(client, "", -1, 20).andExpect(status().isUnprocessableEntity());
        catalog(client, "", 0, 101).andExpect(status().isUnprocessableEntity());
        catalog(client, "x".repeat(101), 0, 20).andExpect(status().isUnprocessableEntity());
    }

    @Test
    void jobAcceptsExactDecimalStringsFromTheBrowserWithoutRounding() throws Exception {
        var body =
                Map.of(
                        "title",
                        "Exact decimal Job",
                        "description",
                        "A complete project description",
                        "deliverables",
                        "Source code and documentation",
                        "acceptanceCriteria",
                        "Agreed tests pass",
                        "budgetMin",
                        "0.00",
                        "budgetMax",
                        "99999999999999999.99",
                        "currencyCode",
                        "VND",
                        "deadline",
                        "2099-12-31",
                        "skills",
                        List.of(
                                Map.of(
                                        "skillId",
                                        1,
                                        "requiredLevel",
                                        3,
                                        "weight",
                                        "25.50",
                                        "isRequired",
                                        true)));
        var response =
                mvc.perform(
                                post("/api/jobs")
                                        .header("Authorization", "Bearer " + client.accessToken())
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(json.writeValueAsBytes(body)))
                        .andExpect(status().isCreated())
                        .andReturn();
        long id = json.readTree(response.getResponse().getContentAsByteArray()).path("id").asLong();
        assertThat(
                        jdbc.queryForObject(
                                "SELECT budget_max FROM dbo.jobs WHERE id=?", BigDecimal.class, id))
                .isEqualByComparingTo("99999999999999999.99");
        assertThat(response.getResponse().getHeader("ETag")).isNotBlank();
    }
}
