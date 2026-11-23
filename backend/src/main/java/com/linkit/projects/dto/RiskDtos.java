package com.linkit.projects.dto;

import com.linkit.projects.entity.RiskAlert;

import java.time.Instant;
import java.util.List;

public final class RiskDtos {
    private RiskDtos() {}

    public record Detail(
            Long id,
            Long assignmentId,
            Long milestoneId,
            String riskType,
            RiskAlert.Severity severity,
            String title,
            String description,
            String ruleCode,
            RiskAlert.Status status,
            Instant detectedAt,
            Instant resolvedAt) {
        @Override
        public String toString() {
            return "RiskAlert[id=" + id + ", status=" + status + "]";
        }
    }

    public record Page(
            List<Detail> content, int page, int size, long totalElements, int totalPages) {}

    public record Evaluation(int created, int resolved) {}
}
