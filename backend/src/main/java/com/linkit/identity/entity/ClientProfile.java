package com.linkit.identity.entity;

import jakarta.persistence.*;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.Nationalized;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.*;

@Entity
@Table(name = "client_profiles", schema = "dbo")
public class ClientProfile {

    @Id
    @Column(name = "user_id", nullable = false, columnDefinition = "bigint")
    private Long userId;

    @Nationalized
    @Column(
            name = "company_name",
            nullable = true,
            length = 200,
            columnDefinition = "nvarchar(200)")
    private String companyName;

    @Nationalized
    @Column(
            name = "company_website",
            nullable = true,
            length = 1000,
            columnDefinition = "nvarchar(1000)")
    private String companyWebsite;

    @Nationalized
    @Column(name = "industry", nullable = true, length = 100, columnDefinition = "nvarchar(100)")
    private String industry;

    @Nationalized
    @Column(
            name = "description",
            nullable = true,
            length = Integer.MAX_VALUE,
            columnDefinition = "nvarchar(max)")
    private String description;

    @Nationalized
    @Column(name = "location", nullable = true, length = 200, columnDefinition = "nvarchar(200)")
    private String location;

    @Nationalized
    @Column(
            name = "public_contact_phone",
            nullable = true,
            length = 20,
            columnDefinition = "nvarchar(20)")
    private String publicContactPhone;

    @Column(name = "public_contact_email", length = 254, columnDefinition = "varchar(254)")
    private String publicContactEmail;

    @JdbcTypeCode(SqlTypes.TIMESTAMP)
    @Column(name = "updated_at", nullable = false, columnDefinition = "datetime2(3)")
    private Instant updatedAt;

    @MapsId
    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    public ClientProfile() {}

    @Nationalized
    @Column(name = "job_title", length = 200, columnDefinition = "nvarchar(200)")
    private String jobTitle;

    public String getJobTitle() {
        return jobTitle;
    }

    public void setJobTitle(String jobTitle) {
        this.jobTitle = jobTitle;
    }

    public Long getUserId() {
        return userId;
    }

    public String getCompanyName() {
        return companyName;
    }

    public void setCompanyName(String companyName) {
        this.companyName = companyName;
    }

    public String getCompanyWebsite() {
        return companyWebsite;
    }

    public void setCompanyWebsite(String companyWebsite) {
        this.companyWebsite = companyWebsite;
    }

    public String getIndustry() {
        return industry;
    }

    public void setIndustry(String industry) {
        this.industry = industry;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getPublicContactEmail() {
        return publicContactEmail;
    }

    public void setPublicContactEmail(String value) {
        publicContactEmail = value;
    }

    public String getPublicContactPhone() {
        return publicContactPhone;
    }

    public void setPublicContactPhone(String value) {
        publicContactPhone = value;
    }

    public String getLocation() {
        return location;
    }

    public void setLocation(String location) {
        this.location = location;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }

    public User getUser() {
        return user;
    }

    public void setUser(User user) {
        this.user = user;
    }
}
