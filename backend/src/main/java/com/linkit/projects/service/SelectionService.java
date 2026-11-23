package com.linkit.projects.service;

import com.linkit.audit.entity.AuditLog;
import com.linkit.audit.repository.AuditLogRepository;
import com.linkit.auth.security.AuthPrincipal;
import com.linkit.common.ApiException;
import com.linkit.identity.entity.UserRole.Role;
import com.linkit.identity.repository.*;
import com.linkit.jobs.entity.Job;
import com.linkit.jobs.repository.JobRepository;
import com.linkit.matching.service.MatchingService;
import com.linkit.projects.dto.AssignmentDtos.Detail;
import com.linkit.projects.entity.Assignment;
import com.linkit.projects.repository.AssignmentRepository;
import com.linkit.proposals.entity.Proposal;
import com.linkit.proposals.repository.ProposalRepository;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.*;

@Service
public class SelectionService {
    private final ProposalRepository proposals;
    private final JobRepository jobs;
    private final AssignmentRepository assignments;
    private final FreelancerProfileRepository freelancers;
    private final UserRepository users;
    private final AuditLogRepository audit;
    private final MatchingService matching;
    private final Clock clock;

    public SelectionService(
            ProposalRepository proposals,
            JobRepository jobs,
            AssignmentRepository assignments,
            FreelancerProfileRepository freelancers,
            UserRepository users,
            AuditLogRepository audit,
            MatchingService matching,
            Clock clock) {
        this.proposals = proposals;
        this.jobs = jobs;
        this.assignments = assignments;
        this.freelancers = freelancers;
        this.users = users;
        this.audit = audit;
        this.matching = matching;
        this.clock = clock;
    }

    @Transactional
    public Detail select(AuthPrincipal actor, Long proposalId, String expected) {
        if (!actor.roles().contains(Role.CLIENT))
            throw new ApiException(
                    HttpStatus.FORBIDDEN,
                    "FORBIDDEN",
                    "Chỉ CLIENT sở hữu Job được chọn Freelancer.");
        Long jobId =
                proposals
                        .findJobIdById(proposalId)
                        .orElseThrow(
                                () ->
                                        new ApiException(
                                                HttpStatus.NOT_FOUND,
                                                "PROPOSAL_NOT_FOUND",
                                                "Không tìm thấy Proposal."));
        Job job =
                jobs.findForUpdate(jobId)
                        .orElseThrow(
                                () ->
                                        new ApiException(
                                                HttpStatus.NOT_FOUND,
                                                "JOB_NOT_FOUND",
                                                "Không tìm thấy Job."));
        if (!Objects.equals(job.getClientId(), actor.userId()))
            throw new ApiException(HttpStatus.FORBIDDEN, "FORBIDDEN", "Bạn không sở hữu Job này.");
        if (job.getStatus() != Job.Status.OPEN || assignments.existsByJobId(jobId))
            throw conflict("Job không còn OPEN hoặc đã có Assignment.");
        Proposal selected = proposals.findById(proposalId).orElseThrow();
        match(selected, expected);
        if (selected.getStatus() != Proposal.Status.PENDING
                || proposals.countAssignments(proposalId) > 0)
            throw conflict("Chỉ Proposal PENDING chưa được chọn mới hợp lệ.");
        var freelancer =
                freelancers
                        .findForSelection(selected.getFreelancerId())
                        .orElseThrow(() -> conflict("Freelancer không hợp lệ."));
        if (!MatchingService.invalidReasons(job, selected, freelancer).isEmpty())
            throw conflict("Freelancer hoặc Proposal không còn hợp lệ để lựa chọn.");
        Instant now = clock.instant().truncatedTo(ChronoUnit.MILLIS);
        selected.setStatus(Proposal.Status.ACCEPTED);
        selected.setUpdatedAt(now);
        for (Proposal other : proposals.findAllByJob_IdAndStatus(jobId, Proposal.Status.PENDING)) {
            if (Objects.equals(other.getId(), proposalId)) continue;
            other.setStatus(Proposal.Status.REJECTED);
            other.setUpdatedAt(now);
            event(actor, "proposals", other.getId(), "PROPOSAL_REJECTED_AFTER_SELECTION", now);
        }
        proposals.flush();
        Assignment value = new Assignment();
        value.setJob(job);
        value.setProposal(selected);
        value.setClient(job.getClient());
        value.setFreelancer(freelancer);
        value.setAgreedBudget(selected.getProposedBudget());
        value.setCurrencyCode(job.getCurrencyCode());
        value.setStatus(Assignment.Status.PENDING_SCOPE);
        value.setCreatedAt(now);
        assignments.saveAndFlush(value);
        job.setStatus(Job.Status.ASSIGNED);
        job.setUpdatedAt(now.isAfter(job.getUpdatedAt()) ? now : job.getUpdatedAt().plusMillis(1));
        jobs.flush();
        event(actor, "proposals", proposalId, "PROPOSAL_ACCEPTED", now);
        event(actor, "jobs", jobId, "JOB_ASSIGNED", now);
        event(actor, "assignments", value.getId(), "ASSIGNMENT_CREATED", now);
        audit.flush();
        return AssignmentService.detail(value);
    }

    private void event(AuthPrincipal actor, String type, Long id, String action, Instant now) {
        AuditLog value = new AuditLog();
        value.setActor(users.getReferenceById(actor.userId()));
        value.setEntityType(type);
        value.setEntityId(id);
        value.setAction(action);
        value.setCreatedAt(now);
        value.setRequestId(UUID.randomUUID());
        audit.save(value);
    }

    private void match(Proposal value, String expected) {
        if (expected == null)
            throw new ApiException(
                    HttpStatus.BAD_REQUEST, "IF_MATCH_REQUIRED", "Cần gửi If-Match của Proposal.");
        try {
            if (!expected.startsWith("\"") || !expected.endsWith("\""))
                throw new IllegalArgumentException();
            byte[] version =
                    Base64.getDecoder().decode(expected.substring(1, expected.length() - 1));
            if (version.length != 8) throw new IllegalArgumentException();
            if (!Arrays.equals(version, value.getRowVer()))
                throw conflict("Proposal đã thay đổi; hãy tải lại.");
        } catch (IllegalArgumentException error) {
            throw new ApiException(
                    HttpStatus.BAD_REQUEST, "INVALID_IF_MATCH", "If-Match không hợp lệ.");
        }
    }

    private static ApiException conflict(String message) {
        return new ApiException(HttpStatus.CONFLICT, "SELECTION_CONFLICT", message);
    }
}
