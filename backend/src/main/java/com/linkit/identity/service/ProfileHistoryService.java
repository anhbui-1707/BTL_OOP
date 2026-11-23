package com.linkit.identity.service;

import com.linkit.common.ApiException;
import com.linkit.identity.dto.ProfileHistoryDtos.*;
import com.linkit.identity.entity.*;
import com.linkit.identity.repository.*;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;

@Service
public class ProfileHistoryService {
    private static final int MAX_CV_BYTES = 2 * 1024 * 1024;
    private final FreelancerProfileRepository profiles;
    private final FreelancerCvRepository cvs;
    private final WorkExperienceRepository experiences;
    private final PortfolioProjectRepository portfolios;
    private final FreelancerSkillService skills;
    private final com.linkit.reviews.repository.ReviewRepository reviews;
    private final com.linkit.projects.repository.AssignmentRepository assignments;
    private final com.linkit.proposals.repository.ProposalRepository proposals;

    public ProfileHistoryService(
            FreelancerProfileRepository profiles,
            FreelancerCvRepository cvs,
            WorkExperienceRepository experiences,
            PortfolioProjectRepository portfolios,
            FreelancerSkillService skills,
            com.linkit.reviews.repository.ReviewRepository reviews,
            com.linkit.projects.repository.AssignmentRepository assignments,
            com.linkit.proposals.repository.ProposalRepository proposals) {
        this.profiles = profiles;
        this.cvs = cvs;
        this.experiences = experiences;
        this.portfolios = portfolios;
        this.skills = skills;
        this.reviews = reviews;
        this.assignments = assignments;
        this.proposals = proposals;
    }

    @Transactional(readOnly = true)
    public Snapshot snapshot(Long owner) {
        FreelancerProfile profile = profile(owner);
        User user = profile.getUser();
        var received =
                reviews.findByFreelancer_UserIdOrderByCreatedAtDescIdDesc(owner).stream()
                        .map(
                                review -> {
                                    var assignment = review.getFinalAcceptance().getAssignment();
                                    return new ReceivedReview(
                                            review.getId(),
                                            assignment.getId(),
                                            review.getReviewer().getId(),
                                            owner,
                                            review.getOverallRating(),
                                            review.getComment(),
                                            review.getCreatedAt(),
                                            assignment.getJob().getTitle(),
                                            assignment.getClient().getCompanyName());
                                })
                        .toList();
        var average =
                received.isEmpty()
                        ? java.math.BigDecimal.ZERO
                        : java.math.BigDecimal.valueOf(
                                        received.stream().mapToInt(ReceivedReview::rating).sum())
                                .divide(
                                        java.math.BigDecimal.valueOf(received.size()),
                                        2,
                                        java.math.RoundingMode.HALF_UP);
        return new Snapshot(
                owner,
                user.getFullName(),
                profile.getHeadline(),
                user.getEmail(),
                user.getPhoneNumber(),
                profile.getBio(),
                user.getAvatarUrl(),
                skills.list(owner),
                listWork(owner),
                listPortfolios(owner),
                listCvs(owner),
                received,
                average,
                received.size(),
                assignments.countByFreelancer_UserIdAndStatus(
                        owner, com.linkit.projects.entity.Assignment.Status.COMPLETED));
    }

    @Transactional
    public Snapshot updateProfile(Long owner, ProfileInput input) {
        FreelancerProfile profile = profile(owner);
        User user = profile.getUser();
        user.setFullName(input.fullName().strip());
        if (input.phoneNumber() != null) user.setPhoneNumber(input.phoneNumber().strip());
        user.setUpdatedAt(Instant.now());
        if (input.title() != null) profile.setHeadline(input.title().strip());
        if (input.bio() != null) profile.setBio(input.bio().strip());
        profile.setUpdatedAt(Instant.now());

        profiles.saveAndFlush(profile);
        return snapshot(owner);
    }

