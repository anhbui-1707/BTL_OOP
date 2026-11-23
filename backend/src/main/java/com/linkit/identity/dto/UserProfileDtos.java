package com.linkit.identity.dto;

import com.linkit.identity.entity.User;
import com.linkit.identity.entity.UserRole.Role;

import jakarta.validation.constraints.*;

import java.nio.charset.StandardCharsets;
import java.util.Objects;
import java.util.Set;

public final class UserProfileDtos {
    private UserProfileDtos() {}

    public record Input(
            @NotBlank @Size(max = 150) String fullName,
            @Size(max = 200) String title,
            @Size(max = 20) String phoneNumber,
            @Size(max = 500) String bio,
            @Size(min = 12, max = 72) String newPassword,
            @Size(max = 72) String confirmPassword) {
        @AssertTrue(message = "Mật khẩu xác nhận phải khớp và mật khẩu không quá 72 byte UTF-8.")
        public boolean isPasswordValid() {
            return newPassword == null
                    ? confirmPassword == null
                    : Objects.equals(newPassword, confirmPassword)
                            && newPassword.getBytes(StandardCharsets.UTF_8).length <= 72;
        }

        @Override
        public String toString() {
            return "UserProfileInput[redacted]";
        }
    }

    public record View(
            Long id,
            String fullName,
            String email,
            String phoneNumber,
            String title,
            String bio,
            String avatarUrl,
            User.Status status,
            Set<Role> roles) {}
}
