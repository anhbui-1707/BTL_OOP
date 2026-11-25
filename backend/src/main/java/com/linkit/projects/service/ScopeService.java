package com.linkit.projects.service;

import com.linkit.audit.entity.AuditLog;
import com.linkit.audit.repository.AuditLogRepository;
import com.linkit.auth.security.AuthPrincipal;
import com.linkit.common.ApiException;
import com.linkit.identity.entity.UserRole.Role;
import com.linkit.identity.repository.UserRepository;
import com.linkit.jobs.entity.Job;
import com.linkit.jobs.repository.JobRepository;
import com.linkit.projects.dto.ScopeDtos.*;
import com.linkit.projects.entity.*;
import com.linkit.projects.entity.ScopeApproval.PartyRole;
import com.linkit.projects.repository.*;

import jakarta.persistence.EntityManager;

import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.*;

@Service
@Transactional(readOnly = true)
public class ScopeService {
    private final AssignmentRepository assignments;
    private final ScopeVersionRepository scopes;
    private final ScopeApprovalRepository approvals;
    private final UserRepository users;
    private final JobRepository jobs;
    private final AuditLogRepository audit;
    private final EntityManager em;
    private final Clock clock;

    public ScopeService(
            AssignmentRepository assignments,
            ScopeVersionRepository scopes,
            ScopeApprovalRepository approvals,
            UserRepository users,
            JobRepository jobs,
            AuditLogRepository audit,
            EntityManager em,
            Clock clock) {
        this.assignments = assignments;
        this.scopes = scopes;
        this.approvals = approvals;
        this.users = users;
        this.jobs = jobs;
        this.audit = audit;
        this.em = em;
        this.clock = clock;
    }

    public Page list(AuthPrincipal actor, Long assignmentId, int page, int size) {
        Assignment a = assignments.findById(assignmentId).orElseThrow(ScopeService::missing);
        party(actor, a);
        var result =
                scopes.findByAssignment_IdOrderByVersionNumberDesc(
                        assignmentId, PageRequest.of(page, size));
        var rows = result.getContent();
        var decisions =
                rows.isEmpty()
                        ? List.<ScopeApproval>of()
                        : approvals.findByScopeVersion_IdIn(
                                rows.stream().map(ScopeVersion::getId).toList());
        return new Page(
                rows.stream().map(s -> detail(s, a, decisions)).toList(),
                page,
                size,
                result.getTotalElements(),
                result.getTotalPages());
    }

    public Detail get(AuthPrincipal actor, Long id) {
        ScopeVersion s = scopes.findById(id).orElseThrow(ScopeService::missing);
        party(actor, s.getAssignment());
        return detail(s, s.getAssignment(), decisions(id));
    }

    @Transactional
    public Detail create(AuthPrincipal actor, Long assignmentId, Create input, String expected) {
        Assignment a = locked(actor, assignmentId, expected);
        var history = scopes.findByAssignment_IdOrderByVersionNumberDesc(assignmentId);
        pending(a, history);
        ScopeVersion previous = history.isEmpty() ? null : history.getFirst();

        if (previous != null && previous.getStatus() == ScopeVersion.Status.PENDING_APPROVAL) {
            PartyRole role = party(actor, a);
            if (decisions(previous.getId()).stream().anyMatch(d -> d.getPartyRole() == role))
                throw conflict("You already approved this scope. It cannot be edited.");
        }
        Job job = a.getJob();
        ScopeVersion s = new ScopeVersion();
        s.setAssignment(a);
        if (previous != null && previous.getVersionNumber() == Integer.MAX_VALUE)
            throw conflict("Scope version limit reached.");
        s.setVersionNumber(previous == null ? 1 : previous.getVersionNumber() + 1);
        s.setDeliverables(
                input.deliverables() != null
                        ? input.deliverables()
                        : previous == null ? job.getDeliverables() : previous.getDeliverables());
        s.setAcceptanceCriteria(
                input.acceptanceCriteria() != null
                        ? input.acceptanceCriteria()
                        : previous == null
                                ? job.getAcceptanceCriteria()
                                : previous.getAcceptanceCriteria());
        s.setExclusions(
                input.exclusions() != null
                        ? input.exclusions()
                        : previous == null ? null : previous.getExclusions());
        s.setBudget(
                input.budget() != null
                        ? input.budget()
                        : previous == null ? a.getAgreedBudget() : previous.getBudget());
        s.setDeadline(
                input.deadline() != null
                        ? input.deadline()
                        : previous == null ? job.getDeadline() : previous.getDeadline());
        valid(s);
        s.setStatus(ScopeVersion.Status.DRAFT);
        s.setCreatedBy(users.getReferenceById(actor.userId()));
        s.setCreatedAt(now());
        for (var old : history)
            if (old.getStatus() == ScopeVersion.Status.DRAFT
                    || old.getStatus() == ScopeVersion.Status.PENDING_APPROVAL) {
                old.setStatus(ScopeVersion.Status.SUPERSEDED);
                event(actor, old, "SCOPE_SUPERSEDED");
            }
        scopes.saveAndFlush(s);
        event(actor, s, "SCOPE_CREATED");
        finish(a);
        return detail(s, a, List.of());
    }

