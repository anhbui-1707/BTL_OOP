package com.linkit.auth.service;

import com.linkit.auth.security.JwtSettings;
import com.linkit.identity.entity.User;

import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Component
public class AccessTokenService {
    private final JwtEncoder encoder;
    private final JwtSettings settings;

    public AccessTokenService(JwtEncoder encoder, JwtSettings settings) {
        this.encoder = encoder;
        this.settings = settings;
    }

    public String issue(User user, Long sessionId, Instant now) {
        var claims =
                JwtClaimsSet.builder()
                        .issuer(settings.issuer())
                        .audience(List.of(settings.audience()))
                        .subject(user.getId().toString())
                        .issuedAt(now)
                        .expiresAt(now.plus(settings.accessTtl()))
                        .id(UUID.randomUUID().toString())
                        .claim("sid", sessionId.toString())
                        .claim(
                                "roles",
                                user.getRoles().stream()
                                        .map(role -> role.getId().getRole().name())
                                        .sorted()
                                        .toList())
                        .build();
        return encoder.encode(
                        JwtEncoderParameters.from(
                                JwsHeader.with(MacAlgorithm.HS256).type("JWT").build(), claims))
                .getTokenValue();
    }
}
