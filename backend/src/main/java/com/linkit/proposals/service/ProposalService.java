package com.linkit.proposals.service;

import com.linkit.audit.entity.AuditLog;
import com.linkit.audit.repository.AuditLogRepository;
import com.linkit.auth.security.AuthPrincipal;
import com.linkit.common.ApiException;
import com.linkit.identity.entity.UserRole.Role;
import com.linkit.identity.repository.FreelancerCvRepository;
import com.linkit.identity.repository.FreelancerProfileRepository;
import com.linkit.identity.repository.FreelancerSkillRepository;
import com.linkit.identity.repository.UserRepository;
import com.linkit.jobs.entity.Job;
import com.linkit.jobs.repository.JobRepository;
import com.linkit.proposals.dto.ProposalDtos.*;
import com.linkit.proposals.entity.Proposal;
import com.linkit.proposals.repository.ProposalRepository;
import com.linkit.reviews.repository.ReviewRepository;

import org.springframework.data.domain.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.*;

@Service
public class ProposalService {
    private final ProposalRepository proposals;
    private final JobRepository jobs;
    private final FreelancerProfileRepository freelancers;
    private final UserRepository users;
    private final AuditLogRepository audit;
    private final Clock clock;
    private final FreelancerCvRepository cvs;
    private final ReviewRepository reviews;
    private final FreelancerSkillRepository skills;

    public ProposalService(
            ProposalRepository proposals,
            JobRepository jobs,
            FreelancerProfileRepository freelancers,
            UserRepository users,
            AuditLogRepository audit,
            Clock clock,
            FreelancerCvRepository cvs,
            ReviewRepository reviews,
            FreelancerSkillRepository skills) {
        this.proposals = proposals;
        this.jobs = jobs;
        this.freelancers = freelancers;
        this.users = users;
        this.audit = audit;
        this.clock = clock;
        this.cvs = cvs;
        this.reviews = reviews;
        this.skills = skills;
    }

    @Transactional
    public Detail submit(AuthPrincipal actor, Long jobId, SubmitRequest request) {
        require(actor, Role.FREELANCER);
        Job job = jobs.findForUpdate(jobId).orElseThrow(ProposalService::missingJob);
        if (Objects.equals(job.getClientId(), actor.userId())) throw forbidden();
        open(job);
        if (job.getDeadline().isBefore(LocalDate.now(clock)))
            throw conflict("Job đã hết hạn nhận Proposal.");
        if (proposals.existsByJob_IdAndFreelancer_UserId(jobId, actor.userId()))
            throw conflict("Bạn đã gửi Proposal cho Job này.");
        var freelancer =
                freelancers.findById(actor.userId()).orElseThrow(ProposalService::forbidden);
        if (request.cvId() != null) {
            var cv =
                    cvs.findOwnedForUpdate(request.cvId(), actor.userId())
                            .orElseThrow(ProposalService::missingCv);

            if (!Objects.equals(cv.getFreelancerId(), actor.userId())) throw missingCv();
        }
        Instant now = now();
        Proposal value = new Proposal();
        value.setJob(job);
        value.setFreelancer(freelancer);
        value.setCvId(request.cvId());
        value.setCoverLetter(request.coverLetter());
        value.setProposedBudget(request.proposedBudget().setScale(2));
        value.setEstimatedDays(request.estimatedDays());
        value.setStatus(Proposal.Status.PENDING);
        value.setSubmittedAt(now);
        value.setUpdatedAt(now);
        proposals.saveAndFlush(value);
        record(actor, value, "PROPOSAL_SUBMITTED");
        return detail(value);
    }

    @Transactional(readOnly = true)
    public Detail get(AuthPrincipal actor, Long id) {
        return detail(readable(actor, id));
    }

    private Proposal readable(AuthPrincipal actor, Long id) {
        requireReader(actor);
        Proposal value = proposals.findDetailedById(id).orElseThrow(ProposalService::missing);
        if (!(actor.roles().contains(Role.FREELANCER)
                        && Objects.equals(value.getFreelancerId(), actor.userId()))
                && !(actor.roles().contains(Role.CLIENT)
                        && Objects.equals(value.getJob().getClientId(), actor.userId())))
            throw missing();
        return value;
    }

    @Transactional(readOnly = true)
    public CvDownload downloadCv(AuthPrincipal actor, Long id) {
        Proposal proposal = readable(actor, id);
        if (proposal.getCvId() == null) throw missingCv();
        var cv =
                cvs.findByIdAndFreelancerId(proposal.getCvId(), proposal.getFreelancerId())
                        .orElseThrow(ProposalService::missingCv);
        return new CvDownload(cv.getFileName(), cv.getContent());
    }

    @Transactional(readOnly = true)
    public PageResponse mine(AuthPrincipal actor, Proposal.Status status, int page, int size) {
        require(actor, Role.FREELANCER);
        Pageable paging = paging(page, size);
        return page(
                status == null
                        ? proposals.findByFreelancer_UserId(actor.userId(), paging)
                        : proposals.findByFreelancer_UserIdAndStatus(
                                actor.userId(), status, paging));
    }

