package com.linkit.identity.entity;

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
@Table(name = "freelancer_profiles", schema = "dbo")
public class FreelancerProfile {
    public enum AvailabilityStatus {
        AVAILABLE,
        BUSY,
        UNAVAILABLE
    }

    @Id
    @Column(name = "user_id", nullable = false, columnDefinition = "bigint")
    private Long userId;

    @Nationalized
    @Column(name = "headline", nullable = true, length = 200, columnDefinition = "nvarchar(200)")
    private String headline;

    @Nationalized
    @Column(
            name = "bio",
            nullable = true,
            length = Integer.MAX_VALUE,
            columnDefinition = "nvarchar(max)")
    private String bio;

    @Column(name = "years_experience", nullable = false, columnDefinition = "smallint")
    private Short yearsExperience;

    @Column(
            name = "hourly_rate",
            nullable = true,
            precision = 19,
            scale = 2,
            columnDefinition = "decimal(19,2)")
    private BigDecimal hourlyRate;

    @Nationalized
    @Column(name = "location", nullable = true, length = 200, columnDefinition = "nvarchar(200)")
    private String location;

    @Enumerated(EnumType.STRING)
    @Column(
            name = "availability_status",
            nullable = false,
            length = 20,
            columnDefinition = "varchar(20)")
    private AvailabilityStatus availabilityStatus;

    @Nationalized
    @Column(
            name = "portfolio_url",
            nullable = true,
            length = 1000,
            columnDefinition = "nvarchar(1000)")
    private String portfolioUrl;

    @Column(name = "is_public", nullable = false, columnDefinition = "bit")
    private Boolean isPublic = false;

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

    @MapsId
    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @OneToMany(mappedBy = "freelancer", fetch = FetchType.LAZY)
    private Set<FreelancerSkill> skills = new HashSet<>();

    public FreelancerProfile() {}

    public Long getUserId() {
        return userId;
    }

    public String getHeadline() {
        return headline;
    }

    public void setHeadline(String headline) {
        this.headline = headline;
    }

    public String getBio() {
        return bio;
    }

    public void setBio(String bio) {
        this.bio = bio;
    }

    public Short getYearsExperience() {
        return yearsExperience;
    }

    public void setYearsExperience(Short yearsExperience) {
        this.yearsExperience = yearsExperience;
    }

    public BigDecimal getHourlyRate() {
        return hourlyRate;
    }

    public void setHourlyRate(BigDecimal hourlyRate) {
        this.hourlyRate = hourlyRate;
    }

    public String getLocation() {
        return location;
    }

    public void setLocation(String location) {
        this.location = location;
    }

    public AvailabilityStatus getAvailabilityStatus() {
        return availabilityStatus;
    }

    public void setAvailabilityStatus(AvailabilityStatus availabilityStatus) {
        this.availabilityStatus = availabilityStatus;
    }

    public String getPortfolioUrl() {
        return portfolioUrl;
    }

    public Boolean getIsPublic() {
        return isPublic;
    }

    public void setIsPublic(Boolean isPublic) {
        this.isPublic = isPublic;
    }

    public void setPortfolioUrl(String portfolioUrl) {
        this.portfolioUrl = portfolioUrl;
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

    public User getUser() {
        return user;
    }

    public void setUser(User user) {
        this.user = user;
    }

    public Set<FreelancerSkill> getSkills() {
        return skills;
    }
}
