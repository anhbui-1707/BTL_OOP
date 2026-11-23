package com.linkit.matching.service;

import com.linkit.auth.security.AuthPrincipal;
import com.linkit.common.ApiException;
import com.linkit.identity.entity.*;
import com.linkit.jobs.entity.Job;
import com.linkit.jobs.repository.*;
import com.linkit.matching.dto.MatchingDtos.*;
import com.linkit.proposals.entity.Proposal;
import com.linkit.proposals.repository.ProposalRepository;
import com.linkit.reviews.repository.ReviewRepository;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

@Service
public class MatchingService {
    private final JobRepository jobs;
    private final ProposalRepository proposals;
    private final ReviewRepository reviews;

    public MatchingService(
            JobRepository jobs, ProposalRepository proposals, ReviewRepository reviews) {
        this.jobs = jobs;
        this.proposals = proposals;
        this.reviews = reviews;
    }

    @Transactional(readOnly = true)
    public Page candidates(
            AuthPrincipal actor, Long jobId, Proposal.Status status, int page, int size) {
        if (!actor.roles().contains(UserRole.Role.CLIENT)) throw forbidden();
        Job job =
                jobs.findDetailedById(jobId)
                        .orElseThrow(
                                () ->
                                        new ApiException(
                                                HttpStatus.NOT_FOUND,
                                                "JOB_NOT_FOUND",
                                                "Không tìm thấy Job."));
        if (!Objects.equals(job.getClientId(), actor.userId())) throw forbidden();

        List<Proposal> applicants =
                status == null
                        ? proposals.findAllByJob_Id(jobId)
                        : proposals.findAllByJob_IdAndStatus(jobId, status);
        if (applicants.isEmpty()) return new Page(List.of(), page, size, 0, 0);

        Map<Long, ReviewRepository.FreelancerRating> ratings = new HashMap<>();
        reviews.ratingsForFreelancers(
                        applicants.stream().map(Proposal::getFreelancerId).distinct().toList())
                .forEach(rating -> ratings.put(rating.getFreelancerId(), rating));

        List<Candidate> ranked = new ArrayList<>();
        for (Proposal proposal : applicants) {
            FreelancerProfile freelancer = proposal.getFreelancer();
            List<String> reasons = invalidReasons(job, proposal, freelancer);
            ReviewRepository.FreelancerRating rating = ratings.get(proposal.getFreelancerId());
            ranked.add(
                    new Candidate(
                            proposal.getId(),
                            Base64.getEncoder().encodeToString(proposal.getRowVer()),
                            freelancer.getUserId(),
                            freelancer.getUser().getFullName(),
                            freelancer.getHeadline(),
                            freelancer.getYearsExperience(),
                            freelancer.getAvailabilityStatus(),
                            proposal.getProposedBudget(),
                            job.getCurrencyCode(),
                            proposal.getEstimatedDays(),
                            proposal.getStatus(),
                            reasons.isEmpty(),
                            reasons,
                            rating == null ? null : rating.getAverageRating(),
                            rating == null ? 0L : rating.getReviewCount()));
        }

        ranked.sort(
                Comparator.comparing(
                                Candidate::averageRating,
                                Comparator.nullsLast(Comparator.reverseOrder()))
                        .thenComparing(Candidate::reviewCount, Comparator.reverseOrder())
                        .thenComparing(Candidate::proposalId));
        int from = (int) Math.min((long) page * size, ranked.size());
        int to = Math.min(from + size, ranked.size());
        return new Page(
                List.copyOf(ranked.subList(from, to)),
                page,
                size,
                ranked.size(),
                (ranked.size() + size - 1) / size);
    }

    public static List<String> invalidReasons(
            Job job, Proposal proposal, FreelancerProfile freelancer) {
        List<String> reasons = new ArrayList<>();
        if (job.getStatus() != Job.Status.OPEN) reasons.add("JOB_NOT_OPEN");
        if (proposal.getStatus() != Proposal.Status.PENDING) reasons.add("PROPOSAL_NOT_PENDING");
        if (Objects.equals(job.getClientId(), freelancer.getUserId()))
            reasons.add("SELF_APPLICATION");
        if (freelancer.getUser().getStatus() != User.Status.ACTIVE)
            reasons.add("FREELANCER_NOT_ACTIVE");
        if (freelancer.getUser().getRoles().stream()
                .noneMatch(r -> r.getId().getRole() == UserRole.Role.FREELANCER))
            reasons.add("FREELANCER_ROLE_MISSING");
        if (freelancer.getAvailabilityStatus() == FreelancerProfile.AvailabilityStatus.UNAVAILABLE)
            reasons.add("FREELANCER_UNAVAILABLE");
        return List.copyOf(reasons);
    }

    private static ApiException forbidden() {
        return new ApiException(
                HttpStatus.FORBIDDEN, "FORBIDDEN", "Chỉ CLIENT sở hữu Job được xem Matching.");
    }
}
