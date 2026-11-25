package com.linkit.auth.dto;

import com.linkit.identity.entity.User;
import com.linkit.identity.entity.UserRole.Role;

import jakarta.validation.constraints.*;

import java.time.Instant;
import java.util.Locale;
import java.util.Set;

public final class AuthDtos {
    private AuthDtos() {

    }

    public record RegisterRequest(
            @NotBlank @Email @Size(max = 254) String email,
            @NotBlank @Size(min = 12, max = 72) String password,
            @NotBlank @Size(max = 150) String fullName,
            @NotNull Role role) {
        public RegisterRequest {
            email = normalize(email);
            fullName = fullName == null ? null : fullName.strip();
        }

        @Override
        public String toString() {
            return "RegisterRequest[redacted]";
        }
    }

    public record LoginRequest(
            @NotBlank @Email @Size(max = 254) String email,
            @NotBlank @Size(max = 72) String password) {
        public LoginRequest {
            email = normalize(email);
        }

        @Override
        public String toString() {
            return "LoginRequest[redacted]";
        }
    }

    public record RefreshRequest(@NotBlank @Size(max = 512) String refreshToken) {
        @Override
        public String toString() {
            return "RefreshRequest[redacted]";
        }
    }

    public record UserResponse(
            Long id,
            String email,
            String fullName,
            String phoneNumber,
            String avatarUrl,
            User.Status status,
            Set<Role> roles) {

    }

    public record TokenResponse(
            String accessToken,
            String refreshToken,
            String tokenType,
            long expiresIn,
            Instant refreshExpiresAt,
            UserResponse user) {
        @Override
        public String toString() {
            return "TokenResponse[redacted]";
        }
    }

    private static String normalize(String email) {
        return email == null ? null : email.strip().toLowerCase(Locale.ROOT);
    }
}
