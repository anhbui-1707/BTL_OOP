package com.linkit.common;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.linkit.auth.security.SessionAuthenticationConverter;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.bind.annotation.*;

@WebMvcTest(
        controllers = SecurityConfigurationTest.Probes.class,
        properties = "LINKIT_CORS_ALLOWED_ORIGINS=https://frontend.example.test")
@Import({SecurityConfiguration.class, SecurityConfigurationTest.Probes.class})
class SecurityConfigurationTest {
    @Autowired MockMvc mvc;
    @Autowired PasswordEncoder passwordEncoder;
    @MockitoBean JwtDecoder decoder;
    @MockitoBean SessionAuthenticationConverter converter;

    @RestController
    static class Probes {
        @GetMapping("/api/admin/probe")
        String admin() {
            return "admin";
        }

        @GetMapping("/api/client/probe")
        String client() {
            return "client";
        }

        @GetMapping("/api/freelancer/probe")
        String freelancer() {
            return "freelancer";
        }
    }

    @Test
    void anonymousRequestIsUnauthorized() throws Exception {
        mvc.perform(get("/api/projects")).andExpect(status().isUnauthorized());
    }

    @Test
    void authenticatedRequestIsStillDeniedUntilApisAreImplemented() throws Exception {
        mvc.perform(get("/api/projects").with(user("client").roles("CLIENT")))
                .andExpect(status().isForbidden());
    }

    @Test
    void passwordEncoderUsesSaltedBcrypt() {
        String encoded = passwordEncoder.encode("test-only-password");
        assertThat(encoded).startsWith("$2");
        assertThat(passwordEncoder.matches("test-only-password", encoded)).isTrue();
        assertThat(passwordEncoder.matches("wrong-password", encoded)).isFalse();
        assertThat(passwordEncoder.encode("test-only-password")).isNotEqualTo(encoded);
    }

    @Test
    void rolePrefixesRequireTheExactRole() throws Exception {
        mvc.perform(get("/api/admin/probe").with(user("client").roles("CLIENT")))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/admin/probe").with(user("admin").roles("ADMIN")))
                .andExpect(status().isOk());
        mvc.perform(get("/api/client/probe").with(user("freelancer").roles("FREELANCER")))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/client/probe").with(user("client").roles("CLIENT")))
                .andExpect(status().isOk());
        mvc.perform(get("/api/freelancer/probe").with(user("freelancer").roles("FREELANCER")))
                .andExpect(status().isOk());
    }

    @Test
    void corsOnlyPermitsConfiguredOrigins() throws Exception {
        mvc.perform(
                        options("/api/auth/login")
                                .header("Origin", "https://frontend.example.test")
                                .header("Access-Control-Request-Method", "POST")
                                .header("Access-Control-Request-Headers", "content-type"))
                .andExpect(status().isOk())
                .andExpect(
                        header().string(
                                        "Access-Control-Allow-Origin",
                                        "https://frontend.example.test"));
        mvc.perform(
                        options("/api/jobs/1")
                                .header("Origin", "https://frontend.example.test")
                                .header("Access-Control-Request-Method", "PUT")
                                .header(
                                        "Access-Control-Request-Headers",
                                        "authorization,content-type,if-match"))
                .andExpect(status().isOk())
                .andExpect(header().exists("Access-Control-Allow-Headers"));
        mvc.perform(
                        options("/api/auth/login")
                                .header("Origin", "https://unknown.example.test")
                                .header("Access-Control-Request-Method", "POST"))
                .andExpect(status().isForbidden());
    }
}
