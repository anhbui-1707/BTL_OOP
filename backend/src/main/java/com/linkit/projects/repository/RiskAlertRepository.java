package com.linkit.projects.repository;

import com.linkit.projects.entity.RiskAlert;

import org.springframework.data.jpa.repository.JpaRepository;

public interface RiskAlertRepository extends JpaRepository<RiskAlert, Long> {
    java.util.List<RiskAlert> findByAssignment_Id(Long id);

    org.springframework.data.domain.Page<RiskAlert> findByAssignment_Id(
            Long id, org.springframework.data.domain.Pageable page);

    @org.springframework.data.jpa.repository.Query(
            "select r.assignment.id from RiskAlert r where r.id=:id")
    java.util.Optional<Long> findAssignmentIdById(Long id);
}
