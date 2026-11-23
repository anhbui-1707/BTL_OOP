package com.linkit.projects.repository;

import com.linkit.projects.entity.ChangeRequest;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ChangeRequestRepository extends JpaRepository<ChangeRequest, Long> {
    @org.springframework.data.jpa.repository.Query(
            "select c.assignment.id from ChangeRequest c where c.id=:id")
    java.util.Optional<Long> findAssignmentIdById(Long id);

    @org.springframework.data.jpa.repository.Lock(
            jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select c from ChangeRequest c where c.id=:id")
    java.util.Optional<ChangeRequest> findForUpdate(Long id);

    org.springframework.data.domain.Page<ChangeRequest> findByAssignment_Id(
            Long id, org.springframework.data.domain.Pageable page);

    java.util.List<ChangeRequest> findByAssignment_Id(Long id);
}
