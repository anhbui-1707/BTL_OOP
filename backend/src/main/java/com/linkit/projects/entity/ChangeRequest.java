package com.linkit.projects.entity;

import com.linkit.identity.entity.User;

import jakarta.persistence.*;

import org.hibernate.annotations.Generated;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.Nationalized;
import org.hibernate.generator.EventType;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;

@Entity
@Table(name = "change_requests", schema = "dbo")
public class ChangeRequest {
    public enum Status {
        PENDING,
        APPROVED,
        REJECTED,
        APPLIED,
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
            foreignKey = @ForeignKey(name = "FK_change_requests_assignment"))
    private Assignment assignment;

    @Column(name = "base_scope_version_id", nullable = false, columnDefinition = "bigint")
    private Long baseScopeVersionId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(
            name = "requested_by",
            referencedColumnName = "id",
            nullable = false,
            foreignKey = @ForeignKey(name = "FK_change_requests_requester"))
    private User requestedBy;

    @Nationalized
    @Column(name = "title", nullable = false, length = 200, columnDefinition = "nvarchar(200)")
    private String title;

    @Nationalized
    @Column(
            name = "reason",
            nullable = false,
            length = Integer.MAX_VALUE,
            columnDefinition = "nvarchar(max)")
    private String reason;

    @Nationalized
    @Column(
            name = "proposed_deliverables",
            nullable = false,
            length = Integer.MAX_VALUE,
            columnDefinition = "nvarchar(max)")
    private String proposedDeliverables;

    @Column(
            name = "budget_delta",
            nullable = false,
            precision = 19,
            scale = 2,
            columnDefinition = "decimal(19,2)")
    private BigDecimal budgetDelta;

    @Column(name = "days_delta", nullable = false, columnDefinition = "int")
    private Integer daysDelta;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20, columnDefinition = "varchar(20)")
    private Status status;

    @Column(name = "result_scope_version_id", nullable = true, columnDefinition = "bigint")
    private Long resultScopeVersionId;

    @JdbcTypeCode(SqlTypes.TIMESTAMP)
    @Column(name = "created_at", nullable = false, columnDefinition = "datetime2(3)")
    private Instant createdAt;

    @JdbcTypeCode(SqlTypes.TIMESTAMP)
    @Column(name = "resolved_at", nullable = true, columnDefinition = "datetime2(3)")
    private Instant resolvedAt;

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
                        name = "base_scope_version_id",
                        referencedColumnName = "id",
                        nullable = false,
                        insertable = false,
                        updatable = false)
            },
            foreignKey = @ForeignKey(name = "FK_change_requests_base_scope"))
    private ScopeVersion baseScopeVersion;

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
                        name = "result_scope_version_id",
                        referencedColumnName = "id",
                        nullable = true,
                        insertable = false,
                        updatable = false)
            },
            foreignKey = @ForeignKey(name = "FK_change_requests_result_scope"))
    private ScopeVersion resultScopeVersion;

    @OneToMany(mappedBy = "changeRequest", fetch = FetchType.LAZY)
    private Set<ChangeRequestApproval> approvals = new HashSet<>();

    public ChangeRequest() {}

    public Long getId() {
        return id;
    }

    public Assignment getAssignment() {
        return assignment;
    }

    public void setAssignment(Assignment assignment) {
        this.assignment = assignment;
    }

    public Long getBaseScopeVersionId() {
        return baseScopeVersionId;
    }

    public void setBaseScopeVersionId(Long baseScopeVersionId) {
        this.baseScopeVersionId = baseScopeVersionId;
    }

    public User getRequestedBy() {
        return requestedBy;
    }

    public void setRequestedBy(User requestedBy) {
        this.requestedBy = requestedBy;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getReason() {
        return reason;
    }

    public void setReason(String reason) {
        this.reason = reason;
    }

    public String getProposedDeliverables() {
        return proposedDeliverables;
    }

    public void setProposedDeliverables(String proposedDeliverables) {
        this.proposedDeliverables = proposedDeliverables;
    }

    public BigDecimal getBudgetDelta() {
        return budgetDelta;
    }

    public void setBudgetDelta(BigDecimal budgetDelta) {
        this.budgetDelta = budgetDelta;
    }

    public Integer getDaysDelta() {
        return daysDelta;
    }

    public void setDaysDelta(Integer daysDelta) {
        this.daysDelta = daysDelta;
    }

    public Status getStatus() {
        return status;
    }

    public void setStatus(Status status) {
        this.status = status;
    }

    public Long getResultScopeVersionId() {
        return resultScopeVersionId;
    }

    public void setResultScopeVersionId(Long resultScopeVersionId) {
        this.resultScopeVersionId = resultScopeVersionId;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Instant getResolvedAt() {
        return resolvedAt;
    }

    public void setResolvedAt(Instant resolvedAt) {
        this.resolvedAt = resolvedAt;
    }

    public byte[] getRowVer() {
        return rowVer == null ? null : rowVer.clone();
    }

    public ScopeVersion getBaseScopeVersion() {
        return baseScopeVersion;
    }

    public void setBaseScopeVersion(ScopeVersion baseScopeVersion) {
        this.baseScopeVersion = baseScopeVersion;
        this.baseScopeVersionId = baseScopeVersion == null ? null : baseScopeVersion.getId();
    }

    public ScopeVersion getResultScopeVersion() {
        return resultScopeVersion;
    }

    public void setResultScopeVersion(ScopeVersion resultScopeVersion) {
        this.resultScopeVersion = resultScopeVersion;
        this.resultScopeVersionId = resultScopeVersion == null ? null : resultScopeVersion.getId();
    }

    public Set<ChangeRequestApproval> getApprovals() {
        return approvals;
    }
}