    @Transactional
    public Detail submit(AuthPrincipal actor, Long id, String expected) {
        Assignment a = lockedScope(actor, id, expected);
        var history = scopes.findByAssignment_IdOrderByVersionNumberDesc(a.getId());
        pending(a, history);
        ScopeVersion s = current(id, history);
        if (s.getStatus() != ScopeVersion.Status.DRAFT)
            throw conflict("Only the current DRAFT can be submitted.");

        if (party(actor, a) != PartyRole.CLIENT)
            throw new ApiException(
                    HttpStatus.FORBIDDEN,
                    "CLIENT_ONLY",
                    "Only Client can send the scope for approval.");
        valid(s);
        s.setStatus(ScopeVersion.Status.PENDING_APPROVAL);
        event(actor, s, "SCOPE_SUBMITTED");
        ScopeApproval decision = new ScopeApproval();
        decision.setScopeVersion(s);
        decision.setUser(users.getReferenceById(actor.userId()));
        decision.setPartyRole(PartyRole.CLIENT);
        decision.setApprovedAt(now());
        approvals.saveAndFlush(decision);
        event(actor, s, "SCOPE_APPROVED");
        finish(a);
        return detail(s, a, List.of(decision));
    }

    @Transactional
    public Detail approve(AuthPrincipal actor, Long id, String expected) {
        Assignment a = lockedScope(actor, id, expected);
        PartyRole role = party(actor, a);
        var history = scopes.findByAssignment_IdOrderByVersionNumberDesc(a.getId());
        pending(a, history);
        ScopeVersion s = current(id, history);
        if (s.getStatus() != ScopeVersion.Status.PENDING_APPROVAL)
            throw conflict("Scope is not awaiting approval.");
        valid(s);
        var decisions = decisions(id);
        if (decisions.stream().anyMatch(d -> d.getPartyRole() == role))
            throw conflict("This party has already approved.");
        for (var d : decisions) {
            Long actual =
                    d.getPartyRole() == PartyRole.CLIENT
                            ? a.getClient().getUserId()
                            : a.getFreelancer().getUserId();
            if (!Objects.equals(d.getUser().getId(), actual))
                throw conflict("Existing approval is not from an Assignment party.");
        }
        ScopeApproval decision = new ScopeApproval();
        decision.setScopeVersion(s);
        decision.setUser(users.getReferenceById(actor.userId()));
        decision.setPartyRole(role);
        decision.setApprovedAt(now());
        approvals.saveAndFlush(decision);
        event(actor, s, "SCOPE_APPROVED");
        decisions = new ArrayList<>(decisions);
        decisions.add(decision);
        if (decisions.size() == 2) {
            Job job = jobs.findForUpdate(a.getJobId()).orElseThrow(ScopeService::missing);
            if (job.getStatus() != Job.Status.ASSIGNED)
                throw conflict("Job must be ASSIGNED before Scope Lock.");
            Instant time = now();
            s.setStatus(ScopeVersion.Status.LOCKED);
            s.setLockedAt(time);
            a.setStatus(Assignment.Status.ACTIVE);
            a.setStartedAt(time);
            job.setStatus(Job.Status.IN_PROGRESS);
            job.setUpdatedAt(
                    time.isAfter(job.getUpdatedAt()) ? time : job.getUpdatedAt().plusMillis(1));
            event(actor, s, "SCOPE_LOCKED");
        }
        finish(a);
        return detail(s, a, decisions);
    }

    private Assignment lockedScope(AuthPrincipal actor, Long id, String expected) {
        return locked(
                actor,
                scopes.findAssignmentIdById(id).orElseThrow(ScopeService::missing),
                expected);
    }

