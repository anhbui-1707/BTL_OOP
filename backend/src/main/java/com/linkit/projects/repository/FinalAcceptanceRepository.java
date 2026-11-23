package com.linkit.projects.repository;

import com.linkit.projects.entity.FinalAcceptance;

import org.springframework.data.jpa.repository.JpaRepository;

public interface FinalAcceptanceRepository extends JpaRepository<FinalAcceptance, Long> {
    java.util.Optional<FinalAcceptance> findByAssignment_Id(Long assignmentId);

    boolean existsByAssignment_Id(Long assignmentId);
}
