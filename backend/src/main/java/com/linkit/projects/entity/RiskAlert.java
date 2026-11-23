package com.linkit.projects.entity;

import jakarta.persistence.*;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.Nationalized;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.*;

@Entity
@Table(name = "risk_alerts", schema = "dbo")
public class RiskAlert {
    public enum Severity {
        LOW,
        MEDIUM,
        HIGH,
        CRITICAL
    }

    public enum Status {
        OPEN,
        ACKNOWLEDGED,
        RESOLVED
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false, columnDefinition = "bigint")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(
            name = "assignment_id",
            referencedColumnName = "id",
            nullable = false,
            foreignKey = @ForeignKey(name = "FK_risk_alerts_assignment"))
    private Assignment assignment;

    @Column(name = "milestone_id", nullable = true, columnDefinition = "bigint")
    private Long milestoneId;

    @Column(name = "risk_type", nullable = false, length = 40, columnDefinition = "varchar(40)")
    private String riskType;

    @Enumerated(EnumType.STRING)
    @Column(name = "severity", nullable = false, length = 10, columnDefinition = "varchar(10)")
    private Severity severity;

    @Nationalized
    @Column(name = "title", nullable = false, length = 200, columnDefinition = "nvarchar(200)")
    private String title;

    @Nationalized
    @Column(
            name = "description",
            nullable = false,
            length = Integer.MAX_VALUE,
            columnDefinition = "nvarchar(max)")
    private String description;

    @Column(name = "rule_code", nullable = false, length = 60, columnDefinition = "varchar(60)")
    private String ruleCode;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20, columnDefinition = "varchar(20)")
    private Status status;

    @JdbcTypeCode(SqlTypes.TIMESTAMP)
    @Column(name = "detected_at", nullable = false, columnDefinition = "datetime2(3)")
    private Instant detectedAt;

    @JdbcTypeCode(SqlTypes.TIMESTAMP)
    @Column(name = "resolved_at", nullable = true, columnDefinition = "datetime2(3)")
    private Instant resolvedAt;

    @ManyToOne(fetch = FetchType.LAZY, optional = true)
    @JoinColumns(
            value = {
                @JoinColumn(
                        name = "assignment_id",
                        referencedColumnName = "assignment_id",
                        nullable = true,
                        insertable = false,
                        updatable = false),
                @JoinColumn(
                        name = "milestone_id",
                        referencedColumnName = "id",
                        nullable = true,
                        insertable = false,
                        updatable = false)
            },
            foreignKey = @ForeignKey(name = "FK_risk_alerts_assignment_milestone"))
    private Milestone milestone;

    public RiskAlert() {}

    public Long getId() {
        return id;
    }

    public Assignment getAssignment() {
        return assignment;
    }

    public void setAssignment(Assignment assignment) {
        this.assignment = assignment;
    }

    public Long getMilestoneId() {
        return milestoneId;
    }

    public void setMilestoneId(Long milestoneId) {
        this.milestoneId = milestoneId;
    }

    public String getRiskType() {
        return riskType;
    }

    public void setRiskType(String riskType) {
        this.riskType = riskType;
    }

    public Severity getSeverity() {
        return severity;
    }

    public void setSeverity(Severity severity) {
        this.severity = severity;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getRuleCode() {
        return ruleCode;
    }

    public void setRuleCode(String ruleCode) {
        this.ruleCode = ruleCode;
    }

    public Status getStatus() {
        return status;
    }

    public void setStatus(Status status) {
        this.status = status;
    }

    public Instant getDetectedAt() {
        return detectedAt;
    }

    public void setDetectedAt(Instant detectedAt) {
        this.detectedAt = detectedAt;
    }

    public Instant getResolvedAt() {
        return resolvedAt;
    }

    public void setResolvedAt(Instant resolvedAt) {
        this.resolvedAt = resolvedAt;
    }

    public Milestone getMilestone() {
        return milestone;
    }

    public void setMilestone(Milestone milestone) {
        this.milestone = milestone;
        this.milestoneId = milestone == null ? null : milestone.getId();
    }
}
