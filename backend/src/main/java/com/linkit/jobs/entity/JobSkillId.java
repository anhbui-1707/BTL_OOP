package com.linkit.jobs.entity;

import jakarta.persistence.*;

import java.io.Serializable;
import java.util.Objects;

@Embeddable
public class JobSkillId implements Serializable {
    private static final long serialVersionUID = 1L;

    @Column(name = "job_id", nullable = false, columnDefinition = "bigint")
    private Long jobId;

    @Column(name = "skill_id", nullable = false, columnDefinition = "bigint")
    private Long skillId;

    public JobSkillId() {}

    public JobSkillId(Long jobId, Long skillId) {
        this.jobId = jobId;
        this.skillId = skillId;
    }

    public Long getJobId() {
        return jobId;
    }

    public void setJobId(Long jobId) {
        this.jobId = jobId;
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
        if (!(value instanceof JobSkillId other)) return false;
        return Objects.equals(jobId, other.jobId) && Objects.equals(skillId, other.skillId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(jobId, skillId);
    }
}
