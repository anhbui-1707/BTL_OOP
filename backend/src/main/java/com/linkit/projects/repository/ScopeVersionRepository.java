package com.linkit.projects.repository;

import com.linkit.projects.entity.ScopeVersion;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ScopeVersionRepository extends JpaRepository<ScopeVersion, Long> {
    java.util.Optional<ScopeVersion> findByAssignment_IdAndStatus(
            Long assignmentId, ScopeVersion.Status status);

    org.springframework.data.domain.Page<ScopeVersion> findByAssignment_IdOrderByVersionNumberDesc(
            Long assignmentId, org.springframework.data.domain.Pageable pageable);

    java.util.List<ScopeVersion> findByAssignment_IdOrderByVersionNumberDesc(Long assignmentId);

    @org.springframework.data.jpa.repository.Query(
            "select s.assignmentId from ScopeVersion s where s.id=:id")
    java.util.Optional<Long> findAssignmentIdById(Long id);
}
