package com.linkit.jobs.entity;

import com.linkit.identity.entity.Skill;

import jakarta.persistence.*;

@Entity
@Table(name = "job_skills", schema = "dbo")
public class JobSkill {

    @EmbeddedId private JobSkillId id = new JobSkillId();

    @Column(name = "is_required", nullable = false, columnDefinition = "bit")
    private Boolean isRequired;

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

    public Boolean getIsRequired() {
        return isRequired;
    }

    public void setIsRequired(Boolean isRequired) {
        this.isRequired = isRequired;
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
