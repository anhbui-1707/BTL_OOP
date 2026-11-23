package com.linkit.identity.entity;

import jakarta.persistence.*;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.Nationalized;
import org.hibernate.type.SqlTypes;

import java.time.*;

@Entity
@Table(name = "portfolio_projects", schema = "dbo")
public class PortfolioProject {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false, columnDefinition = "bigint")
    private Long id;

    @Column(name = "freelancer_id", nullable = false, columnDefinition = "bigint")
    private Long freelancerId;

    @Nationalized
    @Column(name = "title", nullable = false, columnDefinition = "nvarchar(200)", length = 200)
    private String title;

    @Nationalized
    @Column(
            name = "description",
            nullable = false,
            columnDefinition = "nvarchar(max)",
            length = 2147483647)
    private String description;

    @Nationalized
    @Column(
            name = "project_role",
            nullable = false,
            columnDefinition = "nvarchar(200)",
            length = 200)
    private String role;

    @Nationalized
    @Column(
            name = "technologies",
            nullable = false,
            columnDefinition = "nvarchar(500)",
            length = 500)
    private String technologies;

    @Nationalized
    @Column(
            name = "project_url",
            nullable = true,
            columnDefinition = "nvarchar(1000)",
            length = 1000)
    private String projectUrl;

    @Nationalized
    @Column(
            name = "github_url",
            nullable = true,
            columnDefinition = "nvarchar(1000)",
            length = 1000)
    private String githubUrl;

    @Column(name = "start_date", nullable = true, columnDefinition = "date")
    private LocalDate startDate;

    @Column(name = "end_date", nullable = true, columnDefinition = "date")
    private LocalDate endDate;

    @JdbcTypeCode(SqlTypes.TIMESTAMP)
    @Column(name = "created_at", nullable = false, columnDefinition = "datetime2(3)")
    private Instant createdAt;

    @JdbcTypeCode(SqlTypes.TIMESTAMP)
    @Column(name = "updated_at", nullable = false, columnDefinition = "datetime2(3)")
    private Instant updatedAt;

    @Version
    @Column(name = "version", nullable = false, columnDefinition = "bigint")
    private Long version;

    public PortfolioProject() {}

    public Long getId() {
        return id;
    }

    public Long getFreelancerId() {
        return freelancerId;
    }

    public void setFreelancerId(Long value) {
        freelancerId = value;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String value) {
        title = value;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String value) {
        description = value;
    }

    public String getRole() {
        return role;
    }

    public void setRole(String value) {
        role = value;
    }

    public String getTechnologies() {
        return technologies;
    }

    public void setTechnologies(String value) {
        technologies = value;
    }

    public String getProjectUrl() {
        return projectUrl;
    }

    public void setProjectUrl(String value) {
        projectUrl = value;
    }

    public String getGithubUrl() {
        return githubUrl;
    }

    public void setGithubUrl(String value) {
        githubUrl = value;
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
