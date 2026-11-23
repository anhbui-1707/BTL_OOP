package com.linkit.identity.controller;

import com.linkit.common.ApiException;
import com.linkit.identity.entity.*;
import com.linkit.identity.repository.*;
import com.linkit.jobs.dto.JobDtos.PageResponse;
import com.linkit.projects.entity.Assignment;
import com.linkit.projects.repository.AssignmentRepository;
import com.linkit.reviews.repository.ReviewRepository;

import jakarta.validation.constraints.*;

import org.springframework.data.domain.*;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.stream.Collectors;

@RestController
public class PublicFreelancerController {
    public record PublicWorkExperience(
            Long id,
            String companyName,
            String position,
            java.time.LocalDate startDate,
            java.time.LocalDate endDate,
            Boolean isCurrent,
            String description,
            String achievements) {}

    public record PublicPortfolio(
            Long id,
            String title,
            String description,
            String role,
            String technologies,
            String projectUrl,
            String githubUrl,
            java.time.LocalDate startDate,
            java.time.LocalDate endDate) {}

    public record PublicProfile(
            Long id,
            String displayName,
            String avatarUrl,
            String headline,
            String bio,
            short yearsExperience,
            Double averageRating,
            long reviewCount,
            long completedJobs,
            List<String> skills,
            List<PublicWorkExperience> workExperiences,
            List<PublicPortfolio> portfolioProjects) {}

    private final FreelancerProfileRepository profiles;
    private final FreelancerSkillRepository skills;
    private final WorkExperienceRepository workExperiences;
    private final PortfolioProjectRepository portfolioProjects;
    private final ReviewRepository reviews;
    private final AssignmentRepository assignments;

    public PublicFreelancerController(
            FreelancerProfileRepository profiles,
            FreelancerSkillRepository skills,
            WorkExperienceRepository workExperiences,
            PortfolioProjectRepository portfolioProjects,
            ReviewRepository reviews,
            AssignmentRepository assignments) {
        this.profiles = profiles;
        this.skills = skills;
        this.workExperiences = workExperiences;
        this.portfolioProjects = portfolioProjects;
        this.reviews = reviews;
        this.assignments = assignments;
    }

    @GetMapping("/api/public/freelancers")
    @Transactional(readOnly = true)
    public PageResponse<PublicProfile> list(
            @RequestParam(required = false) @Size(max = 100) String q,
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "10") @Min(1) @Max(100) int size) {
        Page<FreelancerProfile> found =
                profiles.findPublic(
                        q == null || q.isBlank() ? null : q.strip(),
                        PageRequest.of(page, size, Sort.by("userId")));

        var ids = found.stream().map(FreelancerProfile::getUserId).toList();

        Map<Long, List<String>> byUser =
                skills.findById_FreelancerIdIn(ids).stream()
                        .collect(
                                Collectors.groupingBy(
                                        s -> s.getId().getFreelancerId(),
                                        Collectors.mapping(
                                                s -> s.getSkill().getName(), Collectors.toList())));

        Map<Long, ReviewRepository.FreelancerRating> ratings =
                ids.isEmpty()
                        ? Map.of()
                        : reviews.ratingsForFreelancers(ids).stream()
                                .collect(
                                        Collectors.toMap(
                                                ReviewRepository.FreelancerRating::getFreelancerId,
                                                r -> r));

        return new PageResponse<>(
                found.stream()
                        .map(
                                f ->
                                        dto(
                                                f,
                                                byUser.getOrDefault(f.getUserId(), List.of()),
                                                ratings.get(f.getUserId()),
                                                List.of(),
                                                List.of()))
                        .toList(),
                found.getNumber(),
                found.getSize(),
                found.getTotalElements(),
                found.getTotalPages());
    }

    @GetMapping("/api/public/freelancers/{id}")
    @Transactional(readOnly = true)
    public PublicProfile detail(@PathVariable @Positive Long id) {
        FreelancerProfile f =
                profiles.findById(id).orElseThrow(PublicFreelancerController::missing);

        if (f.getUser().getStatus() != User.Status.ACTIVE) {
            throw missing();
        }

        return dto(
                f,
                skills.findById_FreelancerIdIn(List.of(id)).stream()
                        .map(s -> s.getSkill().getName())
                        .toList(),
                reviews.ratingsForFreelancers(List.of(id)).stream().findFirst().orElse(null),
                workExperiences.findByFreelancerIdOrderByStartDateDescIdDesc(id).stream()
                        .map(
                                w ->
                                        new PublicWorkExperience(
                                                w.getId(),
                                                w.getCompanyName(),
                                                w.getPosition(),
                                                w.getStartDate(),
                                                w.getEndDate(),
                                                w.getIsCurrent(),
                                                w.getDescription(),
                                                w.getAchievements()))
                        .toList(),
                portfolioProjects.findByFreelancerIdOrderByCreatedAtDescIdDesc(id).stream()
                        .map(
                                p ->
                                        new PublicPortfolio(
                                                p.getId(),
                                                p.getTitle(),
                                                p.getDescription(),
                                                p.getRole(),
                                                p.getTechnologies(),
                                                p.getProjectUrl(),
                                                p.getGithubUrl(),
                                                p.getStartDate(),
                                                p.getEndDate()))
                        .toList());
    }

    private PublicProfile dto(
            FreelancerProfile f,
            List<String> skills,
            ReviewRepository.FreelancerRating rating,
            List<PublicWorkExperience> work,
            List<PublicPortfolio> portfolio) {
        String bio = f.getBio();

        if (bio != null && bio.length() > 300) {
            bio = bio.substring(0, 300);
        }

        return new PublicProfile(
                f.getUserId(),
                f.getUser().getFullName(),
                f.getUser().getAvatarUrl(),
                f.getHeadline(),
                bio,
                f.getYearsExperience(),
                rating == null ? null : rating.getAverageRating(),
                rating == null ? 0 : rating.getReviewCount(),
                assignments.countByFreelancer_UserIdAndStatus(
                        f.getUserId(), Assignment.Status.COMPLETED),
                skills,
                work,
                portfolio);
    }

    private static ApiException missing() {
        return new ApiException(
                HttpStatus.NOT_FOUND, "FREELANCER_NOT_FOUND", "Không tìm thấy hồ sơ công khai.");
    }
}
