package com.linkit.identity.entity;

import jakarta.persistence.*;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.Nationalized;
import org.hibernate.type.SqlTypes;

import java.time.*;

@Entity
@Table(name = "work_experiences", schema = "dbo")
public class WorkExperience {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false, columnDefinition = "bigint")
    private Long id;

    @Column(name = "freelancer_id", nullable = false, columnDefinition = "bigint")
    private Long freelancerId;

    @Nationalized
    @Column(
            name = "company_name",
            nullable = false,
            columnDefinition = "nvarchar(200)",
            length = 200)
    private String companyName;

    @Nationalized
    @Column(name = "position", nullable = false, columnDefinition = "nvarchar(200)", length = 200)
    private String position;

    @Column(name = "start_date", nullable = false, columnDefinition = "date")
    private LocalDate startDate;

    @Column(name = "end_date", nullable = true, columnDefinition = "date")
    private LocalDate endDate;

    @Column(name = "is_current", nullable = false, columnDefinition = "bit")
    private Boolean isCurrent;

    @Nationalized
    @Column(
            name = "description",
            nullable = false,
            columnDefinition = "nvarchar(max)",
            length = 2147483647)
    private String description;

    @Nationalized
    @Column(
            name = "achievements",
            nullable = false,
            columnDefinition = "nvarchar(max)",
            length = 2147483647)
    private String achievements;

    @JdbcTypeCode(SqlTypes.TIMESTAMP)
    @Column(name = "created_at", nullable = false, columnDefinition = "datetime2(3)")
    private Instant createdAt;

    @JdbcTypeCode(SqlTypes.TIMESTAMP)
    @Column(name = "updated_at", nullable = false, columnDefinition = "datetime2(3)")
    private Instant updatedAt;

    @Version
    @Column(name = "version", nullable = false, columnDefinition = "bigint")
    private Long version;

    public WorkExperience() {}

    public Long getId() {
        return id;
    }

    public Long getFreelancerId() {
        return freelancerId;
    }

    public void setFreelancerId(Long value) {
        freelancerId = value;
    }

    public String getCompanyName() {
        return companyName;
    }

    public void setCompanyName(String value) {
        companyName = value;
    }

    public String getPosition() {
        return position;
    }

    public void setPosition(String value) {
        position = value;
    }

    public LocalDate getStartDate() {
        return startDate;
    }

    public void setStartDate(LocalDate value) {
        startDate = value;
    }

    public LocalDate getEndDate() {
        return endDate;
    }

    public void setEndDate(LocalDate value) {
        endDate = value;
    }

    public Boolean getIsCurrent() {
        return isCurrent;
    }

    public void setIsCurrent(Boolean value) {
        isCurrent = value;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String value) {
        description = value;
    }

    public String getAchievements() {
        return achievements;
    }

    public void setAchievements(String value) {
        achievements = value;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant value) {
        createdAt = value;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant value) {
        updatedAt = value;
    }

    public Long getVersion() {
        return version;
    }
}
