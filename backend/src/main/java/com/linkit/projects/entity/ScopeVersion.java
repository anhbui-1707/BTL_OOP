package com.linkit.projects.entity;

import com.linkit.identity.entity.User;

import jakarta.persistence.*;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.Nationalized;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.*;

@Entity
@Table(
        name = "scope_versions",
        schema = "dbo",
        uniqueConstraints = {
            @UniqueConstraint(
                    name = "UQ_scope_versions_assignment_version",
                    columnNames = {"assignment_id", "version_number"}),
            @UniqueConstraint(
                    name = "UQ_scope_versions_assignment_id",
                    columnNames = {"assignment_id", "id"})
        })
public class ScopeVersion {
    public enum Status {
        DRAFT,
        PENDING_APPROVAL,
        LOCKED,
        SUPERSEDED
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
            foreignKey = @ForeignKey(name = "FK_scope_versions_assignment"))
    private Assignment assignment;

    @Column(name = "version_number", nullable = false, columnDefinition = "int")
    private Integer versionNumber;

    @Nationalized
    @Column(
            name = "deliverables",
            nullable = false,
            length = Integer.MAX_VALUE,
            columnDefinition = "nvarchar(max)")
    private String deliverables;

    @Nationalized
    @Column(
            name = "exclusions",
            nullable = true,
            length = Integer.MAX_VALUE,
            columnDefinition = "nvarchar(max)")
    private String exclusions;

    @Nationalized
    @Column(
            name = "acceptance_criteria",
            nullable = false,
            length = Integer.MAX_VALUE,
            columnDefinition = "nvarchar(max)")
    private String acceptanceCriteria;

    @Column(
            name = "budget",
            nullable = false,
            precision = 19,
            scale = 2,
            columnDefinition = "decimal(19,2)")
    private BigDecimal budget;

    @Column(name = "deadline", nullable = false, columnDefinition = "date")
    private LocalDate deadline;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20, columnDefinition = "varchar(20)")
    private Status status;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(
            name = "created_by",
            referencedColumnName = "id",
            nullable = false,
            foreignKey = @ForeignKey(name = "FK_scope_versions_creator"))
    private User createdBy;

    @JdbcTypeCode(SqlTypes.TIMESTAMP)
    @Column(name = "created_at", nullable = false, columnDefinition = "datetime2(3)")
    private Instant createdAt;

    @JdbcTypeCode(SqlTypes.TIMESTAMP)
    @Column(name = "locked_at", nullable = true, columnDefinition = "datetime2(3)")
    private Instant lockedAt;

    @Column(
            name = "assignment_id",
            nullable = false,
            columnDefinition = "bigint",
            insertable = false,
            updatable = false)
    private Long assignmentId;

    @OneToMany(mappedBy = "scopeVersion", fetch = FetchType.LAZY)
    private Set<ScopeApproval> approvals = new HashSet<>();

    @OneToMany(mappedBy = "scopeVersion", fetch = FetchType.LAZY)
    private Set<Milestone> milestones = new HashSet<>();

    public ScopeVersion() {}

    public Long getId() {
        return id;
    }

    public Assignment getAssignment() {
        return assignment;
    }

    public void setAssignment(Assignment assignment) {
        this.assignment = assignment;
        this.assignmentId = assignment == null ? null : assignment.getId();
    }

    public Integer getVersionNumber() {
        return versionNumber;
    }

    public void setVersionNumber(Integer versionNumber) {
        this.versionNumber = versionNumber;
    }

    public String getDeliverables() {
        return deliverables;
    }

    public void setDeliverables(String deliverables) {
        this.deliverables = deliverables;
    }

    public String getExclusions() {
        return exclusions;
    }

    public void setExclusions(String exclusions) {
        this.exclusions = exclusions;
    }

    public String getAcceptanceCriteria() {
        return acceptanceCriteria;
    }

    public void setAcceptanceCriteria(String acceptanceCriteria) {
        this.acceptanceCriteria = acceptanceCriteria;
    }

    public BigDecimal getBudget() {
        return budget;
    }

    public void setBudget(BigDecimal budget) {
        this.budget = budget;
    }

    public LocalDate getDeadline() {
        return deadline;
    }

    public void setDeadline(LocalDate deadline) {
        this.deadline = deadline;
    }

    public Status getStatus() {
        return status;
    }

    public void setStatus(Status status) {
        this.status = status;
    }

    public User getCreatedBy() {
        return createdBy;
    }

    public void setCreatedBy(User createdBy) {
        this.createdBy = createdBy;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Instant getLockedAt() {
        return lockedAt;
    }

    public void setLockedAt(Instant lockedAt) {
        this.lockedAt = lockedAt;
    }

    public Long getAssignmentId() {
        return assignmentId;
    }

    public Set<ScopeApproval> getApprovals() {
        return approvals;
    }

    public Set<Milestone> getMilestones() {
        return milestones;
    }
}
