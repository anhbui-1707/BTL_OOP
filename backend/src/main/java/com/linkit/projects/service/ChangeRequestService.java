package com.linkit.projects.service;

import com.linkit.audit.entity.AuditLog;
import com.linkit.audit.repository.AuditLogRepository;
import com.linkit.auth.security.AuthPrincipal;
import com.linkit.common.ApiException;
import com.linkit.identity.entity.UserRole.Role;
import com.linkit.identity.repository.UserRepository;
import com.linkit.jobs.entity.Job;
import com.linkit.projects.dto.ChangeRequestDtos.*;
import com.linkit.projects.entity.*;
import com.linkit.projects.entity.ChangeRequestApproval.PartyRole;
import com.linkit.projects.repository.*;

import jakarta.persistence.EntityManager;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.*;

@Service
@Transactional(readOnly = true)
public class ChangeRequestService {
    private final AssignmentRepository assignments;
    private final ScopeVersionRepository scopes;
    private final ChangeRequestRepository changes;
    private final ChangeRequestApprovalRepository approvals;
    private final MilestoneRepository milestones;
    private final MilestoneSubmissionRepository submissions;
    private final UserRepository users;
    private final AuditLogRepository audit;
    private final EntityManager em;
    private final Clock clock;

    public ChangeRequestService(
            AssignmentRepository assignments,
            ScopeVersionRepository scopes,
            ChangeRequestRepository changes,
            ChangeRequestApprovalRepository approvals,
            MilestoneRepository milestones,
            MilestoneSubmissionRepository submissions,
            UserRepository users,
            AuditLogRepository audit,
            EntityManager em,
            Clock clock) {
        this.assignments = assignments;
        this.scopes = scopes;
        this.changes = changes;
        this.approvals = approvals;
        this.milestones = milestones;
        this.submissions = submissions;
        this.users = users;
        this.audit = audit;
        this.em = em;
        this.clock = clock;
    }

    public Page list(AuthPrincipal actor, Long assignmentId, int page, int size) {
        Assignment a =
                assignments.findById(assignmentId).orElseThrow(ChangeRequestService::missing);
        party(actor, a);
        var result =
                changes.findByAssignment_Id(
                        assignmentId,
                        PageRequest.of(
                                page, size, Sort.by(Sort.Direction.DESC, "createdAt", "id")));
        var decisions =
                result.isEmpty()
                        ? List.<ChangeRequestApproval>of()
                        : approvals.findByChangeRequest_IdIn(
                                result.stream().map(ChangeRequest::getId).toList());
        return new Page(
                result.stream().map(c -> detail(c, decisions)).toList(),
                page,
                size,
                result.getTotalElements(),
                result.getTotalPages());
    }

    public Detail get(AuthPrincipal actor, Long id) {
        ChangeRequest c = changes.findById(id).orElseThrow(ChangeRequestService::missing);
        party(actor, c.getAssignment());
        return detail(c, decisions(id));
    }

    @Transactional
    public Detail create(AuthPrincipal actor, Long assignmentId, Create input) {
        Assignment a =
                assignments.findForScope(assignmentId).orElseThrow(ChangeRequestService::missing);
        party(actor, a);
        ScopeVersion base = current(a);
        result(base, input.budgetDelta(), input.daysDelta());
        ChangeRequest c = new ChangeRequest();
        c.setAssignment(a);
        c.setBaseScopeVersion(base);
        c.setRequestedBy(users.getReferenceById(actor.userId()));
        c.setTitle(input.title().strip());
        c.setReason(input.reason().strip());
        c.setProposedDeliverables(input.proposedDeliverables().strip());
        c.setBudgetDelta(input.budgetDelta());
        c.setDaysDelta(input.daysDelta());
        c.setStatus(ChangeRequest.Status.PENDING);
        c.setCreatedAt(now());
        changes.saveAndFlush(c);
        event(actor, "change_requests", c.getId(), "CHANGE_REQUEST_CREATED");
        audit.flush();
        return detail(c, List.of());
    }

