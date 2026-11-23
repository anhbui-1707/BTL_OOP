package com.linkit.notifications;

import jakarta.persistence.*;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.Nationalized;
import org.hibernate.type.SqlTypes;

import java.time.Instant;

@Entity
@Table(name = "notifications", schema = "dbo")
public class Notification {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(columnDefinition = "bigint")
    private Long id;

    @Column(name = "recipient_id", nullable = false, columnDefinition = "bigint")
    private Long recipientId;

    @Column(name = "source_audit_id", nullable = false, columnDefinition = "bigint")
    private Long sourceAuditId;

    @Column(nullable = false, length = 80, columnDefinition = "varchar(80)")
    private String kind;

    @Nationalized
    @Column(nullable = false, length = 200, columnDefinition = "nvarchar(200)")
    private String title;

    @Nationalized
    @Column(nullable = false, length = 1000, columnDefinition = "nvarchar(1000)")
    private String description;

    @Column(name = "resource_type", nullable = false, length = 30, columnDefinition = "varchar(30)")
    private String resourceType;

    @Column(name = "resource_id", nullable = false, columnDefinition = "bigint")
    private Long resourceId;

    @Column(name = "job_id", columnDefinition = "bigint")
    private Long jobId;

    @Column(length = 30, columnDefinition = "varchar(30)")
    private String section;

    @JdbcTypeCode(SqlTypes.TIMESTAMP)
    @Column(name = "created_at", nullable = false, columnDefinition = "datetime2(3)")
    private Instant createdAt;

    @JdbcTypeCode(SqlTypes.TIMESTAMP)
    @Column(name = "read_at", columnDefinition = "datetime2(3)")
    private Instant readAt;

    protected Notification() {}

    public Notification(
            Long recipient,
            Long source,
            String kind,
            String title,
            String description,
            String type,
            Long resource,
            Long job,
            String section,
            Instant created) {
        this.recipientId = recipient;
        this.sourceAuditId = source;
        this.kind = kind;
        this.title = title;
        this.description = description;
        this.resourceType = type;
        this.resourceId = resource;
        this.jobId = job;
        this.section = section;
        this.createdAt = created;
    }

    public Long getId() {
        return id;
    }

    public String getKind() {
        return kind;
    }

    public String getTitle() {
        return title;
    }

    public String getDescription() {
        return description;
    }

    public String getResourceType() {
        return resourceType;
    }

    public Long getResourceId() {
        return resourceId;
    }

    public Long getJobId() {
        return jobId;
    }

    public String getSection() {
        return section;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getReadAt() {
        return readAt;
    }
}
