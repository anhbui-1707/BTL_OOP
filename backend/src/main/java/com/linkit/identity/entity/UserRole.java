package com.linkit.identity.entity;

import jakarta.persistence.*;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.*;

@Entity
@Table(name = "user_roles", schema = "dbo")
public class UserRole {
    public enum Role {
        CLIENT,
        FREELANCER,
        ADMIN
    }

    @EmbeddedId
    private UserRoleId id = new UserRoleId();

    @JdbcTypeCode(SqlTypes.TIMESTAMP)
    @Column(name = "assigned_at", nullable = false, columnDefinition = "datetime2(3)")
    private Instant assignedAt;

    @MapsId("userId")
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(
            name = "user_id",
            nullable = false,
            foreignKey = @ForeignKey(name = "FK_user_roles_user"))
    private User user;

    public UserRole() {

    }

    public UserRoleId getId() {
        return id;
    }

    public void setId(UserRoleId id) {
        this.id = id;
    }

    public Instant getAssignedAt() {
        return assignedAt;
    }

    public void setAssignedAt(Instant assignedAt) {
        this.assignedAt = assignedAt;
    }

    public User getUser() {
        return user;
    }

    public void setUser(User user) {
        this.user = user;
    }
}