    @Transactional
    public Detail decide(AuthPrincipal actor, Long id, Decide input, String expected) {
        ChangeRequest c = locked(actor, id, expected);
        current(c.getAssignment());
        if (c.getStatus() != ChangeRequest.Status.PENDING)
            throw conflict("Only a PENDING Change Request accepts decisions.");
        PartyRole role = party(actor, c.getAssignment());
        var decisions = decisions(id);
        if (decisions.stream().anyMatch(d -> d.getPartyRole() == role))
            throw conflict("This party already decided; decisions are immutable.");
        validDecisions(c, decisions);
        ChangeRequestApproval decision = new ChangeRequestApproval();
        decision.setChangeRequest(c);
        decision.setUser(users.getReferenceById(actor.userId()));
        decision.setPartyRole(role);
        decision.setDecision(input.decision());
        decision.setComment(input.comment() == null ? null : input.comment().strip());
        decision.setDecidedAt(now());
        approvals.saveAndFlush(decision);
        if (input.decision() == ChangeRequestApproval.Decision.REJECTED) {
            c.setStatus(ChangeRequest.Status.REJECTED);
            c.setResolvedAt(now());
        } else if (decisions.size() == 1) c.setStatus(ChangeRequest.Status.APPROVED);
        event(actor, "change_requests", id, "CHANGE_REQUEST_DECIDED");
        finish(c);
        return detail(c, decisions(id));
    }

    @Transactional
    public Detail apply(AuthPrincipal actor, Long id, String expected) {
        ChangeRequest c = locked(actor, id, expected);
        Assignment a = c.getAssignment();
        if (party(actor, a) != PartyRole.CLIENT)
            throw new ApiException(
                    HttpStatus.FORBIDDEN,
                    "FORBIDDEN",
                    "Only the owning CLIENT may apply a change.");
        ScopeVersion base = current(a);
        if (c.getStatus() != ChangeRequest.Status.APPROVED || c.getResultScopeVersionId() != null)
            throw conflict("Only an unapplied APPROVED Change Request is eligible.");
        if (!Objects.equals(base.getId(), c.getBaseScopeVersionId()))
            throw conflict("Base Scope is no longer the currently LOCKED Scope.");
        var decisions = decisions(id);
        validDecisions(c, decisions);
        if (decisions.size() != 2
                || decisions.stream()
                        .anyMatch(d -> d.getDecision() != ChangeRequestApproval.Decision.APPROVED))
            throw conflict("Both actual parties must approve this Change Request.");
        for (var m : milestones.findByAssignment_Id(a.getId())) {
            if (m.getStatus() != Milestone.Status.APPROVED
                    && m.getStatus() != Milestone.Status.CANCELLED)
                throw conflict(
                        "Cancel PLANNED work and finish all in-flight milestones before applying a change.");
        }
        if (!submissions
                .countByAssignmentAndStatus(a.getId(), MilestoneSubmission.Status.SUBMITTED)
                .isEmpty()) throw conflict("Unreviewed submissions prevent applying a change.");
        Proposed proposed = result(base, c.getBudgetDelta(), c.getDaysDelta());
        if (milestones.allocated(a.getId(), 0L).compareTo(proposed.budget()) > 0)
            throw invalid(
                    "Resulting Scope budget cannot be below existing non-cancelled milestone allocations.");
        var history = scopes.findByAssignment_IdOrderByVersionNumberDesc(a.getId());
        int version = history.getFirst().getVersionNumber();
        if (version == Integer.MAX_VALUE) throw conflict("Scope version limit reached.");
        base.setStatus(ScopeVersion.Status.SUPERSEDED);
        scopes.flush();
        ScopeVersion next = new ScopeVersion();
        next.setAssignment(a);
        next.setVersionNumber(version + 1);
        next.setDeliverables(c.getProposedDeliverables());
        next.setExclusions(base.getExclusions());
        next.setAcceptanceCriteria(base.getAcceptanceCriteria());
        next.setBudget(proposed.budget());
        next.setDeadline(proposed.deadline());
        next.setStatus(ScopeVersion.Status.LOCKED);
        next.setCreatedBy(users.getReferenceById(actor.userId()));
        next.setCreatedAt(now());
        next.setLockedAt(now());
        scopes.saveAndFlush(next);
        a.setAgreedBudget(proposed.budget());
        c.setResultScopeVersionId(next.getId());
        c.setStatus(ChangeRequest.Status.APPLIED);
        c.setResolvedAt(now());
        event(actor, "scope_versions", base.getId(), "SCOPE_SUPERSEDED_BY_CHANGE");
        event(actor, "scope_versions", next.getId(), "SCOPE_LOCKED_BY_CHANGE");
        event(actor, "assignments", a.getId(), "ASSIGNMENT_BUDGET_CHANGED");
        event(actor, "change_requests", id, "CHANGE_REQUEST_APPLIED");
        finish(c);
        return detail(c, decisions);
    }

    private ChangeRequest locked(AuthPrincipal actor, Long id, String expected) {
        Long assignmentId =
                changes.findAssignmentIdById(id).orElseThrow(ChangeRequestService::missing);
        Assignment a =
                assignments.findForScope(assignmentId).orElseThrow(ChangeRequestService::missing);
        party(actor, a);
        ChangeRequest c = changes.findForUpdate(id).orElseThrow(ChangeRequestService::missing);
        match(c, expected);
        return c;
    }

