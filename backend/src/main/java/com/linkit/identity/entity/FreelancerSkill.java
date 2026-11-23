package com.linkit.identity.entity;

import jakarta.persistence.*;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.util.*;

@Entity
@Table(name = "freelancer_skills", schema = "dbo")
public class FreelancerSkill {

    @EmbeddedId private FreelancerSkillId id = new FreelancerSkillId();

    @JdbcTypeCode(SqlTypes.TINYINT)
    @Column(name = "proficiency", nullable = false, columnDefinition = "tinyint")
    private Short proficiency;

    @Column(name = "years_experience", nullable = true, columnDefinition = "smallint")
    private Short yearsExperience;

    @MapsId("freelancerId")
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(
            name = "freelancer_id",
            nullable = false,
            foreignKey = @ForeignKey(name = "FK_freelancer_skills_freelancer"))
    private FreelancerProfile freelancer;

    @MapsId("skillId")
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(
            name = "skill_id",
            nullable = false,
            foreignKey = @ForeignKey(name = "FK_freelancer_skills_skill"))
    private Skill skill;

    public FreelancerSkill() {}

    public FreelancerSkillId getId() {
        return id;
    }

    public void setId(FreelancerSkillId id) {
        this.id = id;
    }

    public Short getProficiency() {
        return proficiency;
    }

    public void setProficiency(Short proficiency) {
        this.proficiency = proficiency;
    }

    public Short getYearsExperience() {
        return yearsExperience;
    }

    public void setYearsExperience(Short yearsExperience) {
        this.yearsExperience = yearsExperience;
    }

    public FreelancerProfile getFreelancer() {
        return freelancer;
    }

    public void setFreelancer(FreelancerProfile freelancer) {
        this.freelancer = freelancer;
    }

    public Skill getSkill() {
        return skill;
    }

    public void setSkill(Skill skill) {
        this.skill = skill;
    }
}
