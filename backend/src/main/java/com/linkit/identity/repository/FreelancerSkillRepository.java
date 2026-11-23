package com.linkit.identity.repository;

import com.linkit.identity.entity.FreelancerSkill;
import com.linkit.identity.entity.FreelancerSkillId;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;

public interface FreelancerSkillRepository
        extends JpaRepository<FreelancerSkill, FreelancerSkillId> {
    @org.springframework.data.jpa.repository.EntityGraph(attributePaths = "skill")
    List<FreelancerSkill> findWithSkillById_FreelancerIdOrderById_SkillId(Long freelancerId);

    List<FreelancerSkill> findById_FreelancerIdIn(Collection<Long> freelancerIds);
}