    private ScopeVersion current(Assignment a) {
        if (a.getStatus() != Assignment.Status.ACTIVE
                || a.getJob().getStatus() != Job.Status.IN_PROGRESS)
            throw conflict("Assignment must be ACTIVE and Job IN_PROGRESS.");
        return scopes.findByAssignment_IdAndStatus(a.getId(), ScopeVersion.Status.LOCKED)
                .orElseThrow(() -> conflict("A currently LOCKED Scope is required."));
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

    private void validDecisions(ChangeRequest c, List<ChangeRequestApproval> decisions) {
        for (var d : decisions) {
            Long actual =
                    d.getPartyRole() == PartyRole.CLIENT
                            ? c.getAssignment().getClient().getUserId()
                            : c.getAssignment().getFreelancer().getUserId();
            if (!Objects.equals(actual, d.getUser().getId()))
                throw conflict("Approval must belong to an actual Assignment party.");
            if (d.getDecision() == ChangeRequestApproval.Decision.REJECTED)
                throw conflict("A rejection prevents further approval or application.");
        }
    }

    private record Proposed(BigDecimal budget, LocalDate deadline) {}

    private Proposed result(ScopeVersion base, BigDecimal delta, int days) {
        BigDecimal budget = base.getBudget().add(delta);
        if (budget.signum() <= 0 || budget.compareTo(new BigDecimal("99999999999999999.99")) > 0)
            throw invalid("Resulting Scope budget must be positive and fit DECIMAL(19,2).");
        try {
            LocalDate deadline = base.getDeadline().plusDays(days);
            if (deadline.getYear() < 1 || deadline.getYear() > 9999)
                throw new DateTimeException("SQL Server DATE overflow");
            return new Proposed(budget, deadline);
        } catch (DateTimeException | ArithmeticException error) {
            throw invalid("Resulting deadline must fit SQL Server DATE.");
        }
    }

    private List<ChangeRequestApproval> decisions(Long id) {
        return approvals.findByChangeRequest_IdIn(List.of(id));
    }

    private Detail detail(ChangeRequest c, List<ChangeRequestApproval> decisions) {
        return new Detail(
                c.getId(),
                c.getAssignment().getId(),
                c.getBaseScopeVersionId(),
                c.getRequestedBy().getId(),
                c.getTitle(),
                c.getReason(),
                c.getProposedDeliverables(),
                c.getBudgetDelta(),
                c.getDaysDelta(),
                c.getStatus(),
                c.getResultScopeVersionId(),
                c.getCreatedAt(),
                c.getResolvedAt(),
                decisions.stream()
                        .filter(d -> Objects.equals(d.getChangeRequest().getId(), c.getId()))
                        .sorted(Comparator.comparing(ChangeRequestApproval::getPartyRole))
                        .map(
                                d ->
                                        new Decision(
                                                d.getUser().getId(),
                                                d.getPartyRole(),
                                                d.getDecision(),
                                                d.getComment(),
                                                d.getDecidedAt()))
                        .toList(),
                Base64.getEncoder().encodeToString(c.getRowVer()));
    }

    private void finish(ChangeRequest c) {
        em.flush();
        int count =
                em.createNativeQuery(
                                "UPDATE dbo.change_requests SET status=status WHERE id=:id AND row_ver=:version")
                        .setParameter("id", c.getId())
                        .setParameter("version", c.getRowVer())
                        .executeUpdate();
        if (count != 1) throw conflict("Change Request changed concurrently.");
        em.refresh(c);
        audit.flush();
    }

    private void match(ChangeRequest c, String expected) {
        if (expected == null)
            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "IF_MATCH_REQUIRED",
                    "Change Request If-Match is required.");
        try {
            if (!expected.startsWith("\"") || !expected.endsWith("\""))
                throw new IllegalArgumentException();
            byte[] value = Base64.getDecoder().decode(expected.substring(1, expected.length() - 1));
            if (value.length != 8) throw new IllegalArgumentException();
            if (!Arrays.equals(value, c.getRowVer()))
                throw conflict("Change Request changed; reload and retry.");
        } catch (IllegalArgumentException error) {
            throw new ApiException(
                    HttpStatus.BAD_REQUEST, "INVALID_IF_MATCH", "Invalid Change Request If-Match.");
        }
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
                "CHANGE_REQUEST_NOT_FOUND",
                "Change Request or Assignment not found.");
    }

    private static ApiException conflict(String text) {
        return new ApiException(HttpStatus.CONFLICT, "CHANGE_REQUEST_CONFLICT", text);
    }

    private static ApiException invalid(String text) {
        return new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "INVALID_CHANGE_REQUEST", text);
    }
}
