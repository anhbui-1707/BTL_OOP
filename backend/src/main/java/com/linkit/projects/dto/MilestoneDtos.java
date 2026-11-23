package com.linkit.projects.dto;

import com.fasterxml.jackson.annotation.JsonAnySetter;
import com.fasterxml.jackson.databind.JsonNode;
import com.linkit.projects.entity.Milestone;
import com.linkit.projects.entity.MilestoneSubmission;

import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.time.*;
import java.util.List;

public final class MilestoneDtos {
    private MilestoneDtos() {}

    public record Write(
            @NotBlank @Size(max = 200) String title,
            @NotBlank @Size(max = 20000) String description,
            @NotBlank @Size(max = 20000) String acceptanceCriteria,
            @NotNull LocalDate dueDate,
            @NotNull @DecimalMin("0") @Digits(integer = 17, fraction = 2) BigDecimal amount,
            @NotNull Boolean isRequired,
            @NotNull @Positive Integer sortOrder) {
        @JsonAnySetter
        public void rejectUnknown(String name, JsonNode ignored) {
            throw new IllegalArgumentException("Unsupported Milestone field");
        }

        @Override
        public String toString() {
            return "MilestoneWrite[redacted]";
        }
    }

    public record Submit(
            @NotBlank @Size(max = 20000) String submissionNote,
            @Size(max = 1000) String evidenceUrl) {
        @JsonAnySetter
        public void rejectUnknown(String name, JsonNode ignored) {
            throw new IllegalArgumentException("Unsupported Submission field");
        }

        @Override
        public String toString() {
            return "MilestoneSubmit[redacted]";
        }
    }

    public record Review(@Size(max = 20000) String reviewNote) {
        @JsonAnySetter
        public void rejectUnknown(String name, JsonNode ignored) {
            throw new IllegalArgumentException("Unsupported Review field");
        }

        @Override
        public String toString() {
            return "MilestoneReview[redacted]";
        }
    }

    public record Detail(
            Long id,
            Long assignmentId,
            Long scopeVersionId,
            String title,
            String description,
            String acceptanceCriteria,
            LocalDate dueDate,
            BigDecimal amount,
            boolean isRequired,
            int sortOrder,
            Milestone.Status status,
            Instant approvedAt,
            Instant createdAt,
            String version) {
        @Override
        public String toString() {
            return "MilestoneDetail[id=" + id + ", status=" + status + "]";
        }
    }

    public record Submission(
            Long id,
            Long milestoneId,
            int submissionNumber,
            Long submittedBy,
            String submissionNote,
            String evidenceUrl,
            MilestoneSubmission.Status status,
            Long reviewedBy,
            String reviewNote,
            Instant submittedAt,
            Instant reviewedAt,
            String milestoneVersion) {
        @Override
        public String toString() {
            return "MilestoneSubmission[id=" + id + ", status=" + status + "]";
        }
    }

    public record Page<T>(
            List<T> content, int page, int size, long totalElements, int totalPages) {}
}
