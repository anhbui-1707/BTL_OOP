package com.linkit.auth.security;

import com.linkit.auth.repository.RefreshTokenRepository;
import com.linkit.identity.entity.User;

import org.springframework.core.convert.converter.Converter;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.core.*;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.util.stream.Collectors;

@Component
public class SessionAuthenticationConverter implements Converter<Jwt, AbstractAuthenticationToken> {
    private final RefreshTokenRepository tokens;
    private final Clock clock;

    public SessionAuthenticationConverter(RefreshTokenRepository tokens, Clock clock) {
        this.tokens = tokens;
        this.clock = clock;
    }

    @Override
    @Transactional(readOnly = true)
    public AbstractAuthenticationToken convert(Jwt jwt) {
        long userId, sessionId;
        try {
            userId = Long.parseLong(jwt.getSubject());
            sessionId = Long.parseLong(jwt.getClaimAsString("sid"));
        } catch (RuntimeException error) {
            throw invalid();
        }
        var token =
                tokens.findSessionById(sessionId)
                        .orElseThrow(SessionAuthenticationConverter::invalid);
        User user = token.getUser();
        if (user.getId() != userId
                || user.getStatus() != User.Status.ACTIVE
                || token.getRevokedAt() != null
                || !token.getExpiresAt().isAfter(clock.instant())
                || user.getRoles().isEmpty()) throw invalid();
        var roles =
                user.getRoles().stream()
                        .map(role -> role.getId().getRole())
                        .collect(Collectors.toUnmodifiableSet());
        var authorities =
                roles.stream()
                        .map(role -> new SimpleGrantedAuthority("ROLE_" + role.name()))
                        .toList();
        return UsernamePasswordAuthenticationToken.authenticated(
                new AuthPrincipal(userId, roles), null, authorities);
    }

    private static OAuth2AuthenticationException invalid() {
        return new OAuth2AuthenticationException(
                new OAuth2Error("invalid_token"), "Invalid access token");
    }
}
