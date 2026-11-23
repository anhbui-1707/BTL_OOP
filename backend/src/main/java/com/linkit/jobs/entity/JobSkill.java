package com.linkit.jobs.entity;

import com.linkit.identity.entity.Skill;

import jakarta.persistence.*;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.util.*;

@Entity
@Table(name = "job_skills", schema = "dbo")
public class JobSkill {

    @EmbeddedId private JobSkillId id = new JobSkillId();

    @JdbcTypeCode(SqlTypes.TINYINT)
    @Column(name = "required_level", nullable = false, columnDefinition = "tinyint")
    private Short requiredLevel;

    @Column(name = "is_required", nullable = false, columnDefinition = "bit")
    private Boolean isRequired;

    @Column(
            name = "weight",
            nullable = false,
            precision = 5,
            scale = 2,
            columnDefinition = "decimal(5,2)")
    private BigDecimal weight;

    @MapsId("jobId")
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(
            name = "job_id",
            nullable = false,
            foreignKey = @ForeignKey(name = "FK_job_skills_job"))
    private Job job;

    @MapsId("skillId")
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(
            name = "skill_id",
            nullable = false,
            foreignKey = @ForeignKey(name = "FK_job_skills_skill"))
    private Skill skill;

    public JobSkill() {}

    public JobSkillId getId() {
        return id;
    }

    public void setId(JobSkillId id) {
        this.id = id;
    }

    public Short getRequiredLevel() {
        return requiredLevel;
    }

    public void setRequiredLevel(Short requiredLevel) {
        this.requiredLevel = requiredLevel;
    }

    public Boolean getIsRequired() {
        return isRequired;
    }

    public void setIsRequired(Boolean isRequired) {
        this.isRequired = isRequired;
    }

    public BigDecimal getWeight() {
        return weight;
    }

    public void setWeight(BigDecimal weight) {
        this.weight = weight;
    }

    public Job getJob() {
        return job;
    }

    public void setJob(Job job) {
        this.job = job;
    }

    public Skill getSkill() {
        return skill;
    }

    public void setSkill(Skill skill) {
        this.skill = skill;
    }
}
