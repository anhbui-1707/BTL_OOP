package com.linkit.identity.dto;

import jakarta.validation.constraints.*;

import java.net.URI;
import java.time.*;
import java.util.List;

public final class ProfileHistoryDtos {
    private ProfileHistoryDtos() {}

    public record ProfileInput(
            @NotBlank @Size(max = 150) String fullName,
            @Size(max = 200) String title,
            @Size(max = 500) String bio,
            @Size(max = 20) String phoneNumber) {
        @Override
        public String toString() {
            return "ProfileInput[redacted]";
        }
    }

    public record WorkInput(
            @NotBlank @Size(max = 200) String companyName,
            @NotBlank @Size(max = 200) String position,
            @NotNull LocalDate startDate,
            LocalDate endDate,
            @NotNull Boolean isCurrent,
            @NotBlank @Size(max = 10000) String description,
            @NotNull @Size(max = 10000) String achievements,
            @PositiveOrZero Long version) {
        @AssertTrue(message = "Ngày làm việc không hợp lệ hoặc thiếu ngày kết thúc.")
        public boolean isDateRangeValid() {
            if (startDate == null || isCurrent == null) return true;
            return validDate(startDate)
                    && !startDate.isAfter(LocalDate.now(ZoneOffset.UTC))
                    && (isCurrent
                            ? endDate == null
                            : endDate != null
                                    && validDate(endDate)
                                    && !endDate.isBefore(startDate)
                                    && !endDate.isAfter(LocalDate.now(ZoneOffset.UTC)));
        }

        @Override
        public String toString() {
            return "WorkInput[redacted]";
        }
    }

    public record PortfolioInput(
            @NotBlank @Size(max = 200) String title,
            @NotBlank @Size(max = 10000) String description,
            @NotBlank @Size(max = 200) String role,
            @NotBlank @Size(max = 500) String technologies,
            @Size(max = 1000) String projectUrl,
            @Size(max = 1000) String githubUrl,
            LocalDate startDate,
            LocalDate endDate,
            @PositiveOrZero Long version) {
        @AssertTrue(
                message = "Liên kết phải là URL HTTP(S) hợp lệ, không chứa thông tin đăng nhập.")
        public boolean isLinksValid() {
            return validUrl(projectUrl) && validUrl(githubUrl);
        }

        @AssertTrue(message = "Ngày dự án không hợp lệ.")
        public boolean isDateRangeValid() {
            return (startDate == null || validDate(startDate))
                    && (endDate == null
                            || validDate(endDate)
                                    && startDate != null
                                    && !endDate.isBefore(startDate));
        }

        @Override
        public String toString() {
            return "PortfolioInput[redacted]";
        }
    }

    public record WorkView(
            Long id,
            String companyName,
            String position,
            LocalDate startDate,
            LocalDate endDate,
            boolean isCurrent,
            String description,
            String achievements,
            Instant createdAt,
            Instant updatedAt,
            Long version) {}

    public record PortfolioView(
            Long id,
            String title,
            String description,
            String role,
            String technologies,
            String projectUrl,
            String githubUrl,
            LocalDate startDate,
            LocalDate endDate,
            Instant createdAt,
            Instant updatedAt,
            Long version) {}

    public record CvView(
            Long id, String fileName, String fileUrl, int byteSize, Instant uploadedAt) {}

    public record ReceivedReview(
            Long id,
            Long assignmentId,
            Long reviewerId,
            Long freelancerId,
            int rating,
            String comment,
            Instant createdAt,
            String jobTitle,
            String companyName) {}

    public record CvDownload(String fileName, byte[] content) {
        @Override
        public String toString() {
            return "CvDownload[redacted]";
        }
    }

    public record Snapshot(
            Long id,
            String fullName,
            String title,
            String email,
            String phoneNumber,
            String bio,
            String avatarUrl,
            List<FreelancerSkillDtos.View> skills,
            List<WorkView> workExperiences,
            List<PortfolioView> portfolioProjects,
            List<CvView> cvs,
            List<ReceivedReview> reviews,
            java.math.BigDecimal averageRating,
            int totalReviews,
            long completedJobs) {}

    private static boolean validDate(LocalDate date) {
        return date.getYear() >= 1 && date.getYear() <= 9999;
    }

    private static boolean validUrl(String value) {
        if (value == null || value.isBlank()) return true;
        try {
            URI uri = URI.create(value.strip());
            return ("https".equalsIgnoreCase(uri.getScheme())
                            || "http".equalsIgnoreCase(uri.getScheme()))
                    && uri.getHost() != null
                    && uri.getRawUserInfo() == null
                    && uri.getPort() <= 65535;
        } catch (IllegalArgumentException ex) {
            return false;
        }
    }
}
