package com.linkit.projects.entity;

import jakarta.persistence.*;

import org.hibernate.annotations.Generated;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.Nationalized;
import org.hibernate.generator.EventType;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.*;

@Entity
@Table(
        name = "milestones",
        schema = "dbo",
        uniqueConstraints = {
            @UniqueConstraint(
                    name = "UQ_milestones_assignment_id",
                    columnNames = {"assignment_id", "id"})
        })
public class Milestone {
    public enum Status {
        PLANNED,
        IN_PROGRESS,
        SUBMITTED,
        REVISION_REQUIRED,
        APPROVED,
        CANCELLED
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
            foreignKey = @ForeignKey(name = "FK_milestones_assignment"))
    private Assignment assignment;

    @Column(name = "scope_version_id", nullable = false, columnDefinition = "bigint")
    private Long scopeVersionId;

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

    @Nationalized
    @Column(
            name = "acceptance_criteria",
            nullable = false,
            length = Integer.MAX_VALUE,
            columnDefinition = "nvarchar(max)")
    private String acceptanceCriteria;

    @Column(name = "due_date", nullable = false, columnDefinition = "date")
    private LocalDate dueDate;

    @Column(
            name = "amount",
            nullable = false,
            precision = 19,
            scale = 2,
            columnDefinition = "decimal(19,2)")
    private BigDecimal amount;

    @Column(name = "is_required", nullable = false, columnDefinition = "bit")
    private Boolean isRequired;

    @Column(name = "sort_order", nullable = false, columnDefinition = "int")
    private Integer sortOrder;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20, columnDefinition = "varchar(20)")
    private Status status;

    @JdbcTypeCode(SqlTypes.TIMESTAMP)
    @Column(name = "approved_at", nullable = true, columnDefinition = "datetime2(3)")
    private Instant approvedAt;

    @JdbcTypeCode(SqlTypes.TIMESTAMP)
    @Column(name = "created_at", nullable = false, columnDefinition = "datetime2(3)")
    private Instant createdAt;

    @Version
    @Generated(event = {EventType.INSERT, EventType.UPDATE})
    @JdbcTypeCode(SqlTypes.BINARY)
    @Column(
            name = "row_ver",
            nullable = false,
            length = 8,
            columnDefinition = "timestamp",
            insertable = false,
            updatable = false)
    private byte[] rowVer;

    @Column(
            name = "assignment_id",
            nullable = false,
            columnDefinition = "bigint",
            insertable = false,
            updatable = false)
    private Long assignmentId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumns(
            value = {
                @JoinColumn(
                        name = "assignment_id",
                        referencedColumnName = "assignment_id",
                        nullable = false,
                        insertable = false,
                        updatable = false),
                @JoinColumn(
                        name = "scope_version_id",
                        referencedColumnName = "id",
                        nullable = false,
                        insertable = false,
                        updatable = false)
            },
            foreignKey = @ForeignKey(name = "FK_milestones_assignment_scope"))
    private ScopeVersion scopeVersion;

    @OneToMany(mappedBy = "milestone", fetch = FetchType.LAZY)
    private Set<MilestoneSubmission> submissions = new HashSet<>();

    public Milestone() {}

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

    public Long getScopeVersionId() {
        return scopeVersionId;
    }

    public void setScopeVersionId(Long scopeVersionId) {
        this.scopeVersionId = scopeVersionId;
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

    public String getAcceptanceCriteria() {
        return acceptanceCriteria;
    }

    public void setAcceptanceCriteria(String acceptanceCriteria) {
        this.acceptanceCriteria = acceptanceCriteria;
    }

    public LocalDate getDueDate() {
        return dueDate;
    }

    public void setDueDate(LocalDate dueDate) {
        this.dueDate = dueDate;
    }

    public BigDecimal getAmount() {
        return amount;
    }

    public void setAmount(BigDecimal amount) {
        this.amount = amount;
    }

    public Boolean getIsRequired() {
        return isRequired;
    }

    public void setIsRequired(Boolean isRequired) {
        this.isRequired = isRequired;
    }

    public Integer getSortOrder() {
        return sortOrder;
    }

    public void setSortOrder(Integer sortOrder) {
        this.sortOrder = sortOrder;
    }

    public Status getStatus() {
        return status;
    }

    public void setStatus(Status status) {
        this.status = status;
    }

    public Instant getApprovedAt() {
        return approvedAt;
    }

    public void setApprovedAt(Instant approvedAt) {
        this.approvedAt = approvedAt;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public byte[] getRowVer() {
        return rowVer == null ? null : rowVer.clone();
    }

    public Long getAssignmentId() {
        return assignmentId;
    }

    public ScopeVersion getScopeVersion() {
        return scopeVersion;
    }

    public void setScopeVersion(ScopeVersion scopeVersion) {
        this.scopeVersion = scopeVersion;
        this.scopeVersionId = scopeVersion == null ? null : scopeVersion.getId();
    }

    public Set<MilestoneSubmission> getSubmissions() {
        return submissions;
    }
}
