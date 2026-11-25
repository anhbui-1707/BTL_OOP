package com.linkit.projects.entity;

import com.linkit.identity.entity.ClientProfile;
import com.linkit.identity.entity.FreelancerProfile;
import com.linkit.jobs.entity.Job;
import com.linkit.proposals.entity.Proposal;

import jakarta.persistence.*;

import org.hibernate.annotations.Generated;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.generator.EventType;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;

@Entity
@Table(
        name = "assignments",
        schema = "dbo",
        uniqueConstraints = {
            @UniqueConstraint(
                    name = "UQ_assignments_job",
                    columnNames = {"job_id"}),
            @UniqueConstraint(
                    name = "UQ_assignments_proposal",
                    columnNames = {"proposal_id"})
        })
public class Assignment {
    public enum Status {
        PENDING_SCOPE,
        ACTIVE,
        AWAITING_ACCEPTANCE,
        COMPLETED,
        CANCELLED
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false, columnDefinition = "bigint")
    private Long id;

    @Column(name = "job_id", nullable = false, columnDefinition = "bigint")
    private Long jobId;

    @Column(name = "proposal_id", nullable = false, columnDefinition = "bigint")
    private Long proposalId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(
            name = "client_id",
            referencedColumnName = "user_id",
            nullable = false,
            foreignKey = @ForeignKey(name = "FK_assignments_client"))
    private ClientProfile client;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(
            name = "freelancer_id",
            referencedColumnName = "user_id",
            nullable = false,
            foreignKey = @ForeignKey(name = "FK_assignments_freelancer"))
    private FreelancerProfile freelancer;

    @Column(
            name = "agreed_budget",
            nullable = false,
            precision = 19,
            scale = 2,
            columnDefinition = "decimal(19,2)")
    private BigDecimal agreedBudget;

    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "currency_code", nullable = false, length = 3, columnDefinition = "char(3)")
    private String currencyCode;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 25, columnDefinition = "varchar(25)")
    private Status status;

    @JdbcTypeCode(SqlTypes.TIMESTAMP)
    @Column(name = "started_at", nullable = true, columnDefinition = "datetime2(3)")
    private Instant startedAt;

    @JdbcTypeCode(SqlTypes.TIMESTAMP)
    @Column(name = "completed_at", nullable = true, columnDefinition = "datetime2(3)")
    private Instant completedAt;

    @JdbcTypeCode(SqlTypes.TIMESTAMP)
    @Column(name = "created_at", nullable = false, columnDefinition = "datetime2(3)")
    private Instant createdAt;

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

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumns(
            value = {
                @JoinColumn(
                        name = "job_id",
                        referencedColumnName = "id",
                        nullable = false,
                        insertable = false,
                        updatable = false),
                @JoinColumn(
                        name = "client_id",
                        referencedColumnName = "client_id",
                        nullable = false,
                        insertable = false,
                        updatable = false)
            },
            foreignKey = @ForeignKey(name = "FK_assignments_job_client"))
    private Job job;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumns(
            value = {
                @JoinColumn(
                        name = "proposal_id",
                        referencedColumnName = "id",
                        nullable = false,
                        insertable = false,
                        updatable = false),
                @JoinColumn(
                        name = "job_id",
                        referencedColumnName = "job_id",
                        nullable = false,
                        insertable = false,
                        updatable = false),
                @JoinColumn(
                        name = "freelancer_id",
                        referencedColumnName = "freelancer_id",
                        nullable = false,
                        insertable = false,
                        updatable = false)
            },
            foreignKey = @ForeignKey(name = "FK_assignments_proposal_job_freelancer"))
    private Proposal proposal;

    @OneToMany(mappedBy = "assignment", fetch = FetchType.LAZY)
    private Set<ScopeVersion> scopeVersions = new HashSet<>();

    @OneToMany(mappedBy = "assignment", fetch = FetchType.LAZY)
    private Set<Milestone> milestones = new HashSet<>();

    public Assignment() {}

    public Long getId() {
        return id;
    }

    public Long getJobId() {
        return jobId;
    }

    public void setJobId(Long jobId) {
        this.jobId = jobId;
    }

    public Long getProposalId() {
        return proposalId;
    }

    public void setProposalId(Long proposalId) {
        this.proposalId = proposalId;
    }

    public ClientProfile getClient() {
        return client;
    }

    public void setClient(ClientProfile client) {
        this.client = client;
    }

    public FreelancerProfile getFreelancer() {
        return freelancer;
    }

    public void setFreelancer(FreelancerProfile freelancer) {
        this.freelancer = freelancer;
    }

    public BigDecimal getAgreedBudget() {
        return agreedBudget;
    }

    public void setAgreedBudget(BigDecimal agreedBudget) {
        this.agreedBudget = agreedBudget;
    }

    public String getCurrencyCode() {
        return currencyCode;
    }

    public void setCurrencyCode(String currencyCode) {
        this.currencyCode = currencyCode;
    }

    public Status getStatus() {
        return status;
    }

    public void setStatus(Status status) {
        this.status = status;
    }

    public Instant getStartedAt() {
        return startedAt;
    }

    public void setStartedAt(Instant startedAt) {
        this.startedAt = startedAt;
    }

    public Instant getCompletedAt() {
        return completedAt;
    }

    public void setCompletedAt(Instant completedAt) {
        this.completedAt = completedAt;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public byte[] getRowVer() {
        return rowVer == null ? null : rowVer.clone();
    }

    public Job getJob() {
        return job;
    }

    public void setJob(Job job) {
        this.job = job;
        this.jobId = job == null ? null : job.getId();
    }

    public Proposal getProposal() {
        return proposal;
    }

    public void setProposal(Proposal proposal) {
        this.proposal = proposal;
        this.proposalId = proposal == null ? null : proposal.getId();
    }

    public Set<ScopeVersion> getScopeVersions() {
        return scopeVersions;
    }

    public Set<Milestone> getMilestones() {
        return milestones;
    }

}
