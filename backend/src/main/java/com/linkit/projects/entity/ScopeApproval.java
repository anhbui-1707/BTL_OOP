package com.linkit.projects.entity;

import com.linkit.identity.entity.User;

import jakarta.persistence.*;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.*;

@Entity
@Table(
        name = "scope_approvals",
        schema = "dbo",
        uniqueConstraints = {
            @UniqueConstraint(
                    name = "UQ_scope_approvals_scope_role",
                    columnNames = {"scope_version_id", "party_role"})
        })
public class ScopeApproval {
    public enum PartyRole {
        CLIENT,
        FREELANCER
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false, columnDefinition = "bigint")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(
            name = "scope_version_id",
            referencedColumnName = "id",
            nullable = false,
            foreignKey = @ForeignKey(name = "FK_scope_approvals_scope"))
    private ScopeVersion scopeVersion;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(
            name = "user_id",
            referencedColumnName = "id",
            nullable = false,
            foreignKey = @ForeignKey(name = "FK_scope_approvals_user"))
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(name = "party_role", nullable = false, length = 20, columnDefinition = "varchar(20)")
    private PartyRole partyRole;

    @JdbcTypeCode(SqlTypes.TIMESTAMP)
    @Column(name = "approved_at", nullable = false, columnDefinition = "datetime2(3)")
    private Instant approvedAt;

    public ScopeApproval() {}

    public Long getId() {
        return id;
    }

    public ScopeVersion getScopeVersion() {
        return scopeVersion;
    }

    public void setScopeVersion(ScopeVersion scopeVersion) {
        this.scopeVersion = scopeVersion;
    }

    public User getUser() {
        return user;
    }

    public void setUser(User user) {
        this.user = user;
    }

    public PartyRole getPartyRole() {
        return partyRole;
    }

    public void setPartyRole(PartyRole partyRole) {
        this.partyRole = partyRole;
    }

    public Instant getApprovedAt() {
        return approvedAt;
    }

    public void setApprovedAt(Instant approvedAt) {
        this.approvedAt = approvedAt;
    }
}
