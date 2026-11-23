package com.linkit.projects.dto;

import com.linkit.projects.entity.Assignment;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public final class AssignmentDtos {
    private AssignmentDtos() {}

    public record Detail(
            Long id,
            Long jobId,
            String jobTitle,
            Long proposalId,
            Long clientId,
            String companyName,
            Long freelancerId,
            String freelancerName,
            BigDecimal agreedBudget,
            String currencyCode,
            Assignment.Status status,
            Instant createdAt,
            Instant startedAt,
            Instant completedAt,
            String version) {
        @Override
        public String toString() {
            return "AssignmentDetail[id=" + id + ", status=" + status + "]";
        }
    }

    public record Page(
            List<Detail> content, int page, int size, long totalElements, int totalPages) {}
}
