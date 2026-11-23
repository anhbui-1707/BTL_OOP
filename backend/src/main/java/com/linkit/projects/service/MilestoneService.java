package com.linkit.projects.service;

import com.linkit.audit.entity.AuditLog;
import com.linkit.audit.repository.AuditLogRepository;
import com.linkit.auth.security.AuthPrincipal;
import com.linkit.common.ApiException;
import com.linkit.identity.entity.UserRole.Role;
import com.linkit.identity.repository.UserRepository;
import com.linkit.jobs.entity.Job;
import com.linkit.projects.dto.MilestoneDtos.*;
import com.linkit.projects.entity.*;
import com.linkit.projects.repository.*;

import jakarta.persistence.EntityManager;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.net.URI;
import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.*;

@Service
@Transactional(readOnly = true)
public class MilestoneService {
    private final AssignmentRepository assignments;
    private final ScopeVersionRepository scopes;
    private final MilestoneRepository milestones;
    private final MilestoneSubmissionRepository submissions;
    private final UserRepository users;
    private final AuditLogRepository audit;
    private final EntityManager em;
    private final Clock clock;

    public MilestoneService(
            AssignmentRepository assignments,
            ScopeVersionRepository scopes,
            MilestoneRepository milestones,
            MilestoneSubmissionRepository submissions,
            UserRepository users,
            AuditLogRepository audit,
            EntityManager em,
            Clock clock) {
        this.assignments = assignments;
        this.scopes = scopes;
        this.milestones = milestones;
        this.submissions = submissions;
        this.users = users;
        this.audit = audit;
        this.em = em;
        this.clock = clock;
    }

    public Page<Detail> list(AuthPrincipal actor, Long assignmentId, int page, int size) {
        Assignment a = assignments.findById(assignmentId).orElseThrow(MilestoneService::missing);

        if (!actor.roles().contains(Role.ADMIN)) party(actor, a, null);
        var rows =
                milestones.findByAssignment_Id(
                        assignmentId, PageRequest.of(page, size, Sort.by("sortOrder", "id")));
        return new Page<>(
                rows.stream().map(this::detail).toList(),
                page,
                size,
                rows.getTotalElements(),
                rows.getTotalPages());
    }

    public Detail get(AuthPrincipal actor, Long id) {
        Milestone m = milestones.findById(id).orElseThrow(MilestoneService::missing);
        party(actor, m.getAssignment(), null);
        return detail(m);
    }

    public Page<Submission> history(AuthPrincipal actor, Long id, int page, int size) {
        Milestone m = milestones.findById(id).orElseThrow(MilestoneService::missing);
        party(actor, m.getAssignment(), null);
        var rows =
                submissions.findByMilestone_Id(
                        id,
                        PageRequest.of(
                                page, size, Sort.by(Sort.Direction.DESC, "submissionNumber")));
        return new Page<>(
                rows.stream().map(s -> submission(s, m)).toList(),
                page,
                size,
                rows.getTotalElements(),
                rows.getTotalPages());
    }

    @Transactional
    public Detail create(AuthPrincipal actor, Long assignmentId, Write input) {
        Assignment a =
                assignments.findForScope(assignmentId).orElseThrow(MilestoneService::missing);
        party(actor, a, Role.CLIENT);
        ScopeVersion scope = active(a);
        budget(a, scope, input, null);
        Milestone m = new Milestone();
        m.setAssignment(a);
        m.setScopeVersion(scope);
        write(m, input);
        m.setStatus(Milestone.Status.PLANNED);
        m.setCreatedAt(now());
        milestones.saveAndFlush(m);
        event(actor, "milestones", m.getId(), "MILESTONE_CREATED");
        audit.flush();
        return detail(m);
    }

    @Transactional
    public Detail update(AuthPrincipal actor, Long id, Write input, String expected) {
        Milestone m = locked(actor, id, Role.CLIENT, expected);
        editable(m);
        ScopeVersion scope = active(m.getAssignment());
        budget(m.getAssignment(), scope, input, m.getId());
        write(m, input);
        event(actor, "milestones", id, "MILESTONE_UPDATED");
        finish(m);
        return detail(m);
    }

    @Transactional
    public void cancel(AuthPrincipal actor, Long id, String expected) {
        Milestone m = locked(actor, id, Role.CLIENT, expected);
        editable(m);
        m.setStatus(Milestone.Status.CANCELLED);
        event(actor, "milestones", id, "MILESTONE_CANCELLED");
        finish(m);
    }

