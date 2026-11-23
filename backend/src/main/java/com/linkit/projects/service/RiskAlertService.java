package com.linkit.projects.service;

import com.linkit.audit.entity.AuditLog;
import com.linkit.audit.repository.AuditLogRepository;
import com.linkit.auth.security.AuthPrincipal;
import com.linkit.common.ApiException;
import com.linkit.identity.entity.UserRole.Role;
import com.linkit.identity.repository.UserRepository;
import com.linkit.projects.dto.RiskDtos.*;
import com.linkit.projects.entity.*;
import com.linkit.projects.repository.*;

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
public class RiskAlertService {
    private final AssignmentRepository assignments;
    private final ScopeVersionRepository scopes;
    private final MilestoneRepository milestones;
    private final MilestoneSubmissionRepository submissions;
    private final ChangeRequestRepository changes;
    private final RiskAlertRepository risks;
    private final UserRepository users;
    private final AuditLogRepository audit;
    private final Clock clock;

    public RiskAlertService(
            AssignmentRepository assignments,
            ScopeVersionRepository scopes,
            MilestoneRepository milestones,
            MilestoneSubmissionRepository submissions,
            ChangeRequestRepository changes,
            RiskAlertRepository risks,
            UserRepository users,
            AuditLogRepository audit,
            Clock clock) {
        this.assignments = assignments;
        this.scopes = scopes;
        this.milestones = milestones;
        this.submissions = submissions;
        this.changes = changes;
        this.risks = risks;
        this.users = users;
        this.audit = audit;
        this.clock = clock;
    }

    public Page list(AuthPrincipal actor, Long assignmentId, int page, int size) {
        Assignment a = assignments.findById(assignmentId).orElseThrow(RiskAlertService::missing);
        party(actor, a, false, true);
        var rows =
                risks.findByAssignment_Id(
                        assignmentId,
                        PageRequest.of(
                                page, size, Sort.by(Sort.Direction.DESC, "detectedAt", "id")));
        return new Page(
                rows.stream().map(this::detail).toList(),
                page,
                size,
                rows.getTotalElements(),
                rows.getTotalPages());
    }

    public Detail get(AuthPrincipal actor, Long id) {
        RiskAlert r = risks.findById(id).orElseThrow(RiskAlertService::missing);
        party(actor, r.getAssignment(), false, true);
        return detail(r);
    }

    @Transactional
    public Evaluation evaluate(AuthPrincipal actor, Long assignmentId) {
        Assignment a =
                assignments.findForScope(assignmentId).orElseThrow(RiskAlertService::missing);
        party(actor, a, true, true);
        Map<Key, Candidate> conditions = conditions(a);
        List<RiskAlert> existing = risks.findByAssignment_Id(assignmentId);
        Set<Key> active = new HashSet<>();
        int resolved = 0, created = 0;
        for (var risk : existing) {
            if (risk.getStatus() == RiskAlert.Status.RESOLVED || !managed(risk)) continue;
            Key key = key(risk);
            if (!conditions.containsKey(key)) {
                risk.setStatus(RiskAlert.Status.RESOLVED);
                risk.setResolvedAt(now());
                event(actor, risk, "RISK_AUTO_RESOLVED");
                resolved++;
            } else active.add(key);
        }
        for (var candidate : conditions.values()) {
            if (active.contains(candidate.key())) continue;
            Key key = candidate.key();
            if (key.code().length() > 60)
                throw new ApiException(
                        HttpStatus.UNPROCESSABLE_ENTITY,
                        "INVALID_RISK_SOURCE",
                        "Risk rule_code exceeds 60 characters.");
            RiskAlert risk = new RiskAlert();
            risk.setAssignment(a);
            risk.setMilestoneId(key.milestoneId());
            risk.setRiskType(key.type());
            risk.setRuleCode(key.code());
            risk.setTitle(key.type());
            risk.setDescription(candidate.explanation());
            risk.setSeverity(candidate.severity());
            risk.setStatus(RiskAlert.Status.OPEN);
            risk.setDetectedAt(now());
            risks.save(risk);
            event(actor, risk, "RISK_CREATED");
            created++;
        }
        risks.flush();
        audit.flush();
        return new Evaluation(created, resolved);
    }

