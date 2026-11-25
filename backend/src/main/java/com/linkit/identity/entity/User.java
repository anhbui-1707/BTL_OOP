package com.linkit.identity.entity;

import com.linkit.auth.entity.RefreshToken;

import jakarta.persistence.*;

import org.hibernate.annotations.Generated;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.Nationalized;
import org.hibernate.generator.EventType;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.*;

@Entity
@Table(
        name = "users",
        schema = "dbo",
        uniqueConstraints = {
            @UniqueConstraint(
                    name = "UQ_users_email",
                    columnNames = {"email"})
        })
public class User {
    public enum Status {
        ACTIVE,
        LOCKED,
        DISABLED
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false, columnDefinition = "bigint")
    private Long id;

    @Nationalized
    @Column(name = "email", nullable = false, length = 254, columnDefinition = "nvarchar(254)")
    private String email;

    @Column(
            name = "password_hash",
            nullable = false,
            length = 100,
            columnDefinition = "varchar(100)")
    private String passwordHash;

    @Nationalized
    @Column(name = "full_name", nullable = false, length = 150, columnDefinition = "nvarchar(150)")
    private String fullName;

    @Column(name = "phone_number", nullable = true, length = 20, columnDefinition = "varchar(20)")
    private String phoneNumber;

    @Nationalized
    @Column(
            name = "avatar_url",
            nullable = true,
            length = 1000,
            columnDefinition = "nvarchar(1000)")
    private String avatarUrl;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20, columnDefinition = "varchar(20)")
    private Status status;

    @JdbcTypeCode(SqlTypes.TIMESTAMP)
    @Column(name = "email_verified_at", nullable = true, columnDefinition = "datetime2(3)")
    private Instant emailVerifiedAt;

    @JdbcTypeCode(SqlTypes.TIMESTAMP)
    @Column(name = "created_at", nullable = false, columnDefinition = "datetime2(3)")
    private Instant createdAt;

    @JdbcTypeCode(SqlTypes.TIMESTAMP)
    @Column(name = "updated_at", nullable = false, columnDefinition = "datetime2(3)")
    private Instant updatedAt;

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

    @OneToMany(mappedBy = "user", fetch = FetchType.LAZY)
    private Set<UserRole> roles = new HashSet<>();

    @OneToMany(mappedBy = "user", fetch = FetchType.LAZY)
    private Set<RefreshToken> refreshTokens = new HashSet<>();

    public User() {

    }

    public Long getId() {
        return id;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getPasswordHash() {
        return passwordHash;
    }

    public void setPasswordHash(String passwordHash) {
        this.passwordHash = passwordHash;
    }

    public String getFullName() {
        return fullName;
    }

    public void setFullName(String fullName) {
        this.fullName = fullName;
    }

    public String getPhoneNumber() {
        return phoneNumber;
    }

    public void setPhoneNumber(String phoneNumber) {
        this.phoneNumber = phoneNumber;
    }

    public String getAvatarUrl() {
        return avatarUrl;
    }

    public void setAvatarUrl(String avatarUrl) {
        this.avatarUrl = avatarUrl;
    }

    public Status getStatus() {
        return status;
    }

    public void setStatus(Status status) {
        this.status = status;
    }

    public Instant getEmailVerifiedAt() {
        return emailVerifiedAt;
    }

    public void setEmailVerifiedAt(Instant emailVerifiedAt) {
        this.emailVerifiedAt = emailVerifiedAt;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }

    public byte[] getRowVer() {
        return rowVer == null ? null : rowVer.clone();
    }

    public Set<UserRole> getRoles() {
        return roles;
    }

    public Set<RefreshToken> getRefreshTokens() {
        return refreshTokens;
    }
}
