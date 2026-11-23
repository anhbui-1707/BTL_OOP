package com.linkit.identity.repository;

import com.linkit.identity.entity.WorkExperience;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.*;

public interface WorkExperienceRepository extends JpaRepository<WorkExperience, Long> {
    List<WorkExperience> findByFreelancerIdOrderByStartDateDescIdDesc(Long freelancerId);

    Optional<WorkExperience> findByIdAndFreelancerId(Long id, Long freelancerId);
}
