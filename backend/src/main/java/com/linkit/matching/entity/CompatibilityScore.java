package com.linkit.matching.entity;

import com.linkit.identity.entity.FreelancerProfile;
import com.linkit.jobs.entity.Job;

import jakarta.persistence.*;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.Nationalized;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;

@Entity
@Table(name = "compatibility_scores", schema = "dbo")
public class CompatibilityScore {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false, columnDefinition = "bigint")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(
            name = "job_id",
            referencedColumnName = "id",
            nullable = false,
            foreignKey = @ForeignKey(name = "FK_compatibility_scores_job"))
    private Job job;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(
            name = "freelancer_id",
            referencedColumnName = "user_id",
            nullable = false,
            foreignKey = @ForeignKey(name = "FK_compatibility_scores_freelancer"))
    private FreelancerProfile freelancer;

    @Column(
            name = "score",
            nullable = false,
            precision = 5,
            scale = 2,
            columnDefinition = "decimal(5,2)")
    private BigDecimal score;

    @Column(name = "rules_version", nullable = false, length = 30, columnDefinition = "varchar(30)")
    private String rulesVersion;

    @Nationalized
    @Column(
            name = "breakdown_json",
            nullable = false,
            length = Integer.MAX_VALUE,
            columnDefinition = "nvarchar(max)")
    private String breakdownJson;

    @JdbcTypeCode(SqlTypes.TIMESTAMP)
    @Column(name = "evaluated_at", nullable = false, columnDefinition = "datetime2(3)")
    private Instant evaluatedAt;

    public CompatibilityScore() {}

    public Long getId() {
        return id;
    }

    public Job getJob() {
        return job;
    }

    public void setJob(Job job) {
        this.job = job;
    }

    public FreelancerProfile getFreelancer() {
        return freelancer;
    }

    public void setFreelancer(FreelancerProfile freelancer) {
        this.freelancer = freelancer;
    }

    public BigDecimal getScore() {
        return score;
    }

    public void setScore(BigDecimal score) {
        this.score = score;
    }

    public String getRulesVersion() {
        return rulesVersion;
    }

    public void setRulesVersion(String rulesVersion) {
        this.rulesVersion = rulesVersion;
    }

    public String getBreakdownJson() {
        return breakdownJson;
    }

    public void setBreakdownJson(String breakdownJson) {
        this.breakdownJson = breakdownJson;
    }

    public Instant getEvaluatedAt() {
        return evaluatedAt;
    }

    public void setEvaluatedAt(Instant evaluatedAt) {
        this.evaluatedAt = evaluatedAt;
    }
}
