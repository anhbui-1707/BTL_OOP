package com.linkit.jobs.repository;

import com.linkit.jobs.entity.SavedJob;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface SavedJobRepository extends JpaRepository<SavedJob, Long> {
    @EntityGraph(attributePaths = {"job", "job.client", "job.skills", "job.skills.skill"})
    List<SavedJob> findByFreelancerIdOrderBySavedAtDescIdDesc(Long freelancerId);

    @EntityGraph(attributePaths = {"job", "job.client", "job.skills", "job.skills.skill"})
    Optional<SavedJob> findByFreelancerIdAndJob_Id(Long freelancerId, Long jobId);

    @Modifying
    @Query(
            "delete from SavedJob saved where saved.freelancerId = :freelancerId and saved.job.id = :jobId")
    void deleteByFreelancerIdAndJob_Id(
            @Param("freelancerId") Long freelancerId, @Param("jobId") Long jobId);
}
