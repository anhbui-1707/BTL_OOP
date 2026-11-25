package com.linkit.matching;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

import com.linkit.auth.security.AuthPrincipal;
import com.linkit.identity.entity.UserRole.Role;
import com.linkit.jobs.entity.Job;
import com.linkit.jobs.repository.JobRepository;
import com.linkit.matching.service.MatchingService;
import com.linkit.proposals.entity.Proposal;
import com.linkit.proposals.repository.ProposalRepository;
import com.linkit.reviews.repository.ReviewRepository;
import org.junit.jupiter.api.Test;
import java.util.*;

class MatchingServiceTest {
    @Test
    void ranksByAverageStarsThenReviewCountThenProposalIdWithUnratedLast() {
        var jobs = mock(JobRepository.class);
        var proposals = mock(ProposalRepository.class);
        var reviews = mock(ReviewRepository.class);
        var job = mock(Job.class);
        when(job.getClientId()).thenReturn(2L);
        when(jobs.findDetailedById(7L)).thenReturn(Optional.of(job));
        var applicants = List.of(
                applicant(50L), applicant(40L), applicant(30L), applicant(20L), applicant(10L));
        var ratings = List.of(
                rating(50L, 4.0, 99L), rating(40L, 5.0, 1L),
                rating(30L, 5.0, 3L), rating(20L, 5.0, 3L));
        when(proposals.findAllByJob_Id(7L)).thenReturn(applicants);
        when(reviews.ratingsForFreelancers(anyCollection())).thenReturn(ratings);
        var service = new MatchingService(jobs, proposals, reviews);
        var actor = new AuthPrincipal(2L, Set.of(Role.CLIENT));

        var result = service.candidates(actor, 7L, null, 0, 10);
        assertThat(result.content()).extracting(c -> c.proposalId())
                .containsExactly(20L, 30L, 40L, 50L, 10L);
        assertThat(result.content().get(4).averageRating()).isNull();
        assertThat(result.content().get(4).reviewCount()).isZero();

        var secondPage = service.candidates(actor, 7L, null, 1, 2);
        assertThat(secondPage.content()).extracting(c -> c.proposalId())
                .containsExactly(40L, 50L);
        assertThat(secondPage.totalElements()).isEqualTo(5);
    }

    private Proposal applicant(Long id) {
        var proposal = mock(Proposal.class, RETURNS_DEEP_STUBS);
        when(proposal.getId()).thenReturn(id);
        when(proposal.getFreelancerId()).thenReturn(id);
        when(proposal.getRowVer()).thenReturn(new byte[8]);
        return proposal;
    }

    private ReviewRepository.FreelancerRating rating(Long id, Double stars, Long count) {
        var rating = mock(ReviewRepository.FreelancerRating.class);
        when(rating.getFreelancerId()).thenReturn(id);
        when(rating.getAverageRating()).thenReturn(stars);
        when(rating.getReviewCount()).thenReturn(count);
        return rating;
    }
}