    @Transactional(readOnly = true)
    public List<CvView> listCvs(Long owner) {
        return cvs.findByFreelancerIdOrderByUploadedAtDescIdDesc(owner).stream()
                .map(
                        cv ->
                                new CvView(
                                        cv.getId(),
                                        cv.getFileName(),
                                        "/api/cvs/" + cv.getId() + "/download",
                                        cv.getByteSize(),
                                        cv.getUploadedAt()))
                .toList();
    }

    @Transactional
    public CvView upload(Long owner, MultipartFile file) {
        profile(owner);
        String original = file.getOriginalFilename();
        String name = original == null ? "" : original.replace('\\', '/');
        name = name.substring(name.lastIndexOf('/') + 1).strip();
        if (name.isBlank()
                || name.length() > 255
                || name.codePoints().anyMatch(Character::isISOControl)
                || !name.toLowerCase(Locale.ROOT).endsWith(".pdf")
                || file.isEmpty()
                || file.getSize() > MAX_CV_BYTES) throw invalidCv();
        byte[] content;

        try (var stream = file.getInputStream()) {
            content = stream.readNBytes(MAX_CV_BYTES + 1);
        } catch (IOException error) {
            throw invalidCv();
        }
        if (content.length < 8
                || content.length > MAX_CV_BYTES
                || !new String(content, 0, 5, StandardCharsets.US_ASCII).equals("%PDF-"))
            throw invalidCv();
        String tail =
                new String(
                        content,
                        Math.max(0, content.length - 1024),
                        Math.min(1024, content.length),
                        StandardCharsets.ISO_8859_1);
        if (!tail.stripTrailing().endsWith("%%EOF")) throw invalidCv();
        FreelancerCv cv = new FreelancerCv();
        cv.setFreelancerId(owner);
        cv.setFileName(name);
        cv.setByteSize(content.length);
        cv.setContent(content);
        cv.setUploadedAt(Instant.now());
        cvs.saveAndFlush(cv);
        return new CvView(
                cv.getId(),
                cv.getFileName(),
                "/api/cvs/" + cv.getId() + "/download",
                cv.getByteSize(),
                cv.getUploadedAt());
    }

    @Transactional(readOnly = true)
    public CvDownload download(Long owner, Long id) {
        FreelancerCv cv =
                cvs.findByIdAndFreelancerId(id, owner).orElseThrow(ProfileHistoryService::missing);
        return new CvDownload(cv.getFileName(), cv.getContent());
    }

    @Transactional
    public void deleteCv(Long owner, Long id) {
        FreelancerCv cv =
                cvs.findOwnedForUpdate(id, owner).orElseThrow(ProfileHistoryService::missing);
        if (proposals.existsByCvId(id))
            throw new ApiException(
                    HttpStatus.CONFLICT,
                    "CV_IN_USE",
                    "Không thể xóa CV đã gắn với Proposal; tài liệu cần được giữ lại. Bạn có thể tải CV mới lên hồ sơ; CV của Proposal cũ không thay đổi.");
        cvs.delete(cv);
        cvs.flush();
    }

    @Transactional(readOnly = true)
    public List<WorkView> listWork(Long owner) {
        return experiences.findByFreelancerIdOrderByStartDateDescIdDesc(owner).stream()
                .map(ProfileHistoryService::workView)
                .toList();
    }

    @Transactional
    public WorkView saveWork(Long owner, Long id, WorkInput input) {
        WorkExperience entry;
        if (id == null) {
            profile(owner);
            entry = new WorkExperience();
            entry.setFreelancerId(owner);
            entry.setCreatedAt(Instant.now());
        } else {
            entry =
                    experiences
                            .findByIdAndFreelancerId(id, owner)
                            .orElseThrow(ProfileHistoryService::missing);
            checkVersion(entry.getVersion(), input.version());
        }
        entry.setCompanyName(input.companyName().strip());
        entry.setPosition(input.position().strip());
        entry.setStartDate(input.startDate());
        entry.setEndDate(input.endDate());
        entry.setIsCurrent(input.isCurrent());
        entry.setDescription(input.description().strip());
        entry.setAchievements(input.achievements().strip());
        entry.setUpdatedAt(Instant.now());
        return workView(experiences.saveAndFlush(entry));
    }

