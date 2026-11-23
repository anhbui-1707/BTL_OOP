package com.linkit.auth.security;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;

@ConfigurationProperties("linkit.jwt")
public record JwtSettings(
        String secret, String issuer, String audience, Duration accessTtl, Duration refreshTtl) {
    public JwtSettings {
        if (secret == null || secret.isBlank())
            throw new IllegalArgumentException("LINKIT_JWT_SECRET is required");
        if (issuer == null || issuer.isBlank() || audience == null || audience.isBlank())
            throw new IllegalArgumentException("JWT issuer/audience are required");
        if (accessTtl == null
                || accessTtl.compareTo(Duration.ofMinutes(1)) < 0
                || accessTtl.compareTo(Duration.ofHours(1)) > 0)
            throw new IllegalArgumentException(
                    "JWT access TTL must be between 1 minute and 1 hour");
        if (refreshTtl == null
                || refreshTtl.compareTo(Duration.ofHours(1)) < 0
                || refreshTtl.compareTo(Duration.ofDays(90)) > 0)
            throw new IllegalArgumentException("Refresh TTL must be between 1 hour and 90 days");
    }

    @Override
    public String toString() {
        return "JwtSettings[redacted]";
    }
}
