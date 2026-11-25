package com.linkit.identity.entity;

import jakarta.persistence.*;

import java.io.Serializable;
import java.util.Objects;

@Embeddable
public class UserRoleId implements Serializable {
    private static final long serialVersionUID = 1L;

    @Column(name = "user_id", nullable = false, columnDefinition = "bigint")
    private Long userId;

    @Enumerated(EnumType.STRING)
    @Column(name = "role", nullable = false, length = 20, columnDefinition = "varchar(20)")
    private UserRole.Role role;

    public UserRoleId() {

    }

    public UserRoleId(Long userId, UserRole.Role role) {
        this.userId = userId;
        this.role = role;
    }

    public Long getUserId() {
        return userId;
    }

    public void setUserId(Long userId) {
        this.userId = userId;
    }

    public UserRole.Role getRole() {
        return role;
    }

    public void setRole(UserRole.Role role) {
        this.role = role;
    }

    @Override
    public boolean equals(Object value) {
        if (this == value) return true;
        if (!(value instanceof UserRoleId other)) return false;
        return Objects.equals(userId, other.userId) && Objects.equals(role, other.role);
    }

    @Override
    public int hashCode() {
        return Objects.hash(userId, role);
    }
}