    @Transactional(readOnly = true)
    public PageResponse forJob(
            AuthPrincipal actor, Long jobId, Proposal.Status status, int page, int size) {
        require(actor, Role.CLIENT);
        Job job = jobs.findDetailedById(jobId).orElseThrow(ProposalService::missingJob);
        if (!Objects.equals(job.getClientId(), actor.userId())) throw forbidden();

        List<Proposal> applicants =
                status == null
                        ? proposals.findAllByJob_Id(jobId)
                        : proposals.findAllByJob_IdAndStatus(jobId, status);
        Map<Long, ReviewRepository.FreelancerRating> ratings =
                ratings(applicants.stream().map(Proposal::getFreelancerId).toList());
        applicants.sort(
                Comparator.comparing(
                                (Proposal p) -> ratingValue(ratings, p.getFreelancerId()),
                                Comparator.nullsLast(Comparator.reverseOrder()))
                        .thenComparing(
                                (Proposal p) -> ratingCount(ratings, p.getFreelancerId()),
                                Comparator.reverseOrder())
                        .thenComparing(Proposal::getSubmittedAt, Comparator.reverseOrder())
                        .thenComparing(Proposal::getId, Comparator.reverseOrder()));
        int from = (int) Math.min((long) page * size, applicants.size()),
                to = Math.min(from + size, applicants.size());
        List<Summary> content =
                applicants.subList(from, to).stream()
                        .map(p -> summary(p, ratings.get(p.getFreelancerId())))
                        .toList();
        return new PageResponse(
                content, page, size, applicants.size(), (applicants.size() + size - 1) / size);
    }

    @Transactional
    public Detail reject(AuthPrincipal actor, Long id, String expected, StatusRequest request) {
        require(actor, Role.CLIENT);
        if (request.status() != Proposal.Status.REJECTED)
            throw invalid(
                    "API này chỉ cho phép REJECTED; ACCEPTED dành cho bước Selection/Assignment.");
        return transition(actor, id, expected, Proposal.Status.REJECTED);
    }

    @Transactional
    public Detail withdraw(AuthPrincipal actor, Long id, String expected) {
        require(actor, Role.FREELANCER);
        return transition(actor, id, expected, Proposal.Status.WITHDRAWN);
    }

    private Detail transition(
            AuthPrincipal actor, Long id, String expected, Proposal.Status target) {
        Long jobId = proposals.findJobIdById(id).orElseThrow(ProposalService::missing);

        Job job = jobs.findForUpdate(jobId).orElseThrow(ProposalService::missingJob);
        Proposal value = proposals.findDetailedById(id).orElseThrow(ProposalService::missing);
        Long owner =
                target == Proposal.Status.REJECTED ? job.getClientId() : value.getFreelancerId();
        if (!Objects.equals(owner, actor.userId())) throw forbidden();
        match(value, expected);
        open(job);
        if (value.getStatus() != Proposal.Status.PENDING || proposals.countAssignments(id) != 0)
            throw conflict("Chỉ Proposal PENDING chưa được gắn Assignment mới được từ chối/rút.");
        value.setStatus(target);
        Instant now = now();
        value.setUpdatedAt(
                now.isAfter(value.getUpdatedAt()) ? now : value.getUpdatedAt().plusMillis(1));

        proposals.flush();
        record(
                actor,
                value,
                target == Proposal.Status.REJECTED ? "PROPOSAL_REJECTED" : "PROPOSAL_WITHDRAWN");
        return detail(value);
    }

    private Detail detail(Proposal value) {
        var freelancer = value.getFreelancer();
        var job = value.getJob();
        var attachment =
                value.getCvId() == null
                        ? null
                        : cvs.findMetadataByIdAndFreelancerId(
                                        value.getCvId(), value.getFreelancerId())
                                .orElseThrow(ProposalService::missingCv);
        var rating = ratings(List.of(value.getFreelancerId())).get(value.getFreelancerId());
        List<String> skillNames =
                skills
                        .findWithSkillById_FreelancerIdOrderById_SkillId(value.getFreelancerId())
                        .stream()
                        .map(v -> v.getSkill().getName())
                        .toList();
        return new Detail(
                value.getId(),
                value.getJobId(),
                job.getTitle(),
                job.getStatus(),
                job.getClientId(),
                value.getFreelancerId(),
                freelancer.getUser().getFullName(),
                freelancer.getHeadline(),
                value.getCoverLetter(),
                value.getProposedBudget(),
                job.getCurrencyCode(),
                value.getEstimatedDays(),
                value.getStatus(),
                value.getSubmittedAt(),
                value.getUpdatedAt(),
                version(value),
                value.getCvId(),
                attachment == null ? null : attachment.getFileName(),
                attachment == null ? null : attachment.getByteSize(),
                rating == null ? null : rating.getAverageRating(),
                rating == null ? 0L : rating.getReviewCount(),
                freelancer.getBio(),
                freelancer.getYearsExperience(),
                skillNames,
                freelancer.getUser().getEmail(),
                freelancer.getUser().getPhoneNumber());
    }

