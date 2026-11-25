package com.linkit.common;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.linkit.auth.security.SessionAuthenticationConverter;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.web.cors.*;

import java.net.URI;
import java.util.Arrays;
import java.util.List;

@Configuration(proxyBeanMethods = false)
@EnableMethodSecurity
public class SecurityConfiguration {
    @Bean
    SecurityFilterChain securityFilterChain(
            HttpSecurity http,
            JwtDecoder decoder,
            SessionAuthenticationConverter converter,
            ObjectMapper json,
            @Qualifier("corsConfigurationSource") CorsConfigurationSource cors)
            throws Exception {
        AuthenticationEntryPoint unauthorized =
                (request, response, error) -> {
                    response.setStatus(401);
                    response.setContentType("application/json;charset=UTF-8");
                    response.setHeader("Cache-Control", "no-store");
                    response.setHeader("WWW-Authenticate", "Bearer");
                    json.writeValue(
                            response.getOutputStream(),
                            ApiError.of(
                                    401,
                                    "UNAUTHORIZED",
                                    "Thông tin xác thực không hợp lệ hoặc đã hết hạn."));
                };
        AccessDeniedHandler forbidden =
                (request, response, error) -> {
                    response.setStatus(403);
                    response.setContentType("application/json;charset=UTF-8");
                    response.setHeader("Cache-Control", "no-store");
                    json.writeValue(
                            response.getOutputStream(),
                            ApiError.of(
                                    403,
                                    "FORBIDDEN",
                                    "Bạn không có quyền truy cập tài nguyên này."));
                };
        return http.csrf(AbstractHttpConfigurer::disable)
                .cors(configuration -> configuration.configurationSource(cors))
                .authorizeHttpRequests(
                        requests ->
                                requests.requestMatchers(
                                                HttpMethod.POST,
                                                "/api/auth/password/request",
                                                "/api/auth/password/confirm")
                                        .permitAll()
                                        .requestMatchers(
                                                HttpMethod.POST, "/api/public/support-requests")
                                        .permitAll()
                                        .requestMatchers(HttpMethod.POST, "/api/support-requests")
                                        .hasAnyRole("CLIENT", "FREELANCER")
                                        .requestMatchers(HttpMethod.GET, "/api/support-requests/me")
                                        .hasAnyRole("CLIENT", "FREELANCER")
                                        .requestMatchers(
                                                HttpMethod.POST,
                                                "/api/auth/register",
                                                "/api/auth/login",
                                                "/api/auth/refresh",
                                                "/api/auth/logout")
                                        .permitAll()
                                        .requestMatchers(HttpMethod.GET, "/api/auth/me")
                                        .hasAnyRole("ADMIN", "CLIENT", "FREELANCER")
                                        .requestMatchers(HttpMethod.GET, "/api/users/me")
                                        .hasAnyRole("ADMIN", "CLIENT", "FREELANCER")
                                        .requestMatchers(HttpMethod.PUT, "/api/users/me")
                                        .hasAnyRole("ADMIN", "CLIENT", "FREELANCER")
                                        .requestMatchers(HttpMethod.GET, "/api/avatars/*")
                                        .permitAll()
                                        .requestMatchers(
                                                HttpMethod.GET,
                                                "/api/public/jobs",
                                                "/api/public/jobs/*",
                                                "/api/public/freelancers",
                                                "/api/public/freelancers/*",
                                                "/api/public/clients/*",
                                                "/api/public/clients/*/jobs")
                                        .permitAll()
                                        .requestMatchers(
                                                HttpMethod.GET, "/api/freelancers/me/visibility")
                                        .hasRole("FREELANCER")
                                        .requestMatchers(HttpMethod.PUT, "/api/freelancers/me")
                                        .hasRole("FREELANCER")
                                        .requestMatchers(HttpMethod.GET, "/api/clients/me")
                                        .hasRole("CLIENT")
                                        .requestMatchers(HttpMethod.PUT, "/api/clients/me")
                                        .hasRole("CLIENT")
                                        .requestMatchers(
                                                HttpMethod.GET,
                                                "/api/freelancers/me",
                                                "/api/cvs/me",
                                                "/api/cvs/*/download",
                                                "/api/work-experiences/me",
                                                "/api/portfolios/me")
                                        .hasRole("FREELANCER")
                                        .requestMatchers(
                                                HttpMethod.POST,
                                                "/api/cvs/me/upload",
                                                "/api/work-experiences/me",
                                                "/api/portfolios/me")
                                        .hasRole("FREELANCER")
                                        .requestMatchers(
                                                HttpMethod.PUT,
                                                "/api/work-experiences/me/*",
                                                "/api/portfolios/me/*")
                                        .hasRole("FREELANCER")
                                        .requestMatchers(
                                                HttpMethod.DELETE,
                                                "/api/cvs/me/*",
                                                "/api/work-experiences/me/*",
                                                "/api/portfolios/me/*")
                                        .hasRole("FREELANCER")
                                        .requestMatchers(
                                                HttpMethod.PUT, "/api/freelancers/me/visibility")
                                        .hasRole("FREELANCER")
                                        .requestMatchers(HttpMethod.POST, "/api/users/me/avatar")
                                        .hasAnyRole("CLIENT", "FREELANCER")
                                        .requestMatchers(
                                                HttpMethod.GET, "/api/public/marketplace-stats")
                                        .permitAll()
                                        .requestMatchers(HttpMethod.GET, "/api/skills")
                                        .permitAll()
                                        .requestMatchers(HttpMethod.GET, "/api/skills/me")
                                        .hasRole("FREELANCER")
                                        .requestMatchers(HttpMethod.POST, "/api/skills/me")
                                        .hasRole("FREELANCER")
                                        .requestMatchers(HttpMethod.PUT, "/api/skills/me/*")
                                        .hasRole("FREELANCER")
                                        .requestMatchers(HttpMethod.DELETE, "/api/skills/me/*")
                                        .hasRole("FREELANCER")
                                        .requestMatchers(
                                                HttpMethod.GET,
                                                "/api/assignments/*/final-acceptance")
                                        .hasAnyRole("CLIENT", "FREELANCER")
                                        .requestMatchers(
                                                HttpMethod.GET, "/api/assignments/*/review")
                                        .hasAnyRole("CLIENT", "FREELANCER", "ADMIN")
                                        .requestMatchers(
                                                HttpMethod.POST,
                                                "/api/assignments/*/final-acceptance",
                                                "/api/assignments/*/review")
                                        .hasRole("CLIENT")
                                        .requestMatchers(
                                                HttpMethod.GET, "/api/assignments/*/milestones")
                                        .hasAnyRole("CLIENT", "FREELANCER", "ADMIN")
                                        .requestMatchers(
                                                HttpMethod.GET,
                                                "/api/milestones/*",
                                                "/api/milestones/*/submissions")
                                        .hasAnyRole("CLIENT", "FREELANCER")
                                        .requestMatchers(
                                                HttpMethod.POST,
                                                "/api/assignments/*/milestones",
                                                "/api/submissions/*/approve",
                                                "/api/submissions/*/request-revision")
                                        .hasRole("CLIENT")
                                        .requestMatchers(
                                                HttpMethod.POST, "/api/milestones/*/submissions")
                                        .hasRole("FREELANCER")
                                        .requestMatchers(HttpMethod.PUT, "/api/milestones/*")
                                        .hasRole("CLIENT")
                                        .requestMatchers(HttpMethod.DELETE, "/api/milestones/*")
                                        .hasRole("CLIENT")
                                        .requestMatchers(
                                                HttpMethod.GET,
                                                "/api/assignments/*/scope-document",
                                                "/api/assignments/*/scope-document/file")
                                        .hasAnyRole("CLIENT", "FREELANCER")
                                        .requestMatchers(
                                                HttpMethod.POST,
                                                "/api/assignments/*/scope-document")
                                        .hasRole("CLIENT")
                                        .requestMatchers(
                                                HttpMethod.GET,
                                                "/api/assignments/*/scopes",
                                                "/api/scopes/*")
                                        .hasAnyRole("CLIENT", "FREELANCER")
                                        .requestMatchers(
                                                HttpMethod.POST,
                                                "/api/assignments/*/scopes",
                                                "/api/scopes/*/submit",
                                                "/api/scopes/*/approve")
                                        .hasAnyRole("CLIENT", "FREELANCER")
                                        .requestMatchers(HttpMethod.GET, "/api/jobs/*/candidates")
                                        .hasRole("CLIENT")
                                        .requestMatchers(
                                                HttpMethod.POST,
                                                "/api/proposals/*/select")
                                        .hasRole("CLIENT")
                                        .requestMatchers(
                                                HttpMethod.GET,
                                                "/api/assignments",
                                                "/api/assignments/*")
                                        .hasAnyRole("ADMIN", "CLIENT", "FREELANCER")
                                        .requestMatchers(
                                                HttpMethod.POST,
                                                "/api/jobs/*/proposals",
                                                "/api/proposals/*/withdraw")
                                        .hasRole("FREELANCER")
                                        .requestMatchers(HttpMethod.GET, "/api/jobs/*/proposals")
                                        .hasRole("CLIENT")
                                        .requestMatchers(HttpMethod.GET, "/api/proposals/me")
                                        .hasRole("FREELANCER")
                                        .requestMatchers(
                                                HttpMethod.GET, "/api/proposals/*/cv/download")
                                        .hasAnyRole("CLIENT", "FREELANCER")
                                        .requestMatchers(HttpMethod.GET, "/api/proposals/*")
                                        .hasAnyRole("CLIENT", "FREELANCER")
                                        .requestMatchers(
                                                HttpMethod.PATCH, "/api/proposals/*/status")
                                        .hasRole("CLIENT")
                                        .requestMatchers(HttpMethod.GET, "/api/jobs", "/api/jobs/*")
                                        .hasAnyRole("ADMIN", "CLIENT", "FREELANCER")
                                        .requestMatchers(
                                                HttpMethod.POST, "/api/jobs", "/api/jobs/*/publish")
                                        .hasRole("CLIENT")
                                        .requestMatchers(HttpMethod.PUT, "/api/jobs/*")
                                        .hasRole("CLIENT")
                                        .requestMatchers(HttpMethod.DELETE, "/api/jobs/*")
                                        .hasAnyRole("CLIENT", "ADMIN")
                                        .requestMatchers("/api/admin/**")
                                        .hasRole("ADMIN")
                                        .requestMatchers(
                                                HttpMethod.GET,
                                                "/api/notifications",
                                                "/api/notifications/unread-count")
                                        .hasAnyRole("ADMIN", "CLIENT", "FREELANCER")
                                        .requestMatchers(
                                                HttpMethod.PATCH,
                                                "/api/notifications/*/read",
                                                "/api/notifications/read-all")
                                        .hasAnyRole("ADMIN", "CLIENT", "FREELANCER")
                                        .requestMatchers("/api/client/**")
                                        .hasRole("CLIENT")
                                        .requestMatchers("/api/freelancer/**")
                                        .hasRole("FREELANCER")
                                        .anyRequest()
                                        .denyAll())
                .sessionManagement(
                        session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .formLogin(AbstractHttpConfigurer::disable)
                .httpBasic(AbstractHttpConfigurer::disable)
                .logout(AbstractHttpConfigurer::disable)
                .requestCache(AbstractHttpConfigurer::disable)
                .exceptionHandling(
                        errors ->
                                errors.authenticationEntryPoint(unauthorized)
                                        .accessDeniedHandler(forbidden))
                .oauth2ResourceServer(
                        resource ->
                                resource.jwt(
                                                jwt ->
                                                        jwt.decoder(decoder)
                                                                .jwtAuthenticationConverter(
                                                                        converter))
                                        .authenticationEntryPoint(unauthorized)
                                        .accessDeniedHandler(forbidden))
                .build();
    }

    @Bean
    CorsConfigurationSource corsConfigurationSource(
            @Value("${LINKIT_CORS_ALLOWED_ORIGINS:}") String origins) {
        List<String> allowed =
                Arrays.stream(origins.split(","))
                        .map(String::strip)
                        .filter(value -> !value.isEmpty())
                        .toList();
        for (String origin : allowed) {
            URI uri;
            try {
                uri = URI.create(origin);
            } catch (IllegalArgumentException error) {
                throw new IllegalArgumentException("Invalid CORS origin");
            }
            if (!("https".equals(uri.getScheme()) || "http".equals(uri.getScheme()))
                    || uri.getHost() == null
                    || uri.getRawUserInfo() != null
                    || uri.getRawQuery() != null
                    || uri.getRawFragment() != null
                    || !uri.getRawPath().isEmpty()
                    || uri.getPort() > 65535)
                throw new IllegalArgumentException(
                        "CORS requires exact HTTP(S) origins without paths or wildcards");
        }
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOrigins(allowed);
        configuration.setAllowedMethods(
                List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(List.of("Authorization", "Content-Type", "If-Match"));
        configuration.setExposedHeaders(List.of("ETag", "Location"));
        configuration.setAllowCredentials(false);
        configuration.setMaxAge(3600L);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/**", configuration);
        return source;
    }

    @Bean
    PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
