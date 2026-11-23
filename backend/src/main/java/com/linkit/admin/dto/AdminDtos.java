package com.linkit.admin.dto;

import com.linkit.identity.entity.User;
import com.linkit.identity.entity.UserRole.Role;
import com.linkit.proposals.entity.Proposal;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;

public final class AdminDtos {
    private AdminDtos() {}

    public record Page<T>(
            List<T> content, int page, int size, long totalElements, int totalPages) {}

    public record UserView(
            Long id,
            String fullName,
            String email,
            String avatarUrl,
            List<Role> roles,
            User.Status status,
            Instant createdAt,
            String version) {}

    public record ProposalView(
            Long id,
            Long jobId,
            String jobTitle,
            Long clientId,
            String clientName,
            Long freelancerId,
            String freelancerName,
            BigDecimal proposedBudget,
            String currencyCode,
            int estimatedDays,
            Proposal.Status status,
            Instant submittedAt) {}

    public record ProposalDetail(ProposalView summary, String coverLetter) {}

    public record Activity(
            Long id,
            Long actorId,
            String actorName,
            String action,
            String entityType,
            Long entityId,
            Instant createdAt) {}

    public record Stats(
            long totalUsers,
            long totalJobs,
            long totalProposals,
            long activeProjects,
            Map<String, Long> usersByRole,
            Map<String, Long> jobsByStatus,
            Map<String, Long> proposalsByStatus,
            Map<String, Long> projectsByStatus) {}
}
