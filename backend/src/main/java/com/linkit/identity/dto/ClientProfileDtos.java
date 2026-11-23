package com.linkit.identity.dto;

import jakarta.validation.constraints.*;

public final class ClientProfileDtos {
    private ClientProfileDtos() {}

    public record Input(
            @NotBlank @Size(max = 150) String fullName,
            @Size(max = 20) String phoneNumber,
            @Size(max = 500) String bio,
            @Size(max = 200) String title,
            @Size(max = 200) String companyName,
            @Size(max = 1000) String companyWebsite,
            @Size(max = 100) String industry,
            @Size(max = 200) String location,
            @Size(max = 20) String publicContactPhone,
            @Email @Size(max = 254) String publicContactEmail) {
        @Override
        public String toString() {
            return "ClientProfileInput[redacted]";
        }
    }

    public record View(
            Long id,
            String fullName,
            String email,
            String phoneNumber,
            String bio,
            String title,
            String companyName,
            String companyWebsite,
            String industry,
            String location,
            String publicContactPhone,
            String publicContactEmail) {}
}
