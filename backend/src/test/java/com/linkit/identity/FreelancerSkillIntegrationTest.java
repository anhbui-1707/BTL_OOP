package com.linkit.identity;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.linkit.auth.dto.AuthDtos.*;
import com.linkit.auth.service.AuthService;
import com.linkit.identity.entity.UserRole.Role;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.*;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.*;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

@SpringBootTest(
        properties = {
            "spring.datasource.url=jdbc:sqlserver://localhost:1433;databaseName=LinkIT_V2;integratedSecurity=true;encrypt=true;trustServerCertificate=true",
            "spring.datasource.username=",
            "spring.datasource.password=",
            "spring.jpa.hibernate.ddl-auto=validate"
        })
@AutoConfigureMockMvc(print = MockMvcPrint.NONE)
@EnabledIfEnvironmentVariable(named = "LINKIT_PROFILE_SKILL_TEST", matches = "true")
@Transactional
class FreelancerSkillIntegrationTest {
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
    @Autowired AuthService auth;
    @Autowired ObjectMapper json;
    @Autowired jakarta.persistence.EntityManager entities;

    private TokenResponse account(Role role) {
        return auth.register(
                new RegisterRequest(
                        "profile-" + UUID.randomUUID() + "@example.invalid",
                        "Test-" + UUID.randomUUID(),
                        "Profile test",
                        role));
    }

    private String input(String name, int proficiency, int years) throws Exception {
        return json.writeValueAsString(
                Map.of("name", name, "proficiency", proficiency, "yearsExperience", years));
    }

    private long create(TokenResponse actor, String name) throws Exception {
        String body =
                mvc.perform(
                                post("/api/skills/me")
                                        .header("Authorization", "Bearer " + actor.accessToken())
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(input(name, 3, 2)))
                        .andExpect(status().isCreated())
                        .andExpect(jsonPath("$.name").value(name))
                        .andExpect(jsonPath("$.proficiency").value(3))
                        .andExpect(jsonPath("$.yearsExperience").value(2))
                        .andReturn()
                        .getResponse()
                        .getContentAsString();
        return json.readTree(body).get("id").asLong();
    }

    @Test
    void crudPersistsAndDoesNotRenameSharedCatalog() throws Exception {
        var owner = account(Role.FREELANCER);
        var other = account(Role.FREELANCER);
        String name = "Profile skill " + UUID.randomUUID();
        long id = create(owner, name);
        create(other, name);
        mvc.perform(
                        put("/api/skills/me/" + id)
                                .header("Authorization", "Bearer " + owner.accessToken())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(input(name, 5, 7)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(id));
        entities.flush();
        entities.clear();
        mvc.perform(get("/api/skills/me").header("Authorization", "Bearer " + owner.accessToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].proficiency").value(5))
                .andExpect(jsonPath("$[0].yearsExperience").value(7));
        String renamed = "Renamed " + UUID.randomUUID();
        String body =
                mvc.perform(
                                put("/api/skills/me/" + id)
                                        .header("Authorization", "Bearer " + owner.accessToken())
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(input(renamed, 4, 8)))
                        .andExpect(status().isOk())
                        .andReturn()
                        .getResponse()
                        .getContentAsString();
        long newId = json.readTree(body).get("id").asLong();
        mvc.perform(get("/api/skills/me").header("Authorization", "Bearer " + other.accessToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].name").value(name))
                .andExpect(jsonPath("$[0].proficiency").value(3));
        mvc.perform(
                        delete("/api/skills/me/" + newId)
                                .header("Authorization", "Bearer " + owner.accessToken()))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/skills/me").header("Authorization", "Bearer " + owner.accessToken()))
                .andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void rejectsAnonymousWrongRoleAndOtherOwnersSkill() throws Exception {
        var owner = account(Role.FREELANCER);
        var other = account(Role.FREELANCER);
        var client = account(Role.CLIENT);
        long id = create(owner, "Private " + UUID.randomUUID());
        mvc.perform(get("/api/skills/me")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/skills/me").with(user("admin").roles("ADMIN")))
                .andExpect(status().isForbidden());
        mvc.perform(
                        post("/api/skills/me")
                                .with(user("admin").roles("ADMIN"))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(input("Denied", 1, 0)))
                .andExpect(status().isForbidden());
        mvc.perform(
                        put("/api/skills/me/" + id)
                                .with(user("admin").roles("ADMIN"))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(input("Denied", 1, 0)))
                .andExpect(status().isForbidden());
        mvc.perform(delete("/api/skills/me/" + id).with(user("admin").roles("ADMIN")))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/skills/me").header("Authorization", "Bearer " + client.accessToken()))
                .andExpect(status().isForbidden());
        mvc.perform(
                        post("/api/skills/me")
                                .header("Authorization", "Bearer " + client.accessToken())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(input("Denied", 1, 0)))
                .andExpect(status().isForbidden());
        mvc.perform(
                        put("/api/skills/me/" + id)
                                .header("Authorization", "Bearer " + client.accessToken())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(input("Denied", 1, 0)))
                .andExpect(status().isForbidden());
        mvc.perform(
                        delete("/api/skills/me/" + id)
                                .header("Authorization", "Bearer " + client.accessToken()))
                .andExpect(status().isForbidden());
        mvc.perform(
                        put("/api/skills/me/" + id)
                                .header("Authorization", "Bearer " + other.accessToken())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(input("Denied", 1, 0)))
                .andExpect(status().isNotFound());
        mvc.perform(
                        delete("/api/skills/me/" + id)
                                .header("Authorization", "Bearer " + other.accessToken()))
                .andExpect(status().isNotFound());
        mvc.perform(get("/api/skills/me").header("Authorization", "Bearer " + owner.accessToken()))
                .andExpect(jsonPath("$.length()").value(1));
    }

    @Test
    void validatesInputAndRejectsDuplicateWithoutLosingExistingSkill() throws Exception {
        var owner = account(Role.FREELANCER);
        String name = "Validation " + UUID.randomUUID();
        long id = create(owner, name);
        long second = create(owner, "Second " + UUID.randomUUID());
        mvc.perform(
                        post("/api/skills/me")
                                .header("Authorization", "Bearer " + owner.accessToken())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(input(name, 3, 2)))
                .andExpect(status().isConflict());
        mvc.perform(
                        put("/api/skills/me/" + second)
                                .header("Authorization", "Bearer " + owner.accessToken())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(input(name, 4, 3)))
                .andExpect(status().isConflict());
        for (String invalid :
                List.of(
                        input(" ", 1, 0),
                        input("x".repeat(101), 1, 0),
                        input("Valid", 0, 0),
                        input("Valid", 6, 0),
                        input("Valid", 1, -1),
                        "{\"name\":\"Missing fields\"}")) {
            mvc.perform(
                            put("/api/skills/me/" + id)
                                    .header("Authorization", "Bearer " + owner.accessToken())
                                    .contentType(MediaType.APPLICATION_JSON)
                                    .content(invalid))
                    .andExpect(status().isUnprocessableEntity());
        }
        mvc.perform(get("/api/skills/me").header("Authorization", "Bearer " + owner.accessToken()))
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].proficiency").value(3));
    }
}
