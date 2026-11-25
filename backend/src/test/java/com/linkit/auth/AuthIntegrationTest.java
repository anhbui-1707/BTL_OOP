package com.linkit.auth;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fasterxml.jackson.databind.*;
import com.linkit.auth.dto.AuthDtos.*;
import com.linkit.auth.security.JwtSettings;
import com.linkit.auth.service.AuthService;
import com.linkit.identity.entity.ClientProfile;
import com.linkit.identity.entity.UserRole.Role;
import com.linkit.identity.repository.ClientProfileRepository;

import jakarta.persistence.EntityManager;

import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.*;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.test.context.*;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.context.transaction.*;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.*;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.bind.annotation.*;

import java.time.*;
import java.util.*;
import java.util.concurrent.*;

@SpringBootTest(
        properties = {
            "spring.datasource.url=jdbc:sqlserver://localhost:1433;databaseName=LinkIT_V2;integratedSecurity=true;encrypt=true;trustServerCertificate=true",
            "spring.datasource.username=",
            "spring.datasource.password=",
            "spring.jpa.hibernate.ddl-auto=validate",            "debug=false"
        })
@AutoConfigureMockMvc(print = MockMvcPrint.NONE)
@EnabledIfEnvironmentVariable(named = "LINKIT_AUTH_TEST", matches = "true")
@Transactional
@Import(AuthIntegrationTest.Probes.class)
class AuthIntegrationTest {
    private static final String KEY;

    static {
        byte[] key = new byte[32];
        new java.security.SecureRandom().nextBytes(key);
        KEY = Base64.getEncoder().encodeToString(key);
    }

    @DynamicPropertySource
    static void settings(DynamicPropertyRegistry properties) {
        properties.add("LINKIT_JWT_SECRET", () -> KEY);
    }

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder passwords;
    @Autowired EntityManager em;
    @Autowired AuthService auth;
    @Autowired JwtEncoder signer;
    @Autowired JwtDecoder decoder;
    @Autowired JwtSettings settings;
    @Autowired PlatformTransactionManager manager;
    @Autowired com.linkit.identity.service.AvatarService avatars;
    @MockitoSpyBean ClientProfileRepository clientProfiles;
    private final String password = "Test-" + UUID.randomUUID();
    private final String email = "auth-it-" + UUID.randomUUID() + "@example.invalid";
    private Map<String, Long> before;

    @RestController
    static class Probes {
        @GetMapping("/api/admin/auth-probe")
        String admin() {
            return "admin";
        }

        @GetMapping("/api/client/auth-probe")
        String client() {
            return "client";
        }

        @GetMapping("/api/freelancer/auth-probe")
        String freelancer() {
            return "freelancer";
        }
    }

    private Map<String, Long> counts() {
        Map<String, Long> result = new TreeMap<>();
        for (String table :
                List.of(
                        "users",
                        "user_roles",
                        "client_profiles",
                        "freelancer_profiles",
                        "refresh_tokens",
                        "audit_logs"))
            result.put(
                    table,
                    jdbc.queryForObject("SELECT COUNT_BIG(*) FROM dbo." + table, Long.class));
        return result;
    }

    @BeforeTransaction
    void snapshot() {
        before = counts();
    }

    @AfterTransaction
    void rolledBack() {
        assertThat(counts()).isEqualTo(before);
    }

    private JsonNode post(String endpoint, Map<String, ?> body, int expected) throws Exception {
        var result =
                mvc.perform(postJson(endpoint, body)).andExpect(status().is(expected)).andReturn();
        return result.getResponse().getContentAsByteArray().length == 0
                ? null
                : json.readTree(result.getResponse().getContentAsByteArray());
    }

