package com.linkit.identity.entity;

import jakarta.persistence.*;

import java.io.Serializable;
import java.util.Objects;

@Embeddable
public class FreelancerSkillId implements Serializable {
    private static final long serialVersionUID = 1L;

    @Column(name = "freelancer_id", nullable = false, columnDefinition = "bigint")
    private Long freelancerId;

    @Column(name = "skill_id", nullable = false, columnDefinition = "bigint")
    private Long skillId;

    public FreelancerSkillId() {}

    public FreelancerSkillId(Long freelancerId, Long skillId) {
        this.freelancerId = freelancerId;
        this.skillId = skillId;
    }

    public Long getFreelancerId() {
        return freelancerId;
    }

    public void setFreelancerId(Long freelancerId) {
        this.freelancerId = freelancerId;
    }

    public Long getSkillId() {
        return skillId;
    }

    public void setSkillId(Long skillId) {
        this.skillId = skillId;
    }

    @Override
    public boolean equals(Object value) {
        if (this == value) return true;
        if (!(value instanceof FreelancerSkillId other)) return false;
        return Objects.equals(freelancerId, other.freelancerId)
                && Objects.equals(skillId, other.skillId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(freelancerId, skillId);
    }
}