    @Transactional
    public Submission submit(AuthPrincipal actor, Long id, Submit input, String expected) {
        Milestone m = locked(actor, id, Role.FREELANCER, expected);
        if (!EnumSet.of(
                        Milestone.Status.PLANNED,
                        Milestone.Status.IN_PROGRESS,
                        Milestone.Status.REVISION_REQUIRED)
                .contains(m.getStatus()))
            throw conflict("Milestone is not accepting a submission.");
        var latest = submissions.findFirstByMilestone_IdOrderBySubmissionNumberDesc(id);
        if (latest.isPresent()
                && (m.getStatus() != Milestone.Status.REVISION_REQUIRED
                        || latest.get().getStatus()
                                != MilestoneSubmission.Status.REVISION_REQUIRED))
            throw conflict("Previous submission must require revision before resubmission.");
        if (latest.isEmpty() && m.getStatus() == Milestone.Status.REVISION_REQUIRED)
            throw conflict("Missing revision history.");
        int number = latest.map(MilestoneSubmission::getSubmissionNumber).orElse(0);
        if (number == Integer.MAX_VALUE) throw conflict("Submission number limit reached.");
        String url = validUrl(input.evidenceUrl());
        MilestoneSubmission s = new MilestoneSubmission();
        s.setMilestone(m);
        s.setSubmissionNumber(number + 1);
        s.setSubmittedBy(users.getReferenceById(actor.userId()));
        s.setSubmissionNote(input.submissionNote().strip());
        s.setEvidenceUrl(url);
        s.setStatus(MilestoneSubmission.Status.SUBMITTED);
        s.setSubmittedAt(now());
        submissions.saveAndFlush(s);
        m.setStatus(Milestone.Status.SUBMITTED);
        event(actor, "milestone_submissions", s.getId(), "MILESTONE_SUBMITTED");
        finish(m);
        return submission(s, m);
    }

    @Transactional
    public Submission review(
            AuthPrincipal actor, Long id, Review input, boolean approve, String expected) {
        Long milestoneId =
                submissions.findMilestoneIdById(id).orElseThrow(MilestoneService::missing);
        Milestone m = locked(actor, milestoneId, Role.CLIENT, expected);
        if (m.getStatus() != Milestone.Status.SUBMITTED)
            throw conflict("Milestone is not awaiting review.");
        MilestoneSubmission s =
                submissions
                        .findFirstByMilestone_IdOrderBySubmissionNumberDesc(milestoneId)
                        .orElseThrow(MilestoneService::missing);
        if (!Objects.equals(s.getId(), id) || s.getStatus() != MilestoneSubmission.Status.SUBMITTED)
            throw conflict("Only the latest unreviewed submission can be reviewed.");
        if (!Objects.equals(
                s.getSubmittedBy().getId(), m.getAssignment().getFreelancer().getUserId()))
            throw conflict("Submission is not from the assigned Freelancer.");
        String note =
                input == null || input.reviewNote() == null ? null : input.reviewNote().strip();
        if (!approve && (note == null || note.isBlank()))
            throw invalid("A revision reason is required.");
        Instant time = now();
        s.setStatus(
                approve
                        ? MilestoneSubmission.Status.APPROVED
                        : MilestoneSubmission.Status.REVISION_REQUIRED);
        s.setReviewedBy(users.getReferenceById(actor.userId()));
        s.setReviewNote(note);
        s.setReviewedAt(time);
        m.setStatus(approve ? Milestone.Status.APPROVED : Milestone.Status.REVISION_REQUIRED);
        m.setApprovedAt(approve ? time : null);
        event(
                actor,
                "milestone_submissions",
                id,
                approve ? "MILESTONE_APPROVED" : "MILESTONE_REVISION_REQUIRED");
        finish(m);
        return submission(s, m);
    }

    private Milestone locked(AuthPrincipal actor, Long id, Role role, String expected) {
        Long assignmentId =
                milestones.findAssignmentIdById(id).orElseThrow(MilestoneService::missing);
        Assignment a =
                assignments.findForScope(assignmentId).orElseThrow(MilestoneService::missing);
        party(actor, a, role);
        ScopeVersion scope = active(a);
        Milestone m = milestones.findForUpdate(id).orElseThrow(MilestoneService::missing);
        if (!Objects.equals(m.getScopeVersionId(), scope.getId()))
            throw conflict("Milestone must belong to the currently LOCKED Scope.");
        match(m, expected);
        return m;
    }

    private ScopeVersion active(Assignment a) {
        if (a.getStatus() != Assignment.Status.ACTIVE
                || a.getJob().getStatus() != Job.Status.IN_PROGRESS)
            throw conflict("Assignment must be ACTIVE and Job IN_PROGRESS.");
        return scopes.findByAssignment_IdAndStatus(a.getId(), ScopeVersion.Status.LOCKED)
                .orElseThrow(() -> conflict("A currently LOCKED Scope is required."));
    }

    private void party(AuthPrincipal actor, Assignment a, Role required) {
        boolean client =
                actor.roles().contains(Role.CLIENT)
                        && Objects.equals(actor.userId(), a.getClient().getUserId());
        boolean freelancer =
                actor.roles().contains(Role.FREELANCER)
                        && Objects.equals(actor.userId(), a.getFreelancer().getUserId());
        if (!client && !freelancer) throw missing();
        if (required == Role.CLIENT && !client || required == Role.FREELANCER && !freelancer)
            throw new ApiException(
                    HttpStatus.FORBIDDEN,
                    "FORBIDDEN",
                    "Only the appropriate Assignment party may perform this action.");
    }

