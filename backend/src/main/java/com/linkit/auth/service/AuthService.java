package com.linkit.auth.service;

import com.linkit.audit.entity.AuditLog;
import com.linkit.audit.repository.AuditLogRepository;
import com.linkit.auth.dto.AuthDtos.*;
import com.linkit.auth.entity.RefreshToken;
import com.linkit.auth.repository.RefreshTokenRepository;
import com.linkit.auth.security.JwtSettings;
import com.linkit.common.ApiException;
import com.linkit.identity.entity.*;
import com.linkit.identity.repository.*;

import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Base64;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class AuthService {
    private final UserRepository users;
    private final UserRoleRepository roles;
    private final ClientProfileRepository clients;
    private final FreelancerProfileRepository freelancers;
    private final RefreshTokenRepository tokens;
    private final PasswordEncoder passwords;
    private final AccessTokenService accessTokens;
    private final JwtSettings settings;
    private final Clock clock;
    private final AuditLogRepository audit;
    private final SecureRandom random = new SecureRandom();
    private final String dummyHash;

    public AuthService(
            UserRepository users,
            UserRoleRepository roles,
            ClientProfileRepository clients,
            FreelancerProfileRepository freelancers,
            RefreshTokenRepository tokens,
            PasswordEncoder passwords,
            AccessTokenService accessTokens,
            JwtSettings settings,
            Clock clock,
            AuditLogRepository audit) {
        this.users = users;
        this.roles = roles;
        this.clients = clients;
        this.freelancers = freelancers;
        this.tokens = tokens;
        this.passwords = passwords;
        this.accessTokens = accessTokens;
        this.settings = settings;
        this.clock = clock;
        this.audit = audit;
        dummyHash = passwords.encode(UUID.randomUUID().toString());
    }

    @Transactional
    public TokenResponse register(RegisterRequest request) {
        if (request.role() == UserRole.Role.ADMIN)
            throw new ApiException(
                    HttpStatus.FORBIDDEN, "FORBIDDEN", "Không thể tự đăng ký vai trò ADMIN.");
        if (request.password().getBytes(StandardCharsets.UTF_8).length > 72)
            throw new ApiException(
                    HttpStatus.UNPROCESSABLE_ENTITY,
                    "VALIDATION_FAILED",
                    "Mật khẩu tối đa 72 byte UTF-8.");
        if (users.existsByEmailIgnoreCase(request.email()))
            throw new ApiException(HttpStatus.CONFLICT, "EMAIL_EXISTS", "Email đã được sử dụng.");
        Instant now = now();
        User user = new User();
        user.setEmail(request.email());
        user.setFullName(request.fullName());
        user.setPasswordHash(passwords.encode(request.password()));
        user.setStatus(User.Status.ACTIVE);
        user.setCreatedAt(now);
        user.setUpdatedAt(now);
        users.saveAndFlush(user);
        UserRole role = new UserRole();
        role.setId(new UserRoleId(user.getId(), request.role()));
        role.setUser(user);
        role.setAssignedAt(now);
        user.getRoles().add(roles.save(role));
        if (request.role() == UserRole.Role.CLIENT) {
            ClientProfile profile = new ClientProfile();
            profile.setUser(user);
            profile.setUpdatedAt(now);
            clients.saveAndFlush(profile);
        } else {
            FreelancerProfile profile = new FreelancerProfile();
            profile.setUser(user);
            profile.setUpdatedAt(now);
            profile.setYearsExperience((short) 0);
            profile.setAvailabilityStatus(FreelancerProfile.AvailabilityStatus.AVAILABLE);
            freelancers.saveAndFlush(profile);
        }
        TokenResponse response = issue(user, now);
        audit(user, "USER_REGISTERED", now);
        return response;
    }

    @Transactional
    public TokenResponse login(LoginRequest request) {
        User user = users.findByEmailIgnoreCase(request.email()).orElse(null);
        boolean matches =
                request.password().getBytes(StandardCharsets.UTF_8).length <= 72
                        && passwords.matches(
                                request.password(),
                                user == null ? dummyHash : user.getPasswordHash());
        if (!matches
                || user == null
                || user.getStatus() != User.Status.ACTIVE
                || user.getRoles().isEmpty()) throw ApiException.unauthorized();
        Instant now = now();
        TokenResponse response = issue(user, now);
        audit(user, "AUTH_LOGIN", now);
        return response;
    }

    @Transactional
    public TokenResponse refresh(RefreshRequest request) {
        if (!isRefreshToken(request.refreshToken())) throw ApiException.unauthorized();
        RefreshToken token =
                tokens.findByTokenHash(hash(request.refreshToken()))
                        .orElseThrow(ApiException::unauthorized);
        Instant now = now();
        User user = token.getUser();
        if (user.getStatus() != User.Status.ACTIVE
                || user.getRoles().isEmpty()
                || token.getRevokedAt() != null
                || !token.getExpiresAt().isAfter(now)
                || tokens.consume(token.getId(), now) != 1) throw ApiException.unauthorized();
        TokenResponse response = issue(user, now);
        audit(user, "TOKEN_REFRESHED", now);
        return response;
    }

    @Transactional
    public void logout(RefreshRequest request) {
        if (!isRefreshToken(request.refreshToken())) return;
        tokens.findByTokenHash(hash(request.refreshToken()))
                .ifPresent(
                        token -> {
                            Instant now = now();
                            User user = token.getUser();
                            if (tokens.consume(token.getId(), now) == 1)
                                audit(user, "AUTH_LOGOUT", now);
                        });
    }

    @Transactional(readOnly = true)
    public UserResponse current(Long userId) {
        User user = users.findWithRolesById(userId).orElseThrow(ApiException::unauthorized);
        if (user.getStatus() != User.Status.ACTIVE) throw ApiException.unauthorized();
        return response(user);
    }

    private TokenResponse issue(User user, Instant now) {
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        String raw = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        RefreshToken token = new RefreshToken();
        token.setUser(user);
        token.setTokenHash(hash(raw));
        token.setCreatedAt(now);
        token.setExpiresAt(now.plus(settings.refreshTtl()));
        tokens.saveAndFlush(token);
        return new TokenResponse(
                accessTokens.issue(user, token.getId(), now),
                raw,
                "Bearer",
                settings.accessTtl().toSeconds(),
                token.getExpiresAt(),
                response(user));
    }

    private static UserResponse response(User user) {
        return new UserResponse(
                user.getId(),
                user.getEmail(),
                user.getFullName(),
                user.getPhoneNumber(),
                user.getAvatarUrl(),
                user.getStatus(),
                user.getRoles().stream()
                        .map(role -> role.getId().getRole())
                        .collect(Collectors.toUnmodifiableSet()));
    }

    private Instant now() {
        return clock.instant().truncatedTo(ChronoUnit.MILLIS);
    }

    private void audit(User user, String action, Instant now) {
        AuditLog event = new AuditLog();
        event.setActor(user);
        event.setEntityType("users");
        event.setEntityId(user.getId());
        event.setAction(action);
        event.setRequestId(UUID.randomUUID());
        event.setCreatedAt(now);
        audit.save(event);
    }

    private static boolean isRefreshToken(String value) {
        return value != null && value.matches("[A-Za-z0-9_-]{43}");
    }

    public static byte[] hash(String token) {
        try {
            return MessageDigest.getInstance("SHA-256")
                    .digest(token.getBytes(StandardCharsets.UTF_8));
        } catch (java.security.NoSuchAlgorithmException error) {
            throw new IllegalStateException("SHA-256 unavailable");
        }
    }
}
