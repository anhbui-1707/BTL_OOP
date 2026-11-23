package com.linkit.audit.entity;

import com.linkit.identity.entity.User;

import jakarta.persistence.*;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.Nationalized;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.*;

@Entity
@Table(name = "audit_logs", schema = "dbo")
public class AuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false, columnDefinition = "bigint")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = true)
    @JoinColumn(
            name = "actor_user_id",
            referencedColumnName = "id",
            nullable = true,
            foreignKey = @ForeignKey(name = "FK_audit_logs_actor"))
    private User actor;

    @Column(name = "entity_type", nullable = false, length = 60, columnDefinition = "varchar(60)")
    private String entityType;

    @Column(name = "entity_id", nullable = false, columnDefinition = "bigint")
    private Long entityId;

    @Column(name = "action", nullable = false, length = 80, columnDefinition = "varchar(80)")
    private String action;

    @Nationalized
    @Column(
            name = "before_json",
            nullable = true,
            length = Integer.MAX_VALUE,
            columnDefinition = "nvarchar(max)")
    private String beforeJson;

    @Nationalized
    @Column(
            name = "after_json",
            nullable = true,
            length = Integer.MAX_VALUE,
            columnDefinition = "nvarchar(max)")
    private String afterJson;

    @Column(name = "request_id", nullable = true, columnDefinition = "uniqueidentifier")
    private UUID requestId;

    @JdbcTypeCode(SqlTypes.TIMESTAMP)
    @Column(name = "created_at", nullable = false, columnDefinition = "datetime2(3)")
    private Instant createdAt;

    public AuditLog() {}

    public Long getId() {
        return id;
    }

    public User getActor() {
        return actor;
    }

    public void setActor(User actor) {
        this.actor = actor;
    }

    public String getEntityType() {
        return entityType;
    }

    public void setEntityType(String entityType) {
        this.entityType = entityType;
    }

    public Long getEntityId() {
        return entityId;
    }

    public void setEntityId(Long entityId) {
        this.entityId = entityId;
    }

    public String getAction() {
        return action;
    }

    public void setAction(String action) {
        this.action = action;
    }

    public String getBeforeJson() {
        return beforeJson;
    }

    public void setBeforeJson(String beforeJson) {
        this.beforeJson = beforeJson;
    }

    public String getAfterJson() {
        return afterJson;
    }

    public void setAfterJson(String afterJson) {
        this.afterJson = afterJson;
    }

    public UUID getRequestId() {
        return requestId;
    }

    public void setRequestId(UUID requestId) {
        this.requestId = requestId;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}
