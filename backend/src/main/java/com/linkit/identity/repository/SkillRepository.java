package com.linkit.identity.repository;

import com.linkit.identity.entity.Skill;

import org.springframework.data.jpa.repository.JpaRepository;

public interface SkillRepository
        extends JpaRepository<Skill, Long>,
                org.springframework.data.jpa.repository.JpaSpecificationExecutor<Skill> {
    java.util.Optional<Skill> findByNameIgnoreCase(String name);
}
