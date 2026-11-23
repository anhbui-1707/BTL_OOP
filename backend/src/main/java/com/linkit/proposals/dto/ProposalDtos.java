package com.linkit.proposals.dto;

import com.fasterxml.jackson.annotation.JsonAnySetter;
import com.fasterxml.jackson.databind.JsonNode;
import com.linkit.jobs.entity.Job;
import com.linkit.proposals.entity.Proposal;

import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public final class ProposalDtos {
    private ProposalDtos() {}

    public record SubmitRequest(
            @NotBlank @Size(max = 20000) String coverLetter,
            @NotNull @DecimalMin("0") @Digits(integer = 17, fraction = 2) BigDecimal proposedBudget,
            @NotNull @Positive Integer estimatedDays,
            @Positive Long cvId) {
        public SubmitRequest(String coverLetter, BigDecimal proposedBudget, Integer estimatedDays) {
            this(coverLetter, proposedBudget, estimatedDays, null);
        }

        public SubmitRequest {
            coverLetter = coverLetter == null ? null : coverLetter.strip();
        }

        @JsonAnySetter
        public void unknown(String name, JsonNode ignored) {
            throw new IllegalArgumentException("Unsupported Proposal field");
        }

        @Override
        public String toString() {
            return "SubmitRequest[redacted]";
        }
    }

    public record StatusRequest(@NotNull Proposal.Status status) {
        @JsonAnySetter
        public void unknown(String name, JsonNode ignored) {
            throw new IllegalArgumentException("Unsupported Proposal field");
        }
    }

    public record Summary(
            Long id,
            Long jobId,
            String jobTitle,
            Job.Status jobStatus,
            Long clientId,
            Long freelancerId,
            String freelancerName,
            BigDecimal proposedBudget,
            Integer estimatedDays,
            Proposal.Status status,
            Instant submittedAt,
            String version,
            Long cvId,
            Double averageRating,
            Long reviewCount) {
        @Override
        public String toString() {
            return "ProposalSummary[id=" + id + ", status=" + status + "]";
        }
    }

    public record Detail(
            Long id,
            Long jobId,
            String jobTitle,
            Job.Status jobStatus,
            Long clientId,
            Long freelancerId,
            String freelancerName,
            String freelancerHeadline,
            String coverLetter,
            BigDecimal proposedBudget,
            String currencyCode,
            Integer estimatedDays,
            Proposal.Status status,
            Instant submittedAt,
            Instant updatedAt,
            String version,
            Long cvId,
            String cvFileName,
            Integer cvByteSize,
            Double averageRating,
            Long reviewCount,
            String freelancerBio,
            Short freelancerYearsExperience,
            List<String> freelancerSkills,
            String contactEmail,
            String contactPhone) {
        @Override
        public String toString() {
            return "ProposalDetail[id=" + id + ", status=" + status + "]";
        }
    }

    public record PageResponse(
            List<Summary> content, int page, int size, long totalElements, int totalPages) {}

    public record CvDownload(String fileName, byte[] content) {
        @Override
        public String toString() {
            return "ProposalCvDownload[redacted]";
        }
    }
}
