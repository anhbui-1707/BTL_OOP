package com.linkit.auth.security;

import static org.assertj.core.api.Assertions.*;

import com.linkit.auth.security.JwtConfiguration;
import com.linkit.auth.security.JwtSettings;
import com.nimbusds.jose.jwk.source.ImmutableSecret;

import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.*;

import java.security.SecureRandom;
import java.time.*;
import java.util.*;

import javax.crypto.spec.SecretKeySpec;

class JwtSecurityTest {
    private final JwtConfiguration config = new JwtConfiguration();
    private final JwtSettings settings =
            new JwtSettings(
                    randomKey(),
                    "test-issuer",
                    "test-api",
                    Duration.ofMinutes(15),
                    Duration.ofDays(30));
    private final JwtEncoder encoder = config.jwtEncoder(config.jwtKey(settings));
    private final JwtDecoder decoder = config.jwtDecoder(config.jwtKey(settings), settings);

    static String randomKey() {
        byte[] bytes = new byte[32];
        new SecureRandom().nextBytes(bytes);
        return Base64.getEncoder().encodeToString(bytes);
    }

    private String token(JwtEncoder signer, String issuer, String audience, Instant expiry) {
        var claims =
                JwtClaimsSet.builder()
                        .subject("1")
                        .issuer(issuer)
                        .audience(List.of(audience))
                        .claim("sid", "1")
                        .issuedAt(Instant.now().minusSeconds(600));
        if (expiry != null) claims.expiresAt(expiry);
        return signer.encode(
                        JwtEncoderParameters.from(
                                JwsHeader.with(MacAlgorithm.HS256).type("JWT").build(),
                                claims.build()))
                .getTokenValue();
    }

    @Test
    void acceptsValidSignedToken() {
        assertThat(
                        decoder.decode(
                                        token(
                                                encoder,
                                                "test-issuer",
                                                "test-api",
                                                Instant.now().plusSeconds(60)))
                                .getSubject())
                .isEqualTo("1");
    }

    @Test
    void rejectsExpiredToken() {
        assertThatThrownBy(
                        () ->
                                decoder.decode(
                                        token(
                                                encoder,
                                                "test-issuer",
                                                "test-api",
                                                Instant.now().minusSeconds(120))))
                .isInstanceOf(JwtException.class);
    }

    @Test
    void rejectsWrongSignatureAndTampering() {
        var other =
                new NimbusJwtEncoder(
                        new ImmutableSecret<>(
                                new SecretKeySpec(
                                        Base64.getDecoder().decode(randomKey()), "HmacSHA256")));
        assertThatThrownBy(
                        () ->
                                decoder.decode(
                                        token(
                                                other,
                                                "test-issuer",
                                                "test-api",
                                                Instant.now().plusSeconds(60))))
                .isInstanceOf(JwtException.class);
        String good = token(encoder, "test-issuer", "test-api", Instant.now().plusSeconds(60));
        String[] parts = good.split("\\.");
        String changed =
                parts[0]
                        + "."
                        + Base64.getUrlEncoder()
                                .withoutPadding()
                                .encodeToString(
                                        "{\"sub\":\"131\"}"
                                                .getBytes(java.nio.charset.StandardCharsets.UTF_8))
                        + "."
                        + parts[2];
        assertThatThrownBy(() -> decoder.decode(changed)).isInstanceOf(JwtException.class);
    }

    @Test
    void rejectsWrongIssuerAudienceAndMissingExpiry() {
        assertThatThrownBy(
                        () ->
                                decoder.decode(
                                        token(
                                                encoder,
                                                "other",
                                                "test-api",
                                                Instant.now().plusSeconds(60))))
                .isInstanceOf(JwtException.class);
        assertThatThrownBy(
                        () ->
                                decoder.decode(
                                        token(
                                                encoder,
                                                "test-issuer",
                                                "other",
                                                Instant.now().plusSeconds(60))))
                .isInstanceOf(JwtException.class);
        assertThatThrownBy(() -> decoder.decode(token(encoder, "test-issuer", "test-api", null)))
                .isInstanceOf(JwtException.class);
    }

    @Test
    void rejectsWeakAndMissingSigningKeys() {
        assertThatThrownBy(
                        () ->
                                config.jwtKey(
                                        new JwtSettings(
                                                Base64.getEncoder().encodeToString(new byte[8]),
                                                "i",
                                                "a",
                                                Duration.ofMinutes(15),
                                                Duration.ofDays(30))))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(
                        () ->
                                new JwtSettings(
                                        null,
                                        "i",
                                        "a",
                                        Duration.ofMinutes(15),
                                        Duration.ofDays(30)))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
