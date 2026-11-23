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
        name = "change_request_approvals",
        schema = "dbo",
        uniqueConstraints = {
            @UniqueConstraint(
                    name = "UQ_change_request_approvals_request_role",
                    columnNames = {"change_request_id", "party_role"})
        })
public class ChangeRequestApproval {
    public enum PartyRole {
        CLIENT,
        FREELANCER
    }

    public enum Decision {
        APPROVED,
        REJECTED
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false, columnDefinition = "bigint")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(
            name = "change_request_id",
            referencedColumnName = "id",
            nullable = false,
            foreignKey = @ForeignKey(name = "FK_change_request_approvals_request"))
    private ChangeRequest changeRequest;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(
            name = "user_id",
            referencedColumnName = "id",
            nullable = false,
            foreignKey = @ForeignKey(name = "FK_change_request_approvals_user"))
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(name = "party_role", nullable = false, length = 20, columnDefinition = "varchar(20)")
    private PartyRole partyRole;

    @Enumerated(EnumType.STRING)
    @Column(name = "decision", nullable = false, length = 20, columnDefinition = "varchar(20)")
    private Decision decision;

    @Nationalized
    @Column(
            name = "comment",
            nullable = true,
            length = Integer.MAX_VALUE,
            columnDefinition = "nvarchar(max)")
    private String comment;

    @JdbcTypeCode(SqlTypes.TIMESTAMP)
    @Column(name = "decided_at", nullable = false, columnDefinition = "datetime2(3)")
    private Instant decidedAt;

    public ChangeRequestApproval() {}

    public Long getId() {
        return id;
    }

    public ChangeRequest getChangeRequest() {
        return changeRequest;
    }

    public void setChangeRequest(ChangeRequest changeRequest) {
        this.changeRequest = changeRequest;
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

    public Decision getDecision() {
        return decision;
    }

    public void setDecision(Decision decision) {
        this.decision = decision;
    }

    public String getComment() {
        return comment;
    }

    public void setComment(String comment) {
        this.comment = comment;
    }

    public Instant getDecidedAt() {
        return decidedAt;
    }

    public void setDecidedAt(Instant decidedAt) {
        this.decidedAt = decidedAt;
    }
}
