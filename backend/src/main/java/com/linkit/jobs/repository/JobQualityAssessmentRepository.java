package com.linkit.jobs.repository;

import com.linkit.jobs.entity.JobQualityAssessment;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;

public interface JobQualityAssessmentRepository extends JpaRepository<JobQualityAssessment, Long> {
    @Query(
            "select q from JobQualityAssessment q where q.job.id in :ids and not exists "
                    + "(select newer.id from JobQualityAssessment newer where newer.job=q.job and newer.id>q.id)")
    List<JobQualityAssessment> findLatestByJobIds(@Param("ids") Collection<Long> ids);
}
