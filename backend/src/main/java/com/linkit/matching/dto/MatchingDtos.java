package com.linkit.matching.dto;

import com.linkit.identity.entity.FreelancerProfile.AvailabilityStatus;
import com.linkit.proposals.entity.Proposal;

import java.math.BigDecimal;
import java.util.List;

public final class MatchingDtos {
    private MatchingDtos() {}

    public record Candidate(
            Long proposalId,
            String proposalVersion,
            Long freelancerId,
            String fullName,
            String headline,
            Short yearsExperience,
            AvailabilityStatus availability,
            BigDecimal proposedBudget,
            String currencyCode,
            Integer estimatedDays,
            Proposal.Status proposalStatus,
            boolean selectable,
            List<String> ineligibilityReasons,
            Double averageRating,
            Long reviewCount) {
        @Override
        public String toString() {
            return "Candidate[proposalId=" + proposalId + "]";
        }
    }

    public record Page(
            List<Candidate> content, int page, int size, long totalElements, int totalPages) {}
}