    @Transactional
    public void deleteWork(Long owner, Long id, Long version) {
        WorkExperience entry =
                experiences
                        .findByIdAndFreelancerId(id, owner)
                        .orElseThrow(ProfileHistoryService::missing);
        checkVersion(entry.getVersion(), version);
        experiences.delete(entry);
        experiences.flush();
    }

    @Transactional(readOnly = true)
    public List<PortfolioView> listPortfolios(Long owner) {
        return portfolios.findByFreelancerIdOrderByCreatedAtDescIdDesc(owner).stream()
                .map(ProfileHistoryService::portfolioView)
                .toList();
    }

    @Transactional
    public PortfolioView savePortfolio(Long owner, Long id, PortfolioInput input) {
        PortfolioProject entry;
        if (id == null) {
            profile(owner);
            entry = new PortfolioProject();
            entry.setFreelancerId(owner);
            entry.setCreatedAt(Instant.now());
        } else {
            entry =
                    portfolios
                            .findByIdAndFreelancerId(id, owner)
                            .orElseThrow(ProfileHistoryService::missing);
            checkVersion(entry.getVersion(), input.version());
        }
        entry.setTitle(input.title().strip());
        entry.setDescription(input.description().strip());
        entry.setRole(input.role().strip());
        entry.setTechnologies(input.technologies().strip());
        entry.setProjectUrl(optional(input.projectUrl()));
        entry.setGithubUrl(optional(input.githubUrl()));
        entry.setStartDate(input.startDate());
        entry.setEndDate(input.endDate());
        entry.setUpdatedAt(Instant.now());
        return portfolioView(portfolios.saveAndFlush(entry));
    }

    @Transactional
    public void deletePortfolio(Long owner, Long id, Long version) {
        PortfolioProject entry =
                portfolios
                        .findByIdAndFreelancerId(id, owner)
                        .orElseThrow(ProfileHistoryService::missing);
        checkVersion(entry.getVersion(), version);
        portfolios.delete(entry);
        portfolios.flush();
    }

    private FreelancerProfile profile(Long owner) {
        return profiles.findById(owner).orElseThrow(ProfileHistoryService::missing);
    }

    private static String optional(String value) {
        return value == null || value.isBlank() ? null : value.strip();
    }

    private static void checkVersion(Long actual, Long expected) {
        if (expected == null)
            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "VERSION_REQUIRED",
                    "Thiếu phiên bản dữ liệu. Vui lòng tải lại hồ sơ.");
        if (!Objects.equals(actual, expected))
            throw new ApiException(
                    HttpStatus.CONFLICT,
                    "CONCURRENT_CHANGE",
                    "Dữ liệu đã thay đổi. Vui lòng tải lại trước khi sửa hoặc xóa.");
    }

    private static ApiException missing() {
        return new ApiException(
                HttpStatus.NOT_FOUND,
                "PROFILE_RECORD_NOT_FOUND",
                "Không tìm thấy dữ liệu trong hồ sơ của bạn.");
    }

    private static ApiException invalidCv() {
        return new ApiException(
                HttpStatus.UNPROCESSABLE_ENTITY,
                "INVALID_CV",
                "Vui lòng chọn tệp PDF hợp lệ, tối đa 2 MB, tên tệp tối đa 255 ký tự.");
    }

    private static WorkView workView(WorkExperience entry) {
        return new WorkView(
                entry.getId(),
                entry.getCompanyName(),
                entry.getPosition(),
                entry.getStartDate(),
                entry.getEndDate(),
                entry.getIsCurrent(),
                entry.getDescription(),
                entry.getAchievements(),
                entry.getCreatedAt(),
                entry.getUpdatedAt(),
                entry.getVersion());
    }

    private static PortfolioView portfolioView(PortfolioProject entry) {
        return new PortfolioView(
                entry.getId(),
                entry.getTitle(),
                entry.getDescription(),
                entry.getRole(),
                entry.getTechnologies(),
                entry.getProjectUrl(),
                entry.getGithubUrl(),
                entry.getStartDate(),
                entry.getEndDate(),
                entry.getCreatedAt(),
                entry.getUpdatedAt(),
                entry.getVersion());
    }
}
