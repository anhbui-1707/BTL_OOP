package com.linkit.jobs.entity;

import jakarta.persistence.*;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.Nationalized;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;

@Entity
@Table(name = "job_quality_assessments", schema = "dbo")
public class JobQualityAssessment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false, columnDefinition = "bigint")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(
            name = "job_id",
            referencedColumnName = "id",
            nullable = false,
            foreignKey = @ForeignKey(name = "FK_job_quality_assessments_job"))
    private Job job;

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

    @Nationalized
    @Column(
            name = "recommendations_json",
            nullable = false,
            length = Integer.MAX_VALUE,
            columnDefinition = "nvarchar(max)")
    private String recommendationsJson;

    @JdbcTypeCode(SqlTypes.TIMESTAMP)
    @Column(name = "evaluated_at", nullable = false, columnDefinition = "datetime2(3)")
    private Instant evaluatedAt;

    public JobQualityAssessment() {}

    public Long getId() {
        return id;
    }

    public Job getJob() {
        return job;
    }

    public void setJob(Job job) {
        this.job = job;
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

    public String getRecommendationsJson() {
        return recommendationsJson;
    }

    public void setRecommendationsJson(String recommendationsJson) {
        this.recommendationsJson = recommendationsJson;
    }

    public Instant getEvaluatedAt() {
        return evaluatedAt;
    }

    public void setEvaluatedAt(Instant evaluatedAt) {
        this.evaluatedAt = evaluatedAt;
    }
}
