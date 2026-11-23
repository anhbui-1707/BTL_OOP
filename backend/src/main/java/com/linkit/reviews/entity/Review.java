package com.linkit.reviews.entity;

import com.linkit.identity.entity.FreelancerProfile;
import com.linkit.identity.entity.User;
import com.linkit.projects.entity.FinalAcceptance;

import jakarta.persistence.*;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.Nationalized;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.*;

@Entity
@Table(
        name = "reviews",
        schema = "dbo",
        uniqueConstraints = {
            @UniqueConstraint(
                    name = "UQ_reviews_assignment",
                    columnNames = {"assignment_id"})
        })
public class Review {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false, columnDefinition = "bigint")
    private Long id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(
            name = "assignment_id",
            referencedColumnName = "assignment_id",
            nullable = false,
            foreignKey = @ForeignKey(name = "FK_reviews_acceptance"))
    private FinalAcceptance finalAcceptance;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(
            name = "reviewer_id",
            referencedColumnName = "id",
            nullable = false,
            foreignKey = @ForeignKey(name = "FK_reviews_reviewer"))
    private User reviewer;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(
            name = "freelancer_id",
            referencedColumnName = "user_id",
            nullable = false,
            foreignKey = @ForeignKey(name = "FK_reviews_freelancer"))
    private FreelancerProfile freelancer;

    @JdbcTypeCode(SqlTypes.TINYINT)
    @Column(name = "overall_rating", nullable = false, columnDefinition = "tinyint")
    private Short overallRating;

    @JdbcTypeCode(SqlTypes.TINYINT)
    @Column(name = "quality_rating", nullable = false, columnDefinition = "tinyint")
    private Short qualityRating;

    @JdbcTypeCode(SqlTypes.TINYINT)
    @Column(name = "communication_rating", nullable = false, columnDefinition = "tinyint")
    private Short communicationRating;

    @JdbcTypeCode(SqlTypes.TINYINT)
    @Column(name = "timeliness_rating", nullable = false, columnDefinition = "tinyint")
    private Short timelinessRating;

    @Nationalized
    @Column(name = "comment", nullable = true, length = 2000, columnDefinition = "nvarchar(2000)")
    private String comment;

    @JdbcTypeCode(SqlTypes.TIMESTAMP)
    @Column(name = "created_at", nullable = false, columnDefinition = "datetime2(3)")
    private Instant createdAt;

    public Review() {}

    public Long getId() {
        return id;
    }

    public FinalAcceptance getFinalAcceptance() {
        return finalAcceptance;
    }

    public void setFinalAcceptance(FinalAcceptance finalAcceptance) {
        this.finalAcceptance = finalAcceptance;
    }

    public User getReviewer() {
        return reviewer;
    }

    public void setReviewer(User reviewer) {
        this.reviewer = reviewer;
    }

    public FreelancerProfile getFreelancer() {
        return freelancer;
    }

    public void setFreelancer(FreelancerProfile freelancer) {
        this.freelancer = freelancer;
    }

    public Short getOverallRating() {
        return overallRating;
    }

    public void setOverallRating(Short overallRating) {
        this.overallRating = overallRating;
    }

    public Short getQualityRating() {
        return qualityRating;
    }

    public void setQualityRating(Short qualityRating) {
        this.qualityRating = qualityRating;
    }

    public Short getCommunicationRating() {
        return communicationRating;
    }

    public void setCommunicationRating(Short communicationRating) {
        this.communicationRating = communicationRating;
    }

    public Short getTimelinessRating() {
        return timelinessRating;
    }

    public void setTimelinessRating(Short timelinessRating) {
        this.timelinessRating = timelinessRating;
    }

    public String getComment() {
        return comment;
    }

    public void setComment(String comment) {
        this.comment = comment;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}
