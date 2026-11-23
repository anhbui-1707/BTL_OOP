package com.linkit.identity.repository;

import com.linkit.identity.entity.PortfolioProject;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.*;

public interface PortfolioProjectRepository extends JpaRepository<PortfolioProject, Long> {
    List<PortfolioProject> findByFreelancerIdOrderByCreatedAtDescIdDesc(Long freelancerId);

    Optional<PortfolioProject> findByIdAndFreelancerId(Long id, Long freelancerId);
}
