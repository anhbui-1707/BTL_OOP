package com.linkit.proposals.repository;

import com.linkit.proposals.entity.Proposal;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ProposalRepository extends JpaRepository<Proposal, Long> {
    boolean existsByCvId(Long cvId);

    @EntityGraph(attributePaths = {"job", "freelancer", "freelancer.user"})
    Page<Proposal> findByFreelancer_UserId(Long freelancerId, Pageable pageable);

    @EntityGraph(attributePaths = {"job", "freelancer", "freelancer.user"})
    Page<Proposal> findByJob_Id(Long jobId, Pageable pageable);

    @EntityGraph(attributePaths = {"job", "freelancer", "freelancer.user", "freelancer.user.roles"})
    List<Proposal> findAllByJob_Id(Long jobId);

    @EntityGraph(attributePaths = {"job", "freelancer", "freelancer.user"})
    Page<Proposal> findByFreelancer_UserIdAndStatus(
            Long freelancerId, Proposal.Status status, Pageable pageable);

    @EntityGraph(attributePaths = {"job", "freelancer", "freelancer.user"})
    Page<Proposal> findByJob_IdAndStatus(Long jobId, Proposal.Status status, Pageable pageable);

    @EntityGraph(attributePaths = {"job", "freelancer", "freelancer.user"})
    Optional<Proposal> findDetailedById(Long id);

    boolean existsByJob_IdAndFreelancer_UserId(Long jobId, Long freelancerId);

    @Query("select p.jobId from Proposal p where p.id=:id")
    Optional<Long> findJobIdById(@Param("id") Long id);

    @Query("select count(a) from Assignment a where a.proposalId=:id")
    long countAssignments(@Param("id") Long id);

    @EntityGraph(attributePaths = {"job", "freelancer", "freelancer.user", "freelancer.user.roles"})
    List<Proposal> findAllByJob_IdAndStatus(Long jobId, Proposal.Status status);
}