    @Transactional
    public Detail acknowledge(AuthPrincipal actor, Long id) {
        RiskAlert risk = locked(actor, id, false);
        if (risk.getStatus() == RiskAlert.Status.RESOLVED)
            throw conflict("A resolved alert cannot be acknowledged.");
        if (risk.getStatus() == RiskAlert.Status.OPEN) {
            risk.setStatus(RiskAlert.Status.ACKNOWLEDGED);
            event(actor, risk, "RISK_ACKNOWLEDGED");
            risks.flush();
            audit.flush();
        }
        return detail(risk);
    }

    @Transactional
    public Detail resolve(AuthPrincipal actor, Long id) {
        RiskAlert risk = locked(actor, id, true);
        if (risk.getStatus() != RiskAlert.Status.RESOLVED) {
            risk.setStatus(RiskAlert.Status.RESOLVED);
            risk.setResolvedAt(now());
            event(actor, risk, "RISK_RESOLVED");
            risks.flush();
            audit.flush();
        }
        return detail(risk);
    }

    private RiskAlert locked(AuthPrincipal actor, Long id, boolean adminAllowed) {
        Long assignmentId = risks.findAssignmentIdById(id).orElseThrow(RiskAlertService::missing);
        Assignment a =
                assignments.findForScope(assignmentId).orElseThrow(RiskAlertService::missing);
        party(actor, a, true, adminAllowed);
        return risks.findById(id).orElseThrow(RiskAlertService::missing);
    }

    private void party(
            AuthPrincipal actor, Assignment a, boolean clientOnly, boolean adminAllowed) {
        if (adminAllowed && actor.roles().contains(Role.ADMIN)) return;
        if (actor.roles().contains(Role.CLIENT)
                && Objects.equals(actor.userId(), a.getClient().getUserId())) return;
        if (!clientOnly
                && actor.roles().contains(Role.FREELANCER)
                && Objects.equals(actor.userId(), a.getFreelancer().getUserId())) return;
        throw missing();
    }

    private record Key(String type, String code, Long milestoneId) {}

    private record Candidate(Key key, RiskAlert.Severity severity, String explanation) {}

