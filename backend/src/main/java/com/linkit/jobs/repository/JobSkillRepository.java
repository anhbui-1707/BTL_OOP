package com.linkit.jobs.repository;

import com.linkit.jobs.entity.JobSkill;
import com.linkit.jobs.entity.JobSkillId;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;

public interface JobSkillRepository extends JpaRepository<JobSkill, JobSkillId> {
    @EntityGraph(attributePaths = "skill")
    List<JobSkill> findByJob_IdIn(Collection<Long> jobIds);
}