    private void editable(Milestone m) {
        if (m.getStatus() != Milestone.Status.PLANNED
                || submissions.existsByMilestone_Id(m.getId()))
            throw conflict(
                    "Only PLANNED milestones without submissions can be changed or cancelled.");
    }

    private void budget(Assignment a, ScopeVersion scope, Write input, Long excluded) {
        if (input.dueDate().getYear() < 1
                || input.dueDate().getYear() > 9999
                || input.dueDate().isAfter(scope.getDeadline()))
            throw invalid(
                    "Milestone dueDate must fit SQL Server DATE and not exceed Scope deadline.");
        if (milestones
                        .allocated(a.getId(), excluded == null ? 0L : excluded)
                        .add(input.amount())
                        .compareTo(scope.getBudget())
                > 0)
            throw invalid("Total non-cancelled milestone amount exceeds the current Scope budget.");
    }

    private void write(Milestone m, Write in) {
        m.setTitle(in.title().strip());
        m.setDescription(in.description().strip());
        m.setAcceptanceCriteria(in.acceptanceCriteria().strip());
        m.setDueDate(in.dueDate());
        m.setAmount(in.amount());
        m.setIsRequired(in.isRequired());
        m.setSortOrder(in.sortOrder());
    }

    private String validUrl(String value) {
        if (value == null || value.isBlank()) return null;
        try {
            URI uri = URI.create(value.strip());
            if (!Set.of("http", "https")
                            .contains(
                                    uri.getScheme() == null
                                            ? ""
                                            : uri.getScheme().toLowerCase(Locale.ROOT))
                    || uri.getHost() == null
                    || uri.getUserInfo() != null) throw new IllegalArgumentException();
            return value.strip();
        } catch (IllegalArgumentException error) {
            throw invalid("Evidence URL must be an HTTP(S) URL without credentials.");
        }
    }

    private void match(Milestone m, String expected) {
        if (expected == null)
            throw new ApiException(
                    HttpStatus.BAD_REQUEST, "IF_MATCH_REQUIRED", "Milestone If-Match is required.");
        try {
            if (!expected.startsWith("\"") || !expected.endsWith("\""))
                throw new IllegalArgumentException();
            byte[] value = Base64.getDecoder().decode(expected.substring(1, expected.length() - 1));
            if (value.length != 8) throw new IllegalArgumentException();
            if (!Arrays.equals(value, m.getRowVer()))
                throw conflict("Milestone changed; reload and retry.");
        } catch (IllegalArgumentException error) {
            throw new ApiException(
                    HttpStatus.BAD_REQUEST, "INVALID_IF_MATCH", "Invalid Milestone If-Match.");
        }
    }

    private void finish(Milestone m) {
        em.flush();

        int count =
                em.createNativeQuery(
                                "UPDATE dbo.milestones SET status=status WHERE id=:id AND row_ver=:version")
                        .setParameter("id", m.getId())
                        .setParameter("version", m.getRowVer())
                        .executeUpdate();
        if (count != 1) throw conflict("Milestone changed concurrently.");
        em.refresh(m);
        audit.flush();
    }

    private Detail detail(Milestone m) {
        return new Detail(
                m.getId(),
                m.getAssignmentId(),
                m.getScopeVersionId(),
                m.getTitle(),
                m.getDescription(),
                m.getAcceptanceCriteria(),
                m.getDueDate(),
                m.getAmount(),
                m.getIsRequired(),
                m.getSortOrder(),
                m.getStatus(),
                m.getApprovedAt(),
                m.getCreatedAt(),
                version(m));
    }

    private Submission submission(MilestoneSubmission s, Milestone m) {
        return new Submission(
                s.getId(),
                m.getId(),
                s.getSubmissionNumber(),
                s.getSubmittedBy().getId(),
                s.getSubmissionNote(),
                s.getEvidenceUrl(),
                s.getStatus(),
                s.getReviewedBy() == null ? null : s.getReviewedBy().getId(),
                s.getReviewNote(),
                s.getSubmittedAt(),
                s.getReviewedAt(),
                version(m));
    }

    private String version(Milestone m) {
        return Base64.getEncoder().encodeToString(m.getRowVer());
    }

    private Instant now() {
        return clock.instant().truncatedTo(ChronoUnit.MILLIS);
    }

    private void event(AuthPrincipal actor, String type, Long id, String action) {
        AuditLog log = new AuditLog();
        log.setActor(users.getReferenceById(actor.userId()));
        log.setEntityType(type);
        log.setEntityId(id);
        log.setAction(action);
        log.setCreatedAt(now());
        log.setRequestId(UUID.randomUUID());
        audit.save(log);
    }

    private static ApiException missing() {
        return new ApiException(
                HttpStatus.NOT_FOUND,
                "MILESTONE_NOT_FOUND",
                "Milestone, Submission or Assignment not found.");
    }

    private static ApiException conflict(String text) {
        return new ApiException(HttpStatus.CONFLICT, "MILESTONE_CONFLICT", text);
    }

    private static ApiException invalid(String text) {
        return new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "INVALID_MILESTONE", text);
    }
}
