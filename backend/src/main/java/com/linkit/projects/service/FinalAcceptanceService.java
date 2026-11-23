package com.linkit.projects.service;

import com.linkit.audit.entity.AuditLog;
import com.linkit.audit.repository.AuditLogRepository;
import com.linkit.auth.security.AuthPrincipal;
import com.linkit.common.ApiException;
import com.linkit.identity.entity.UserRole.Role;
import com.linkit.identity.repository.UserRepository;
import com.linkit.jobs.entity.Job;
import com.linkit.jobs.repository.JobRepository;
import com.linkit.projects.dto.FinalAcceptanceDtos.*;
import com.linkit.projects.entity.*;
import com.linkit.projects.repository.*;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.*;

@Service
@Transactional(readOnly = true)
public class FinalAcceptanceService {
    private final AssignmentRepository assignments;
    private final JobRepository jobs;
    private final ScopeVersionRepository scopes;
    private final MilestoneRepository milestones;
    private final ChangeRequestRepository changes;
    private final FinalAcceptanceRepository acceptances;
    private final UserRepository users;
    private final AuditLogRepository audit;
    private final Clock clock;

    public FinalAcceptanceService(
            AssignmentRepository assignments,
            JobRepository jobs,
            ScopeVersionRepository scopes,
            MilestoneRepository milestones,
            ChangeRequestRepository changes,
            FinalAcceptanceRepository acceptances,
            UserRepository users,
            AuditLogRepository audit,
            Clock clock) {
        this.assignments = assignments;
        this.jobs = jobs;
        this.scopes = scopes;
        this.milestones = milestones;
        this.changes = changes;
        this.acceptances = acceptances;
        this.users = users;
        this.audit = audit;
        this.clock = clock;
    }

    public Status get(AuthPrincipal actor, Long id) {
        Assignment a = assignments.findById(id).orElseThrow(FinalAcceptanceService::missing);
        party(actor, a, false);
        return status(a, acceptances.findByAssignment_Id(id).orElse(null));
    }

    @Transactional
    public Status accept(AuthPrincipal actor, Long id, Accept input, String expected) {
        Assignment a = assignments.findForScope(id).orElseThrow(FinalAcceptanceService::missing);
        party(actor, a, true);
        match(a, expected);
        if (!EnumSet.of(Assignment.Status.ACTIVE, Assignment.Status.AWAITING_ACCEPTANCE)
                        .contains(a.getStatus())
                || acceptances.existsByAssignment_Id(id))
            throw conflict("Assignment is not eligible or has already been accepted.");
        Job job = jobs.findForUpdate(a.getJobId()).orElseThrow(FinalAcceptanceService::missing);
        if (job.getStatus() != Job.Status.IN_PROGRESS) throw conflict("Job must be IN_PROGRESS.");
        ScopeVersion scope =
                scopes.findByAssignment_IdAndStatus(id, ScopeVersion.Status.LOCKED)
                        .orElseThrow(() -> conflict("A current LOCKED Scope is required."));
        boolean hasApprovedRequired = false;
        for (var m : milestones.findByAssignment_Id(id)) {
            if (!Objects.equals(m.getScopeVersionId(), scope.getId())
                    || !m.getIsRequired()
                    || m.getStatus() == Milestone.Status.CANCELLED) continue;
            if (m.getStatus() != Milestone.Status.APPROVED)
                throw conflict("Every current required non-cancelled Milestone must be APPROVED.");
            hasApprovedRequired = true;
        }
        if (!hasApprovedRequired)
            throw conflict(
                    "At least one required APPROVED Milestone in the current Scope is necessary.");
        if (changes.findByAssignment_Id(id).stream()
                .anyMatch(
                        c ->
                                Objects.equals(c.getBaseScopeVersionId(), scope.getId())
                                        && (c.getStatus() == ChangeRequest.Status.PENDING
                                                || c.getStatus() == ChangeRequest.Status.APPROVED)))
            throw conflict(
                    "An unresolved Change Request on the current Scope prevents acceptance.");
        Instant now = clock.instant().truncatedTo(ChronoUnit.MILLIS);
        FinalAcceptance value = new FinalAcceptance();
        value.setAssignment(a);
        value.setScopeVersionId(scope.getId());
        value.setAcceptedBy(users.getReferenceById(actor.userId()));
        value.setAcceptanceNote(
                input == null || input.acceptanceNote() == null
                        ? null
                        : input.acceptanceNote().strip());
        value.setAcceptedAt(now);
        acceptances.saveAndFlush(value);
        a.setStatus(Assignment.Status.COMPLETED);
        a.setCompletedAt(now);
        job.setStatus(Job.Status.COMPLETED);
        job.setUpdatedAt(now.isAfter(job.getUpdatedAt()) ? now : job.getUpdatedAt().plusMillis(1));
        assignments.flush();
        event(actor, "final_acceptances", value.getId(), "FINAL_ACCEPTANCE_CREATED", now);
        event(actor, "assignments", id, "ASSIGNMENT_COMPLETED", now);
        event(actor, "jobs", job.getId(), "JOB_COMPLETED", now);
        audit.flush();
        return status(a, value);
    }

    private void party(AuthPrincipal actor, Assignment a, boolean clientOnly) {
        if (actor.roles().contains(Role.CLIENT)
                && Objects.equals(actor.userId(), a.getClient().getUserId())) return;
        if (!clientOnly
                && actor.roles().contains(Role.FREELANCER)
                && Objects.equals(actor.userId(), a.getFreelancer().getUserId())) return;
        throw missing();
    }

    private Status status(Assignment a, FinalAcceptance value) {
        return new Status(
                a.getId(),
                a.getStatus(),
                value != null,
                value == null
                        ? null
                        : new Detail(
                                value.getId(),
                                value.getScopeVersionId(),
                                value.getAcceptedBy().getId(),
                                value.getAcceptanceNote(),
                                value.getAcceptedAt()),
                Base64.getEncoder().encodeToString(a.getRowVer()));
    }

    private void match(Assignment a, String expected) {
        if (expected == null)
            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "IF_MATCH_REQUIRED",
                    "Assignment If-Match is required.");
        try {
            if (!expected.startsWith("\"") || !expected.endsWith("\""))
                throw new IllegalArgumentException();
            byte[] value = Base64.getDecoder().decode(expected.substring(1, expected.length() - 1));
            if (value.length != 8) throw new IllegalArgumentException();
            if (!Arrays.equals(value, a.getRowVer()))
                throw conflict("Assignment changed; reload and retry.");
        } catch (IllegalArgumentException error) {
            throw new ApiException(
                    HttpStatus.BAD_REQUEST, "INVALID_IF_MATCH", "Invalid Assignment If-Match.");
        }
    }

    private void event(AuthPrincipal actor, String type, Long id, String action, Instant now) {
        AuditLog log = new AuditLog();
        log.setActor(users.getReferenceById(actor.userId()));
        log.setEntityType(type);
        log.setEntityId(id);
        log.setAction(action);
        log.setCreatedAt(now);
        log.setRequestId(UUID.randomUUID());
        audit.save(log);
    }

    private static ApiException missing() {
        return new ApiException(
                HttpStatus.NOT_FOUND,
                "FINAL_ACCEPTANCE_NOT_FOUND",
                "Assignment or Final Acceptance not found.");
    }

    private static ApiException conflict(String text) {
        return new ApiException(HttpStatus.CONFLICT, "FINAL_ACCEPTANCE_CONFLICT", text);
    }
}
