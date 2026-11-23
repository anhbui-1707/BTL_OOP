package com.linkit.auth.security;

import com.nimbusds.jose.jwk.source.ImmutableSecret;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.*;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.*;

import java.time.Clock;
import java.time.Duration;
import java.util.Base64;
import java.util.List;

import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;

@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties(JwtSettings.class)
public class JwtConfiguration {
    @Bean
    SecretKey jwtKey(JwtSettings settings) {
        byte[] bytes;
        try {
            bytes = Base64.getDecoder().decode(settings.secret());
        } catch (IllegalArgumentException ex) {
            throw new IllegalArgumentException("LINKIT_JWT_SECRET must be Base64", null);
        }
        if (bytes.length < 32)
            throw new IllegalArgumentException(
                    "JWT signing key must contain at least 32 random bytes");
        return new SecretKeySpec(bytes, "HmacSHA256");
    }

    @Bean
    JwtEncoder jwtEncoder(SecretKey jwtKey) {
        return new NimbusJwtEncoder(new ImmutableSecret<>(jwtKey));
    }

    @Bean
    JwtDecoder jwtDecoder(SecretKey jwtKey, JwtSettings settings) {
        NimbusJwtDecoder decoder =
                NimbusJwtDecoder.withSecretKey(jwtKey).macAlgorithm(MacAlgorithm.HS256).build();
        decoder.setJwtValidator(
                new DelegatingOAuth2TokenValidator<>(
                        new JwtTimestampValidator(Duration.ofSeconds(30)),
                        new JwtIssuerValidator(settings.issuer()),
                        new JwtClaimValidator<java.time.Instant>("exp", expiry -> expiry != null),
                        new JwtClaimValidator<List<String>>(
                                "aud",
                                audiences ->
                                        audiences != null
                                                && audiences.contains(settings.audience()))));
        return decoder;
    }

    @Bean
    Clock authClock() {
        return Clock.systemUTC();
    }
}