    private org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder postJson(
            String endpoint, Map<String, ?> body) throws Exception {
        return org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post(endpoint)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsBytes(body));
    }

    private JsonNode register(Role role) throws Exception {
        return post(
                "/api/auth/register",
                Map.of(
                        "email",
                        email,
                        "password",
                        password,
                        "fullName",
                        "Nguyễn Minh Anh",
                        "role",
                        role.name()),
                201);
    }

    private JsonNode login(String user, String secret, int status) throws Exception {
        return post("/api/auth/login", Map.of("email", user, "password", secret), status);
    }

    @Test
    void avatarUploadValidatesContentSizeAndOwnership() throws Exception {
        JsonNode client = register(Role.CLIENT);
        String token = client.path("accessToken").asText();
        long id = client.path("user").path("id").asLong();
        byte[] png =
                Base64.getDecoder()
                        .decode(
                                "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lXcAAAAASUVORK5CYII=");
        var valid = new MockMultipartFile("file", "portrait.png", "image/png", png);
        mvc.perform(multipart("/api/users/me/avatar").file(valid))
                .andExpect(status().isUnauthorized());
        var result =
                mvc.perform(
                                multipart("/api/users/me/avatar")
                                        .file(valid)
                                        .header("Authorization", "Bearer " + token))
                        .andExpect(status().isOk())
                        .andExpect(jsonPath("$.id").value(id))
                        .andReturn();
        String url =
                json.readTree(result.getResponse().getContentAsByteArray())
                        .path("avatarUrl")
                        .asText();
        assertThat(
                        jdbc.queryForObject(
                                "SELECT avatar_url FROM dbo.users WHERE id=?", String.class, id))
                .isEqualTo(url);
        mvc.perform(get(url)).andExpect(status().isOk()).andExpect(content().bytes(png));
        mvc.perform(
                        multipart("/api/users/me/avatar")
                                .file(
                                        new MockMultipartFile(
                                                "file",
                                                "x.png",
                                                "image/png",
                                                "not an image".getBytes()))
                                .header("Authorization", "Bearer " + token))
                .andExpect(status().isUnprocessableEntity());
        mvc.perform(
                        multipart("/api/users/me/avatar")
                                .file(
                                        new MockMultipartFile(
                                                "file", "x.png", "image/png", new byte[1_635_779]))
                                .header("Authorization", "Bearer " + token))
                .andExpect(status().isUnprocessableEntity());
        mvc.perform(
                        multipart("/api/users/me/avatar")
                                .file(
                                        new MockMultipartFile(
                                                "file",
                                                "x.png",
                                                "image/png",
                                                new byte[2 * 1024 * 1024 + 1]))
                                .header("Authorization", "Bearer " + token))
                .andExpect(status().isUnprocessableEntity());
        assertThat(
                        jdbc.queryForObject(
                                "SELECT avatar_url FROM dbo.users WHERE id=?", String.class, id))
                .isEqualTo(url);
        java.nio.file.Files.deleteIfExists(
                java.nio.file.Path.of("uploads/avatars", url.substring(url.lastIndexOf('/') + 1)));
    }

    private void me(String token, int status) throws Exception {
        mvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + token))
                .andExpect(status().is(status));
    }

    @ParameterizedTest
    @EnumSource(
            value = Role.class,
            names = {"CLIENT", "FREELANCER"})
    void registrationCreatesUserRoleAndMatchingProfileAtomically(Role role) throws Exception {
        JsonNode response = register(role);
        long id = response.path("user").path("id").asLong();
        assertThat(response.path("user").path("roles").get(0).asText()).isEqualTo(role.name());
        assertThat(
                        jdbc.queryForObject(
                                "SELECT role FROM dbo.user_roles WHERE user_id=?",
                                String.class,
                                id))
                .isEqualTo(role.name());
        String table = role == Role.CLIENT ? "client_profiles" : "freelancer_profiles";
        assertThat(
                        jdbc.queryForObject(
                                "SELECT COUNT(*) FROM dbo." + table + " WHERE user_id=?",
                                Integer.class,
                                id))
                .isEqualTo(1);
        String hash =
                jdbc.queryForObject(
                        "SELECT password_hash FROM dbo.users WHERE id=?", String.class, id);
        assertThat(passwords.matches(password, hash)).isTrue();
        me(response.path("accessToken").asText(), 200);
        mvc.perform(
                        get("/api/auth/me")
                                .header(
                                        "Authorization",
                                        "Bearer " + response.path("accessToken").asText()))
                .andExpect(jsonPath("$.id").value(id))
                .andExpect(jsonPath("$.passwordHash").doesNotExist())
                .andExpect(jsonPath("$.refreshTokens").doesNotExist());
    }

    @Test
    void adminCannotSelfRegister() throws Exception {
        JsonNode error =
                post(
                        "/api/auth/register",
                        Map.of(
                                "email",
                                email,
                                "password",
                                password,
                                "fullName",
                                "Test Admin",
                                "role",
                                "ADMIN"),
                        403);
        assertThat(error.path("code").asText()).isEqualTo("FORBIDDEN");
        assertThat(
                        jdbc.queryForObject(
                                "SELECT COUNT(*) FROM dbo.users WHERE email=?",
                                Integer.class,
                                email))
                .isZero();
    }

    @Test
    void duplicateEmailReturns409IgnoringCase() throws Exception {
        register(Role.CLIENT);
        post(
                "/api/auth/register",
                Map.of(
                        "email",
                        email.toUpperCase(Locale.ROOT),
                        "password",
                        password,
                        "fullName",
                        "Another user",
                        "role",
                        "FREELANCER"),
                409);
        assertThat(
                        jdbc.queryForObject(
                                "SELECT COUNT(*) FROM dbo.users WHERE email=?",
                                Integer.class,
                                email))
                .isEqualTo(1);
    }

    @Test
    void correctAndIncorrectLoginAreHandledWithoutUserEnumeration() throws Exception {
        register(Role.CLIENT);
        JsonNode success = login(email, password, 200);
        me(success.path("accessToken").asText(), 200);
        JsonNode wrong = login(email, "Wrong-" + UUID.randomUUID(), 401);
        JsonNode unknown = login("unknown-" + email, password, 401);
        assertThat(wrong.path("message").asText()).isEqualTo(unknown.path("message").asText());
    }

    @Test
    void refreshRotatesHashedTokenAndLogoutRevokesAccessImmediately() throws Exception {
        JsonNode original = register(Role.CLIENT);
        String raw = original.path("refreshToken").asText();
        assertThat(
                        jdbc.queryForObject(
                                "SELECT COUNT(*) FROM dbo.refresh_tokens WHERE token_hash=?",
                                Integer.class,
                                AuthService.hash(raw)))
                .isEqualTo(1);
        JsonNode rotated = post("/api/auth/refresh", Map.of("refreshToken", raw), 200);
        assertThat(rotated.path("refreshToken").asText().equals(raw)).isFalse();
        me(original.path("accessToken").asText(), 401);
        me(rotated.path("accessToken").asText(), 200);
        post("/api/auth/refresh", Map.of("refreshToken", raw), 401);
        post(
                "/api/auth/logout",
                Map.of("refreshToken", rotated.path("refreshToken").asText()),
                204);
        me(rotated.path("accessToken").asText(), 401);
        post(
                "/api/auth/refresh",
                Map.of("refreshToken", rotated.path("refreshToken").asText()),
                401);
        post(
                "/api/auth/logout",
                Map.of("refreshToken", rotated.path("refreshToken").asText()),
                204);
    }

    @Test
    void unknownAndExpiredRefreshTokensAreRejected() throws Exception {
        post("/api/auth/refresh", Map.of("refreshToken", "A".repeat(43)), 401);
        JsonNode response = register(Role.FREELANCER);
        jdbc.update(
                "UPDATE dbo.refresh_tokens SET expires_at=DATEADD(day,-1,SYSUTCDATETIME()) WHERE token_hash=?",
                AuthService.hash(response.path("refreshToken").asText()));
        em.clear();
        post(
                "/api/auth/refresh",
                Map.of("refreshToken", response.path("refreshToken").asText()),
                401);
        me(response.path("accessToken").asText(), 401);
    }

    @Test
    void missingInvalidExpiredAndWrongSignatureAccessTokensReturn401() throws Exception {
        mvc.perform(get("/api/auth/me"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
        me("not-a-jwt", 401);
        JsonNode response = register(Role.CLIENT);
        Jwt good = decoder.decode(response.path("accessToken").asText());
        var expired =
                JwtClaimsSet.builder()
                        .issuer(settings.issuer())
                        .audience(List.of(settings.audience()))
                        .subject(good.getSubject())
                        .claim("sid", good.getClaimAsString("sid"))
                        .issuedAt(Instant.now().minusSeconds(600))
                        .expiresAt(Instant.now().minusSeconds(120))
                        .build();
        me(
                signer.encode(
                                JwtEncoderParameters.from(
                                        JwsHeader.with(MacAlgorithm.HS256).build(), expired))
                        .getTokenValue(),
                401);
        String[] parts = response.path("accessToken").asText().split("\\.");
        parts[2] = (parts[2].startsWith("A") ? "B" : "A") + parts[2].substring(1);
        me(String.join(".", parts), 401);
    }

    @Test
    void databaseRolesControlRbacAndCurrentUserCannotBeSelectedByQueryParameter() throws Exception {
        JsonNode response = register(Role.CLIENT);
        String token = response.path("accessToken").asText();
        mvc.perform(get("/api/admin/auth-probe").header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));
        mvc.perform(get("/api/client/auth-probe").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());
        mvc.perform(get("/api/freelancer/auth-probe").header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden());
        mvc.perform(
                        get("/api/auth/me")
                                .param("userId", "131")
                                .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(response.path("user").path("id").asLong()));
    }

    @Test
    void lockedUsersCannotLoginRefreshOrUseExistingAccess() throws Exception {
        JsonNode response = register(Role.CLIENT);
        jdbc.update(
                "UPDATE dbo.users SET status='LOCKED' WHERE id=?",
                response.path("user").path("id").asLong());
        em.clear();
        login(email, password, 401);
        post(
                "/api/auth/refresh",
                Map.of("refreshToken", response.path("refreshToken").asText()),
                401);
        me(response.path("accessToken").asText(), 401);
    }

    @Test
    void malformedJsonReturns400AndValidationReturns422() throws Exception {
        mvc.perform(
                        org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post(
                                        "/api/auth/login")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
        JsonNode error =
                post(
                        "/api/auth/register",
                        Map.of(
                                "email",
                                "invalid",
                                "password",
                                "short",
                                "fullName",
                                "",
                                "role",
                                "CLIENT"),
                        422);
        assertThat(error.path("errors").has("password")).isTrue();
        post(
                "/api/auth/register",
                Map.of(
                        "email",
                        email,
                        "password",
                        "ệ".repeat(30),
                        "fullName",
                        "Test",
                        "role",
                        "CLIENT"),
                422);
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void registrationFailureAfterUserAndRoleInsertRollsBackEverything() {
        Map<String, Long> initial = counts();
        doThrow(
                        new org.springframework.dao.DataIntegrityViolationException(
                                "simulated profile failure"))
                .when(clientProfiles)
                .saveAndFlush(any(ClientProfile.class));
        assertThatThrownBy(
                        () ->
                                auth.register(
                                        new RegisterRequest(
                                                email, password, "Rollback test", Role.CLIENT)))
                .isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
        assertThat(counts()).isEqualTo(initial);
        assertThat(
                        jdbc.queryForObject(
                                "SELECT COUNT(*) FROM dbo.users WHERE email=?",
                                Integer.class,
                                email))
                .isZero();
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void concurrentRefreshHasOnlyOneWinnerAndCleansItsCommittedFixture() throws Exception {
        Map<String, Long> initial = counts();
        TokenResponse registered =
                auth.register(
                        new RegisterRequest(email, password, "Concurrent refresh", Role.CLIENT));
        long id = registered.user().id();
        try (ExecutorService pool = Executors.newFixedThreadPool(2)) {
            CountDownLatch start = new CountDownLatch(1);
            Callable<Boolean> refresh =
                    () -> {
                        start.await();
                        try {
                            auth.refresh(new RefreshRequest(registered.refreshToken()));
                            return true;
                        } catch (com.linkit.common.ApiException error) {
                            if (error.status().value() != 401) throw error;
                            return false;
                        }
                    };
            Future<Boolean> first = pool.submit(refresh), second = pool.submit(refresh);
            start.countDown();
            int winners =
                    (first.get(20, TimeUnit.SECONDS) ? 1 : 0)
                            + (second.get(20, TimeUnit.SECONDS) ? 1 : 0);
            assertThat(winners).isEqualTo(1);
            assertThat(
                            jdbc.queryForObject(
                                    "SELECT COUNT(*) FROM dbo.refresh_tokens WHERE user_id=? AND revoked_at IS NULL",
                                    Integer.class,
                                    id))
                    .isEqualTo(1);
        } finally {
            new TransactionTemplate(manager)
                    .executeWithoutResult(
                            status -> {
                                jdbc.update("DELETE FROM dbo.audit_logs WHERE actor_user_id=?", id);
                                jdbc.update("DELETE FROM dbo.refresh_tokens WHERE user_id=?", id);
                                jdbc.update("DELETE FROM dbo.client_profiles WHERE user_id=?", id);
                                jdbc.update("DELETE FROM dbo.user_roles WHERE user_id=?", id);
                                jdbc.update(
                                        "DELETE FROM dbo.users WHERE id=? AND email=?", id, email);
                            });
            assertThat(counts()).isEqualTo(initial);
        }
    }
}
