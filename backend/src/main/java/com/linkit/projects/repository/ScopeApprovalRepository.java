package com.linkit.projects.repository;

import com.linkit.projects.entity.ScopeApproval;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ScopeApprovalRepository extends JpaRepository<ScopeApproval, Long> {
    @org.springframework.data.jpa.repository.EntityGraph(attributePaths = {"user"})
    java.util.List<ScopeApproval> findByScopeVersion_IdIn(java.util.Collection<Long> ids);
}
