package com.linkit.jobs.dto;

import com.fasterxml.jackson.annotation.JsonAnySetter;
import com.fasterxml.jackson.databind.JsonNode;
import com.linkit.jobs.entity.Job;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Locale;

public final class JobDtos {
    private JobDtos() {}

    public record SkillInput(@NotNull @Positive Long skillId, @NotNull Boolean isRequired) {}

    public record WriteRequest(
            @Size(max = 200) String title,
            @Size(max = 20000) String description,
            @Size(max = 20000) String deliverables,
            @Size(max = 20000) String acceptanceCriteria,
            @NotNull @DecimalMin("0") @Digits(integer = 17, fraction = 2) BigDecimal budgetMin,
            @NotNull @DecimalMin("0") @Digits(integer = 17, fraction = 2) BigDecimal budgetMax,
            @Pattern(regexp = "[A-Z]{3}") String currencyCode,
            @NotNull LocalDate deadline,
            @Size(max = 50) List<@NotNull @Valid SkillInput> skills) {
        public WriteRequest {
            title = clean(title);
            description = clean(description);
            deliverables = clean(deliverables);
            acceptanceCriteria = clean(acceptanceCriteria);
            currencyCode =
                    currencyCode == null ? "VND" : currencyCode.strip().toUpperCase(Locale.ROOT);
            skills = skills == null ? List.of() : skills;
        }

        @JsonAnySetter
        public void rejectUnknown(String name, JsonNode ignored) {
            throw new IllegalArgumentException("Unsupported Job field");
        }
    }

    public record SkillResponse(Long skillId, String name, Boolean isRequired) {}

    public record Quality(
            BigDecimal score,
            String rulesVersion,
            JsonNode breakdown,
            JsonNode recommendations,
            Instant evaluatedAt) {}

    public record Summary(
            Long id,
            Long clientId,
            String companyName,
            String title,
            BigDecimal budgetMin,
            BigDecimal budgetMax,
            String currencyCode,
            LocalDate deadline,
            Job.Status status,
            Instant createdAt,
            List<SkillResponse> skills,
            BigDecimal qualityScore) {}

    public record Detail(
            Long id,
            Long clientId,
            String companyName,
            String title,
            String description,
            String deliverables,
            String acceptanceCriteria,
            BigDecimal budgetMin,
            BigDecimal budgetMax,
            String currencyCode,
            LocalDate deadline,
            Job.Status status,
            Instant createdAt,
            Instant updatedAt,
            Instant publishedAt,
            String version,
            List<SkillResponse> skills,
            Quality quality) {}

    public record PageResponse<T>(
            List<T> content, int page, int size, long totalElements, int totalPages) {}

    private static String clean(String value) {
        return value == null ? "" : value.strip();
    }
}
