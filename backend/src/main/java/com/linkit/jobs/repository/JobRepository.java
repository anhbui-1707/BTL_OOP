package com.linkit.jobs.repository;

import com.linkit.jobs.entity.Job;

import jakarta.persistence.LockModeType;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Optional;

public interface JobRepository extends JpaRepository<Job, Long>, JpaSpecificationExecutor<Job> {
    @Modifying
    @Query(
            "update Job j set j.status = com.linkit.jobs.entity.Job.Status.CLOSED, j.updatedAt = :updatedAt where j.status = com.linkit.jobs.entity.Job.Status.OPEN and j.deadline < :today")
    int closeExpiredOpenJobs(
            @Param("today") LocalDate today, @Param("updatedAt") Instant updatedAt);

    Page<Job> findByClient_UserId(Long clientId, Pageable pageable);

    @Query(
            "select j from Job j where j.client.userId = :clientId and j.status = com.linkit.jobs.entity.Job.Status.OPEN order by j.publishedAt desc, j.id desc")
    Page<Job> findOpenByClientId(@Param("clientId") Long clientId, Pageable pageable);

    @Override
    @EntityGraph(attributePaths = "client")
    Page<Job> findAll(Specification<Job> specification, Pageable pageable);

    @EntityGraph(attributePaths = "client")
    Optional<Job> findDetailedById(Long id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select j from Job j where j.id=:id")
    Optional<Job> findForUpdate(@Param("id") Long id);

    @Query("select count(p) from Proposal p where p.job.id=:id")
    long countProposals(@Param("id") Long id);

    @Query("select count(a) from Assignment a where a.jobId=:id")
    long countAssignments(@Param("id") Long id);

    @Query(
            "select count(p) from Proposal p where p.job.id=:jobId and p.freelancer.userId=:freelancerId")
    long countProposalsForFreelancer(
            @Param("jobId") Long jobId, @Param("freelancerId") Long freelancerId);

    @Query(
            "select count(a) from Assignment a where a.jobId=:jobId and a.freelancer.userId=:freelancerId")
    long countAssignmentsForFreelancer(
            @Param("jobId") Long jobId, @Param("freelancerId") Long freelancerId);
}
