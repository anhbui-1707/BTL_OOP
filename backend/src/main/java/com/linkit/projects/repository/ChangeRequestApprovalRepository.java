package com.linkit.projects.repository;

import com.linkit.projects.entity.ChangeRequestApproval;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ChangeRequestApprovalRepository
        extends JpaRepository<ChangeRequestApproval, Long> {
    java.util.List<ChangeRequestApproval> findByChangeRequest_IdIn(java.util.Collection<Long> ids);
}
