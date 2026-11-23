package com.linkit.projects.entity;

import com.linkit.identity.entity.User;

import jakarta.persistence.*;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.Nationalized;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.*;

@Entity
@Table(
        name = "final_acceptances",
        schema = "dbo",
        uniqueConstraints = {
            @UniqueConstraint(
                    name = "UQ_final_acceptances_assignment",
                    columnNames = {"assignment_id"})
        })
public class FinalAcceptance {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false, columnDefinition = "bigint")
    private Long id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(
            name = "assignment_id",
            referencedColumnName = "id",
            nullable = false,
            foreignKey = @ForeignKey(name = "FK_final_acceptances_assignment"))
    private Assignment assignment;

    @Column(name = "scope_version_id", nullable = false, columnDefinition = "bigint")
    private Long scopeVersionId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(
            name = "accepted_by",
            referencedColumnName = "id",
            nullable = false,
            foreignKey = @ForeignKey(name = "FK_final_acceptances_acceptor"))
    private User acceptedBy;

    @Nationalized
    @Column(
            name = "acceptance_note",
            nullable = true,
            length = Integer.MAX_VALUE,
            columnDefinition = "nvarchar(max)")
    private String acceptanceNote;

    @JdbcTypeCode(SqlTypes.TIMESTAMP)
    @Column(name = "accepted_at", nullable = false, columnDefinition = "datetime2(3)")
    private Instant acceptedAt;

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
            foreignKey = @ForeignKey(name = "FK_final_acceptances_scope"))
    private ScopeVersion scopeVersion;

    public FinalAcceptance() {}

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

    public User getAcceptedBy() {
        return acceptedBy;
    }

    public void setAcceptedBy(User acceptedBy) {
        this.acceptedBy = acceptedBy;
    }

    public String getAcceptanceNote() {
        return acceptanceNote;
    }

    public void setAcceptanceNote(String acceptanceNote) {
        this.acceptanceNote = acceptanceNote;
    }

    public Instant getAcceptedAt() {
        return acceptedAt;
    }

    public void setAcceptedAt(Instant acceptedAt) {
        this.acceptedAt = acceptedAt;
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
}
