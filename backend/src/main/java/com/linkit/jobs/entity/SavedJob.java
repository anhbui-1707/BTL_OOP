package com.linkit.jobs.entity;

import jakarta.persistence.*;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;

@Entity
@Table(
        name = "saved_jobs",
        schema = "dbo",
        uniqueConstraints =
                @UniqueConstraint(
                        name = "UQ_saved_jobs_freelancer_job",
                        columnNames = {"freelancer_id", "job_id"}))
public class SavedJob {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false, columnDefinition = "bigint")
    private Long id;

    @Column(name = "freelancer_id", nullable = false, columnDefinition = "bigint")
    private Long freelancerId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(
            name = "job_id",
            nullable = false,
            foreignKey = @ForeignKey(name = "FK_saved_jobs_job"))
    private Job job;

    @JdbcTypeCode(SqlTypes.TIMESTAMP)
    @Column(name = "saved_at", nullable = false, columnDefinition = "datetime2(3)")
    private Instant savedAt;

    protected SavedJob() {}

    public SavedJob(Long freelancerId, Job job, Instant savedAt) {
        this.freelancerId = freelancerId;
        this.job = job;
        this.savedAt = savedAt;
    }

    public Job getJob() {
        return job;
    }

    public Instant getSavedAt() {
        return savedAt;
    }
}