    private Map<Key, Candidate> conditions(Assignment a) {
        LocalDate today = LocalDate.ofInstant(clock.instant(), ZoneOffset.UTC);
        Map<Key, Candidate> result = new LinkedHashMap<>();
        var work = milestones.findByAssignment_Id(a.getId());
        Map<Long, Long> revisions = new HashMap<>();
        for (Object[] row :
                submissions.countByAssignmentAndStatus(
                        a.getId(), MilestoneSubmission.Status.REVISION_REQUIRED))
            revisions.put((Long) row[0], (Long) row[1]);
        for (var milestone : work) {
            if (milestone.getStatus() != Milestone.Status.APPROVED
                    && milestone.getStatus() != Milestone.Status.CANCELLED
                    && milestone.getDueDate().isBefore(today))
                add(
                        result,
                        "MILESTONE_OVERDUE",
                        "MILESTONE_OVERDUE",
                        milestone.getId(),
                        RiskAlert.Severity.HIGH,
                        "Milestone is overdue as of UTC date " + today + ".");
            if (revisions.getOrDefault(milestone.getId(), 0L) >= 3)
                add(
                        result,
                        "EXCESSIVE_REVISIONS",
                        "EXCESSIVE_REVISIONS",
                        milestone.getId(),
                        RiskAlert.Severity.MEDIUM,
                        "Milestone has at least three submissions requiring revision.");
        }
        if (a.getStatus() == Assignment.Status.ACTIVE)
            scopes.findByAssignment_IdAndStatus(a.getId(), ScopeVersion.Status.LOCKED)
                    .ifPresent(
                            scope -> {
                                long remaining =
                                        ChronoUnit.DAYS.between(today, scope.getDeadline());
                                if (remaining >= 0 && remaining <= 3)
                                    add(
                                            result,
                                            "DEADLINE_APPROACHING",
                                            "DEADLINE_APPROACHING:SCOPE:" + scope.getId(),
                                            null,
                                            RiskAlert.Severity.MEDIUM,
                                            "Locked Scope deadline is "
                                                    + remaining
                                                    + " UTC days away.");
                            });
        var requests =
                changes.findByAssignment_Id(a.getId()).stream()
                        .filter(
                                c ->
                                        c.getStatus() == ChangeRequest.Status.PENDING
                                                || c.getStatus() == ChangeRequest.Status.APPROVED)
                        .toList();
        Map<Long, ScopeVersion> bases = new HashMap<>();
        scopes.findAllById(
                        requests.stream()
                                .map(ChangeRequest::getBaseScopeVersionId)
                                .distinct()
                                .toList())
                .forEach(s -> bases.put(s.getId(), s));
        for (var change : requests) {
            ScopeVersion base = bases.get(change.getBaseScopeVersionId());
            if (change.getBudgetDelta()
                                    .abs()
                                    .compareTo(base.getBudget().multiply(new BigDecimal("0.20")))
                            >= 0
                    || Math.abs((long) change.getDaysDelta()) >= 7)
                add(
                        result,
                        "LARGE_SCOPE_CHANGE",
                        "LARGE_SCOPE_CHANGE:CR:" + change.getId(),
                        null,
                        RiskAlert.Severity.HIGH,
                        "Change Request reaches 20% of base budget or seven days of deadline change.");
        }
        return result;
    }

    private void add(
            Map<Key, Candidate> result,
            String type,
            String code,
            Long milestoneId,
            RiskAlert.Severity severity,
            String explanation) {
        Key key = new Key(type, code, milestoneId);
        result.put(key, new Candidate(key, severity, explanation));
    }

    private Key key(RiskAlert risk) {
        return new Key(risk.getRiskType(), risk.getRuleCode(), risk.getMilestoneId());
    }

    private boolean managed(RiskAlert r) {
        return switch (r.getRiskType()) {
            case "MILESTONE_OVERDUE", "EXCESSIVE_REVISIONS" ->
                    r.getRiskType().equals(r.getRuleCode()) && r.getMilestoneId() != null;
            case "DEADLINE_APPROACHING" ->
                    r.getRuleCode().startsWith("DEADLINE_APPROACHING:SCOPE:");
            case "LARGE_SCOPE_CHANGE" -> r.getRuleCode().startsWith("LARGE_SCOPE_CHANGE:CR:");
            default -> false;
        };
    }

    private Detail detail(RiskAlert r) {
        return new Detail(
                r.getId(),
                r.getAssignment().getId(),
                r.getMilestoneId(),
                r.getRiskType(),
                r.getSeverity(),
                r.getTitle(),
                r.getDescription(),
                r.getRuleCode(),
                r.getStatus(),
                r.getDetectedAt(),
                r.getResolvedAt());
    }

    private Instant now() {
        return clock.instant().truncatedTo(ChronoUnit.MILLIS);
    }

    private void event(AuthPrincipal actor, RiskAlert risk, String action) {
        AuditLog log = new AuditLog();
        log.setActor(users.getReferenceById(actor.userId()));
        log.setEntityType("risk_alerts");
        log.setEntityId(risk.getId());
        log.setAction(action);
        log.setCreatedAt(now());
        log.setRequestId(UUID.randomUUID());
        audit.save(log);
    }

    private static ApiException missing() {
        return new ApiException(
                HttpStatus.NOT_FOUND,
                "RISK_ALERT_NOT_FOUND",
                "Risk Alert or Assignment not found.");
    }

    private static ApiException conflict(String text) {
        return new ApiException(HttpStatus.CONFLICT, "RISK_ALERT_CONFLICT", text);
    }
}