    private Assignment locked(AuthPrincipal actor, Long id, String expected) {
        Assignment a = assignments.findForScope(id).orElseThrow(ScopeService::missing);
        party(actor, a);
        match(a, expected);
        return a;
    }

    private PartyRole party(AuthPrincipal actor, Assignment a) {
        if (actor.roles().contains(Role.CLIENT)
                && Objects.equals(actor.userId(), a.getClient().getUserId()))
            return PartyRole.CLIENT;
        if (actor.roles().contains(Role.FREELANCER)
                && Objects.equals(actor.userId(), a.getFreelancer().getUserId()))
            return PartyRole.FREELANCER;
        throw missing();
    }

    private void pending(Assignment a, List<ScopeVersion> history) {
        if (a.getStatus() != Assignment.Status.PENDING_SCOPE
                || history.stream().anyMatch(s -> s.getStatus() == ScopeVersion.Status.LOCKED))
            throw conflict(
                    "Scope changes require PENDING_SCOPE without a locked version.");
    }

    private ScopeVersion current(Long id, List<ScopeVersion> history) {
        if (history.isEmpty() || !Objects.equals(history.getFirst().getId(), id))
            throw conflict("Only the newest Scope version is eligible.");
        return history.getFirst();
    }

    private void valid(ScopeVersion s) {
        if (s.getDeliverables() == null
                || s.getDeliverables().isBlank()
                || s.getDeliverables().length() > 20000
                || s.getAcceptanceCriteria() == null
                || s.getAcceptanceCriteria().isBlank()
                || s.getAcceptanceCriteria().length() > 20000
                || s.getExclusions() != null && s.getExclusions().length() > 20000
                || s.getBudget() == null
                || s.getBudget().signum() < 0
                || s.getBudget().scale() > 2
                || s.getBudget().precision() - s.getBudget().scale() > 17
                || s.getDeadline() == null
                || s.getDeadline().getYear() < 1
                || s.getDeadline().getYear() > 9999)
            throw new ApiException(
                    HttpStatus.UNPROCESSABLE_ENTITY,
                    "INVALID_SCOPE",
                    "Scope content, budget or SQL Server date is invalid.");
    }

    private void finish(Assignment a) {
        em.flush();

        int count =
                em.createNativeQuery(
                                "UPDATE dbo.assignments SET status=status WHERE id=:id AND row_ver=:version")
                        .setParameter("id", a.getId())
                        .setParameter("version", a.getRowVer())
                        .executeUpdate();
        if (count != 1) throw conflict("Assignment changed concurrently.");
        em.refresh(a);
        audit.flush();
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

    private List<ScopeApproval> decisions(Long id) {
        return approvals.findByScopeVersion_IdIn(List.of(id));
    }

    private Detail detail(ScopeVersion s, Assignment a, List<ScopeApproval> decisions) {
        return new Detail(
                s.getId(),
                a.getId(),
                s.getVersionNumber(),
                s.getDeliverables(),
                s.getExclusions(),
                s.getAcceptanceCriteria(),
                s.getBudget(),
                s.getDeadline(),
                s.getStatus(),
                s.getCreatedBy().getId(),
                s.getCreatedAt(),
                s.getLockedAt(),
                decisions.stream()
                        .filter(d -> Objects.equals(d.getScopeVersion().getId(), s.getId()))
                        .sorted(Comparator.comparing(ScopeApproval::getPartyRole))
                        .map(
                                d ->
                                        new Approval(
                                                d.getUser().getId(),
                                                d.getPartyRole(),
                                                d.getApprovedAt()))
                        .toList(),
                Base64.getEncoder().encodeToString(a.getRowVer()));
    }

    private Instant now() {
        return clock.instant().truncatedTo(ChronoUnit.MILLIS);
    }

    private void event(AuthPrincipal actor, ScopeVersion s, String action) {
        AuditLog log = new AuditLog();
        log.setActor(users.getReferenceById(actor.userId()));
        log.setEntityType("scope_versions");
        log.setEntityId(s.getId());
        log.setAction(action);
        log.setCreatedAt(now());
        log.setRequestId(UUID.randomUUID());
        audit.save(log);
    }

    private static ApiException missing() {
        return new ApiException(
                HttpStatus.NOT_FOUND, "SCOPE_NOT_FOUND", "Scope or Assignment not found.");
    }

    private static ApiException conflict(String text) {
        return new ApiException(HttpStatus.CONFLICT, "SCOPE_CONFLICT", text);
    }
}
