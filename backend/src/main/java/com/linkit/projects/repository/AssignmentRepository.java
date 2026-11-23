package com.linkit.projects.repository;

import com.linkit.projects.entity.Assignment;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface AssignmentRepository
        extends JpaRepository<Assignment, Long>, JpaSpecificationExecutor<Assignment> {
    @Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @Query("select a from Assignment a where a.id=:id")
    Optional<Assignment> findForScope(Long id);

    Page<Assignment> findByClient_UserId(Long clientId, Pageable pageable);

    Page<Assignment> findByFreelancer_UserId(Long freelancerId, Pageable pageable);

    boolean existsByJobId(Long jobId);

    long countByFreelancer_UserIdAndStatus(Long freelancerId, Assignment.Status status);

    @EntityGraph(attributePaths = {"job", "client", "freelancer", "freelancer.user"})
    Optional<Assignment> findDetailedById(Long id);

    @Override
    @EntityGraph(attributePaths = {"job", "client", "freelancer", "freelancer.user"})
    Page<Assignment> findAll(Specification<Assignment> specification, Pageable pageable);
}