    private PageResponse page(Page<Proposal> values) {
        List<Summary> content = values.stream().map(p -> summary(p, null)).toList();
        return new PageResponse(
                content,
                values.getNumber(),
                values.getSize(),
                values.getTotalElements(),
                values.getTotalPages());
    }

    private Summary summary(Proposal p, ReviewRepository.FreelancerRating rating) {
        return new Summary(
                p.getId(),
                p.getJobId(),
                p.getJob().getTitle(),
                p.getJob().getStatus(),
                p.getJob().getClientId(),
                p.getFreelancerId(),
                p.getFreelancer().getUser().getFullName(),
                p.getProposedBudget(),
                p.getEstimatedDays(),
                p.getStatus(),
                p.getSubmittedAt(),
                version(p),
                p.getCvId(),
                rating == null ? null : rating.getAverageRating(),
                rating == null ? 0L : rating.getReviewCount());
    }

    private Map<Long, ReviewRepository.FreelancerRating> ratings(Collection<Long> ids) {
        if (ids.isEmpty()) return Map.of();
        Map<Long, ReviewRepository.FreelancerRating> result = new HashMap<>();
        for (var row : reviews.ratingsForFreelancers(new HashSet<>(ids)))
            result.put(row.getFreelancerId(), row);
        return result;
    }

    private static Double ratingValue(
            Map<Long, ReviewRepository.FreelancerRating> ratings, Long freelancerId) {
        var value = ratings.get(freelancerId);
        return value == null ? null : value.getAverageRating();
    }

    private static long ratingCount(
            Map<Long, ReviewRepository.FreelancerRating> ratings, Long freelancerId) {
        var value = ratings.get(freelancerId);
        return value == null ? 0L : value.getReviewCount();
    }

    private Pageable paging(int page, int size) {
        return PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "submittedAt", "id"));
    }

    private void record(AuthPrincipal actor, Proposal value, String action) {
        AuditLog event = new AuditLog();
        event.setActor(users.getReferenceById(actor.userId()));
        event.setEntityType("proposals");
        event.setEntityId(value.getId());
        event.setAction(action);
        event.setBeforeJson(
                action.equals("PROPOSAL_SUBMITTED") ? null : "{\"status\":\"PENDING\"}");
        event.setAfterJson("{\"status\":\"" + value.getStatus().name() + "\"}");
        event.setCreatedAt(now());
        event.setRequestId(UUID.randomUUID());
        audit.saveAndFlush(event);
    }

    private static String version(Proposal value) {
        return Base64.getEncoder().encodeToString(value.getRowVer());
    }

    private void match(Proposal value, String expected) {
        if (expected == null)
            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "IF_MATCH_REQUIRED",
                    "Cần gửi If-Match từ ETag hiện tại.");
        try {
            if (!expected.startsWith("\"") || !expected.endsWith("\""))
                throw new IllegalArgumentException();
            byte[] bytes = Base64.getDecoder().decode(expected.substring(1, expected.length() - 1));
            if (bytes.length != 8) throw new IllegalArgumentException();
            if (!Arrays.equals(bytes, value.getRowVer()))
                throw conflict("Proposal đã thay đổi; hãy tải lại dữ liệu.");
        } catch (IllegalArgumentException error) {
            throw new ApiException(
                    HttpStatus.BAD_REQUEST, "INVALID_IF_MATCH", "If-Match không hợp lệ.");
        }
    }

    private static void open(Job job) {
        if (job.getStatus() != Job.Status.OPEN)
            throw conflict("Chỉ Job OPEN cho phép gửi hoặc cập nhật trạng thái Proposal.");
    }

    private static void require(AuthPrincipal actor, Role role) {
        if (actor == null) throw ApiException.unauthorized();
        if (!actor.roles().contains(role)) throw forbidden();
    }

    private static void requireReader(AuthPrincipal actor) {
        if (actor == null) throw ApiException.unauthorized();
        if (!actor.roles().contains(Role.CLIENT) && !actor.roles().contains(Role.FREELANCER))
            throw forbidden();
    }

    private Instant now() {
        return clock.instant().truncatedTo(ChronoUnit.MILLIS);
    }

    private static ApiException forbidden() {
        return new ApiException(
                HttpStatus.FORBIDDEN, "FORBIDDEN", "Bạn không có quyền thực hiện thao tác này.");
    }

    private static ApiException missing() {
        return new ApiException(
                HttpStatus.NOT_FOUND, "PROPOSAL_NOT_FOUND", "Không tìm thấy Proposal.");
    }

    private static ApiException missingJob() {
        return new ApiException(HttpStatus.NOT_FOUND, "JOB_NOT_FOUND", "Không tìm thấy Job.");
    }

    private static ApiException missingCv() {
        return new ApiException(
                HttpStatus.NOT_FOUND,
                "PROPOSAL_CV_NOT_FOUND",
                "Không tìm thấy CV đính kèm hoặc bạn không có quyền sử dụng CV này.");
    }

    private static ApiException conflict(String message) {
        return new ApiException(HttpStatus.CONFLICT, "PROPOSAL_CONFLICT", message);
    }

    private static ApiException invalid(String message) {
        return new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "INVALID_TRANSITION", message);
    }
}
