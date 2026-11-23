package com.linkit.projects.dto;

import com.fasterxml.jackson.annotation.JsonAnySetter;
import com.fasterxml.jackson.databind.JsonNode;
import com.linkit.projects.entity.Assignment;

import jakarta.validation.constraints.Size;

import java.time.Instant;

public final class FinalAcceptanceDtos {
    private FinalAcceptanceDtos() {}

    public record Accept(@Size(max = 20000) String acceptanceNote) {
        @JsonAnySetter
        public void rejectUnknown(String name, JsonNode ignored) {
            throw new IllegalArgumentException("Unsupported acceptance field");
        }

        @Override
        public String toString() {
            return "FinalAcceptanceRequest[redacted]";
        }
    }

    public record Detail(
            Long id,
            Long scopeVersionId,
            Long acceptedBy,
            String acceptanceNote,
            Instant acceptedAt) {
        @Override
        public String toString() {
            return "FinalAcceptance[id=" + id + "]";
        }
    }

    public record Status(
            Long assignmentId,
            Assignment.Status assignmentStatus,
            boolean accepted,
            Detail acceptance,
            String assignmentVersion) {}
}
