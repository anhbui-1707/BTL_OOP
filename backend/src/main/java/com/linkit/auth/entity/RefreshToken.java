package com.linkit.auth.entity;

import com.linkit.identity.entity.User;

import jakarta.persistence.*;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.*;

@Entity
@Table(
        name = "refresh_tokens",
        schema = "dbo",
        uniqueConstraints = {
            @UniqueConstraint(
                    name = "UQ_refresh_tokens_hash",
                    columnNames = {"token_hash"})
        })
public class RefreshToken {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false, columnDefinition = "bigint")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(
            name = "user_id",
            referencedColumnName = "id",
            nullable = false,
            foreignKey = @ForeignKey(name = "FK_refresh_tokens_user"))
    private User user;

    @Column(name = "token_hash", nullable = false, length = 32, columnDefinition = "varbinary(32)")
    private byte[] tokenHash;

    @JdbcTypeCode(SqlTypes.TIMESTAMP)
    @Column(name = "expires_at", nullable = false, columnDefinition = "datetime2(3)")
    private Instant expiresAt;

    @JdbcTypeCode(SqlTypes.TIMESTAMP)
    @Column(name = "revoked_at", nullable = true, columnDefinition = "datetime2(3)")
    private Instant revokedAt;

    @JdbcTypeCode(SqlTypes.TIMESTAMP)
    @Column(name = "created_at", nullable = false, columnDefinition = "datetime2(3)")
    private Instant createdAt;

    public RefreshToken() {

    }

    public Long getId() {
        return id;
    }

    public User getUser() {
        return user;
    }

    public void setUser(User user) {
        this.user = user;
    }

    public byte[] getTokenHash() {
        return tokenHash == null ? null : tokenHash.clone();
    }

    public void setTokenHash(byte[] tokenHash) {
        this.tokenHash = tokenHash == null ? null : tokenHash.clone();
    }

    public Instant getExpiresAt() {
        return expiresAt;
    }

    public void setExpiresAt(Instant expiresAt) {
        this.expiresAt = expiresAt;
    }

    public Instant getRevokedAt() {
        return revokedAt;
    }

    public void setRevokedAt(Instant revokedAt) {
        this.revokedAt = revokedAt;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}
