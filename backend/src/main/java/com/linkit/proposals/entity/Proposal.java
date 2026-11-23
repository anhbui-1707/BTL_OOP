package com.linkit.proposals.entity;

import com.linkit.identity.entity.FreelancerCv;
import com.linkit.identity.entity.FreelancerProfile;
import com.linkit.jobs.entity.Job;

import jakarta.persistence.*;

import org.hibernate.annotations.Generated;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.Nationalized;
import org.hibernate.generator.EventType;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;

@Entity
@Table(
        name = "proposals",
        schema = "dbo",
        uniqueConstraints = {
            @UniqueConstraint(
                    name = "UQ_proposals_job_freelancer",
                    columnNames = {"job_id", "freelancer_id"}),
            @UniqueConstraint(
                    name = "UQ_proposals_id_job_freelancer",
                    columnNames = {"id", "job_id", "freelancer_id"})
        })
public class Proposal {
    public enum Status {
        PENDING,
        ACCEPTED,
        REJECTED,
        WITHDRAWN
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false, columnDefinition = "bigint")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(
            name = "job_id",
            referencedColumnName = "id",
            nullable = false,
            foreignKey = @ForeignKey(name = "FK_proposals_job"))
    private Job job;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(
            name = "freelancer_id",
            referencedColumnName = "user_id",
            nullable = false,
            foreignKey = @ForeignKey(name = "FK_proposals_freelancer"))
    private FreelancerProfile freelancer;

    @Nationalized
    @Column(
            name = "cover_letter",
            nullable = false,
            length = Integer.MAX_VALUE,
            columnDefinition = "nvarchar(max)")
    private String coverLetter;

    @Column(
            name = "proposed_budget",
            nullable = false,
            precision = 19,
            scale = 2,
            columnDefinition = "decimal(19,2)")
    private BigDecimal proposedBudget;

    @Column(name = "estimated_days", nullable = false, columnDefinition = "int")
    private Integer estimatedDays;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20, columnDefinition = "varchar(20)")
    private Status status;

    @JdbcTypeCode(SqlTypes.TIMESTAMP)
    @Column(name = "submitted_at", nullable = false, columnDefinition = "datetime2(3)")
    private Instant submittedAt;

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

    @Column(
            name = "job_id",
            nullable = false,
            columnDefinition = "bigint",
            insertable = false,
            updatable = false)
    private Long jobId;

    @Column(
            name = "freelancer_id",
            nullable = false,
            columnDefinition = "bigint",
            insertable = false,
            updatable = false)
    private Long freelancerId;

    @Column(name = "cv_id", nullable = true, columnDefinition = "bigint")
    private Long cvId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "cv_id", referencedColumnName = "id", insertable = false, updatable = false)
    private FreelancerCv cv;

    public Proposal() {}

    public Long getId() {
        return id;
    }

    public Job getJob() {
        return job;
    }

    public void setJob(Job job) {
        this.job = job;
        this.jobId = job == null ? null : job.getId();
    }

    public FreelancerProfile getFreelancer() {
        return freelancer;
    }

    public void setFreelancer(FreelancerProfile freelancer) {
        this.freelancer = freelancer;
        this.freelancerId = freelancer == null ? null : freelancer.getUserId();
    }

    public String getCoverLetter() {
        return coverLetter;
    }

    public void setCoverLetter(String coverLetter) {
        this.coverLetter = coverLetter;
    }

    public BigDecimal getProposedBudget() {
        return proposedBudget;
    }

    public void setProposedBudget(BigDecimal proposedBudget) {
        this.proposedBudget = proposedBudget;
    }

    public Integer getEstimatedDays() {
        return estimatedDays;
    }

    public void setEstimatedDays(Integer estimatedDays) {
        this.estimatedDays = estimatedDays;
    }

    public Status getStatus() {
        return status;
    }

    public void setStatus(Status status) {
        this.status = status;
    }

    public Instant getSubmittedAt() {
        return submittedAt;
    }

    public void setSubmittedAt(Instant submittedAt) {
        this.submittedAt = submittedAt;
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

    public Long getJobId() {
        return jobId;
    }

    public Long getFreelancerId() {
        return freelancerId;
    }

    public Long getCvId() {
        return cvId;
    }

    public void setCvId(Long cvId) {
        this.cvId = cvId;
    }

    public FreelancerCv getCv() {
        return cv;
    }
}
