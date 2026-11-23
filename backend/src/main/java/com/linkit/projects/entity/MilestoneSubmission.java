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
        name = "milestone_submissions",
        schema = "dbo",
        uniqueConstraints = {
            @UniqueConstraint(
                    name = "UQ_milestone_submissions_number",
                    columnNames = {"milestone_id", "submission_number"})
        })
public class MilestoneSubmission {
    public enum Status {
        SUBMITTED,
        APPROVED,
        REVISION_REQUIRED
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false, columnDefinition = "bigint")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(
            name = "milestone_id",
            referencedColumnName = "id",
            nullable = false,
            foreignKey = @ForeignKey(name = "FK_milestone_submissions_milestone"))
    private Milestone milestone;

    @Column(name = "submission_number", nullable = false, columnDefinition = "int")
    private Integer submissionNumber;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(
            name = "submitted_by",
            referencedColumnName = "id",
            nullable = false,
            foreignKey = @ForeignKey(name = "FK_milestone_submissions_submitter"))
    private User submittedBy;

    @Nationalized
    @Column(
            name = "evidence_url",
            nullable = true,
            length = 1000,
            columnDefinition = "nvarchar(1000)")
    private String evidenceUrl;

    @Nationalized
    @Column(
            name = "submission_note",
            nullable = false,
            length = Integer.MAX_VALUE,
            columnDefinition = "nvarchar(max)")
    private String submissionNote;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20, columnDefinition = "varchar(20)")
    private Status status;

    @ManyToOne(fetch = FetchType.LAZY, optional = true)
    @JoinColumn(
            name = "reviewed_by",
            referencedColumnName = "id",
            nullable = true,
            foreignKey = @ForeignKey(name = "FK_milestone_submissions_reviewer"))
    private User reviewedBy;

    @Nationalized
    @Column(
            name = "review_note",
            nullable = true,
            length = Integer.MAX_VALUE,
            columnDefinition = "nvarchar(max)")
    private String reviewNote;

    @JdbcTypeCode(SqlTypes.TIMESTAMP)
    @Column(name = "submitted_at", nullable = false, columnDefinition = "datetime2(3)")
    private Instant submittedAt;

    @JdbcTypeCode(SqlTypes.TIMESTAMP)
    @Column(name = "reviewed_at", nullable = true, columnDefinition = "datetime2(3)")
    private Instant reviewedAt;

    public MilestoneSubmission() {}

    public Long getId() {
        return id;
    }

    public Milestone getMilestone() {
        return milestone;
    }

    public void setMilestone(Milestone milestone) {
        this.milestone = milestone;
    }

    public Integer getSubmissionNumber() {
        return submissionNumber;
    }

    public void setSubmissionNumber(Integer submissionNumber) {
        this.submissionNumber = submissionNumber;
    }

    public User getSubmittedBy() {
        return submittedBy;
    }

    public void setSubmittedBy(User submittedBy) {
        this.submittedBy = submittedBy;
    }

    public String getEvidenceUrl() {
        return evidenceUrl;
    }

    public void setEvidenceUrl(String evidenceUrl) {
        this.evidenceUrl = evidenceUrl;
    }

    public String getSubmissionNote() {
        return submissionNote;
    }

    public void setSubmissionNote(String submissionNote) {
        this.submissionNote = submissionNote;
    }

    public Status getStatus() {
        return status;
    }

    public void setStatus(Status status) {
        this.status = status;
    }

    public User getReviewedBy() {
        return reviewedBy;
    }

    public void setReviewedBy(User reviewedBy) {
        this.reviewedBy = reviewedBy;
    }

    public String getReviewNote() {
        return reviewNote;
    }

    public void setReviewNote(String reviewNote) {
        this.reviewNote = reviewNote;
    }

    public Instant getSubmittedAt() {
        return submittedAt;
    }

    public void setSubmittedAt(Instant submittedAt) {
        this.submittedAt = submittedAt;
    }

    public Instant getReviewedAt() {
        return reviewedAt;
    }

    public void setReviewedAt(Instant reviewedAt) {
        this.reviewedAt = reviewedAt;
    }
}
