package com.linkit.reviews.dto;

import com.fasterxml.jackson.annotation.JsonAnySetter;
import com.fasterxml.jackson.databind.JsonNode;

import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.time.Instant;

public final class ReviewDtos {
    private ReviewDtos() {}

    public record Create(
            @NotNull @DecimalMin("1") @DecimalMax("5") @Digits(integer = 1, fraction = 0)
                    BigDecimal overallRating,
            @NotNull @DecimalMin("1") @DecimalMax("5") @Digits(integer = 1, fraction = 0)
                    BigDecimal qualityRating,
            @NotNull @DecimalMin("1") @DecimalMax("5") @Digits(integer = 1, fraction = 0)
                    BigDecimal communicationRating,
            @NotNull @DecimalMin("1") @DecimalMax("5") @Digits(integer = 1, fraction = 0)
                    BigDecimal timelinessRating,
            @Size(max = 2000) String comment) {
        @JsonAnySetter
        public void rejectUnknown(String name, JsonNode ignored) {
            throw new IllegalArgumentException("Unsupported Review field");
        }

        @Override
        public String toString() {
            return "ReviewCreate[redacted]";
        }
    }

    public record Detail(
            Long id,
            Long assignmentId,
            Long reviewerId,
            Long freelancerId,
            short overallRating,
            short qualityRating,
            short communicationRating,
            short timelinessRating,
            String comment,
            Instant createdAt) {
        @Override
        public String toString() {
            return "Review[id=" + id + "]";
        }
    }
}
