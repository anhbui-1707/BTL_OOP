package com.linkit.projects.repository;

import com.linkit.projects.entity.MilestoneSubmission;

import org.springframework.data.jpa.repository.JpaRepository;

public interface MilestoneSubmissionRepository extends JpaRepository<MilestoneSubmission, Long> {
    @org.springframework.data.jpa.repository.Query(
            "select s.milestone.id,count(s) from MilestoneSubmission s where s.milestone.assignment.id=:assignmentId and s.status=:status group by s.milestone.id")
    java.util.List<Object[]> countByAssignmentAndStatus(
            Long assignmentId, MilestoneSubmission.Status status);

    boolean existsByMilestone_Id(Long milestoneId);

    java.util.Optional<MilestoneSubmission> findFirstByMilestone_IdOrderBySubmissionNumberDesc(
            Long milestoneId);

    org.springframework.data.domain.Page<MilestoneSubmission> findByMilestone_Id(
            Long milestoneId, org.springframework.data.domain.Pageable pageable);

    @org.springframework.data.jpa.repository.Query(
            "select s.milestone.id from MilestoneSubmission s where s.id=:id")
    java.util.Optional<Long> findMilestoneIdById(Long id);
}
