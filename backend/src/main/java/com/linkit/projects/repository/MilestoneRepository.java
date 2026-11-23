package com.linkit.projects.repository;

import com.linkit.projects.entity.Milestone;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MilestoneRepository extends JpaRepository<Milestone, Long> {
    java.util.List<Milestone> findByAssignment_Id(Long id);

    Page<Milestone> findByAssignment_Id(Long assignmentId, Pageable pageable);

    @org.springframework.data.jpa.repository.Query(
            "select m.assignmentId from Milestone m where m.id=:id")
    java.util.Optional<Long> findAssignmentIdById(Long id);

    @org.springframework.data.jpa.repository.Lock(
            jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select m from Milestone m where m.id=:id")
    java.util.Optional<Milestone> findForUpdate(Long id);

    @org.springframework.data.jpa.repository.Query(
            "select coalesce(sum(m.amount),0) from Milestone m where m.assignment.id=:assignmentId and m.status<>com.linkit.projects.entity.Milestone.Status.CANCELLED and m.id<>:excludedId")
    java.math.BigDecimal allocated(Long assignmentId, Long excludedId);
}
