package com.linkit.projects.dto;

import com.linkit.projects.entity.ScopeApproval.PartyRole;
import com.linkit.projects.entity.ScopeVersion;

import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.time.*;
import java.util.List;

public final class ScopeDtos {
    private ScopeDtos() {}

    public record Create(
            @Size(max = 20000) String deliverables,
            @Size(max = 20000) String exclusions,
            @Size(max = 20000) String acceptanceCriteria,
            @DecimalMin("0") @Digits(integer = 17, fraction = 2) BigDecimal budget,
            LocalDate deadline) {
        @com.fasterxml.jackson.annotation.JsonAnySetter
        public void rejectUnknown(String name, com.fasterxml.jackson.databind.JsonNode ignored) {
            throw new IllegalArgumentException("Unsupported Scope field");
        }

        @Override
        public String toString() {
            return "ScopeCreate[redacted]";
        }
    }

    public record Approval(Long userId, PartyRole partyRole, Instant approvedAt) {}

    public record Detail(
            Long id,
            Long assignmentId,
            int versionNumber,
            String deliverables,
            String exclusions,
            String acceptanceCriteria,
            BigDecimal budget,
            LocalDate deadline,
            ScopeVersion.Status status,
            Long createdBy,
            Instant createdAt,
            Instant lockedAt,
            List<Approval> approvals,
            String assignmentVersion) {
        @Override
        public String toString() {
            return "ScopeDetail[id=" + id + ", status=" + status + "]";
        }
    }

    public record Page(
            List<Detail> content, int page, int size, long totalElements, int totalPages) {}
}
