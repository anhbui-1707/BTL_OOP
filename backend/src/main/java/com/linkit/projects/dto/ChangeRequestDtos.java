package com.linkit.projects.dto;

import com.fasterxml.jackson.annotation.JsonAnySetter;
import com.fasterxml.jackson.databind.JsonNode;
import com.linkit.projects.entity.ChangeRequest;
import com.linkit.projects.entity.ChangeRequestApproval;

import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public final class ChangeRequestDtos {
    private ChangeRequestDtos() {}

    public record Create(
            @NotBlank @Size(max = 200) String title,
            @NotBlank @Size(max = 20000) String reason,
            @NotBlank @Size(max = 20000) String proposedDeliverables,
            @NotNull @Digits(integer = 17, fraction = 2) BigDecimal budgetDelta,
            @NotNull Integer daysDelta) {
        @JsonAnySetter
        public void rejectUnknown(String name, JsonNode ignored) {
            throw new IllegalArgumentException("Unsupported change field");
        }

        @Override
        public String toString() {
            return "ChangeCreate[redacted]";
        }
    }

    public record Decide(
            @NotNull ChangeRequestApproval.Decision decision, @Size(max = 20000) String comment) {
        @JsonAnySetter
        public void rejectUnknown(String name, JsonNode ignored) {
            throw new IllegalArgumentException("Unsupported decision field");
        }

        @Override
        public String toString() {
            return "ChangeDecision[redacted]";
        }
    }

    public record Decision(
            Long userId,
            ChangeRequestApproval.PartyRole partyRole,
            ChangeRequestApproval.Decision decision,
            String comment,
            Instant decidedAt) {
        @Override
        public String toString() {
            return "ChangeDecision[partyRole=" + partyRole + ", decision=" + decision + "]";
        }
    }

    public record Detail(
            Long id,
            Long assignmentId,
            Long baseScopeVersionId,
            Long requestedBy,
            String title,
            String reason,
            String proposedDeliverables,
            BigDecimal budgetDelta,
            int daysDelta,
            ChangeRequest.Status status,
            Long resultScopeVersionId,
            Instant createdAt,
            Instant resolvedAt,
            List<Decision> decisions,
            String version) {
        @Override
        public String toString() {
            return "ChangeRequest[id=" + id + ", status=" + status + "]";
        }
    }

    public record Page(
            List<Detail> content, int page, int size, long totalElements, int totalPages) {}
}
