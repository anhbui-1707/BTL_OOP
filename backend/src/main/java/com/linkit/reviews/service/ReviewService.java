package com.linkit.reviews.service;

import com.linkit.audit.entity.AuditLog;
import com.linkit.audit.repository.AuditLogRepository;
import com.linkit.auth.security.AuthPrincipal;
import com.linkit.common.ApiException;
import com.linkit.identity.entity.UserRole.Role;
import com.linkit.identity.repository.UserRepository;
import com.linkit.jobs.entity.Job;
import com.linkit.projects.entity.Assignment;
import com.linkit.projects.repository.*;
import com.linkit.reviews.dto.ReviewDtos.*;
import com.linkit.reviews.entity.Review;
import com.linkit.reviews.repository.ReviewRepository;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.*;

@Service
@Transactional(readOnly = true)
public class ReviewService {
    private final AssignmentRepository assignments;
    private final FinalAcceptanceRepository acceptances;
    private final ReviewRepository reviews;
    private final UserRepository users;
    private final AuditLogRepository audit;
    private final Clock clock;

    public ReviewService(
            AssignmentRepository assignments,
            FinalAcceptanceRepository acceptances,
            ReviewRepository reviews,
            UserRepository users,
            AuditLogRepository audit,
            Clock clock) {
        this.assignments = assignments;
        this.acceptances = acceptances;
        this.reviews = reviews;
        this.users = users;
        this.audit = audit;
        this.clock = clock;
    }

    public Detail get(AuthPrincipal actor, Long id) {
        Assignment a = assignments.findById(id).orElseThrow(ReviewService::missing);
        access(actor, a, false);
        return detail(
                reviews.findByFinalAcceptance_AssignmentId(id).orElseThrow(ReviewService::missing),
                a);
    }

    @Transactional
    public Detail create(AuthPrincipal actor, Long id, Create input) {
        Assignment a = assignments.findForScope(id).orElseThrow(ReviewService::missing);
        access(actor, a, true);
        if (a.getStatus() != Assignment.Status.COMPLETED
                || a.getJob().getStatus() != Job.Status.COMPLETED)
            throw conflict("Assignment and Job must be COMPLETED before review.");
        var accepted =
                acceptances
                        .findByAssignment_Id(id)
                        .orElseThrow(() -> conflict("Final Acceptance must exist before review."));
        if (reviews.existsByFinalAcceptance_AssignmentId(id))
            throw conflict("Assignment already has a Review.");
        Review value = new Review();
        value.setFinalAcceptance(accepted);
        value.setReviewer(users.getReferenceById(actor.userId()));
        value.setFreelancer(a.getFreelancer());
        value.setOverallRating(input.overallRating().shortValueExact());
        value.setQualityRating(input.qualityRating().shortValueExact());
        value.setCommunicationRating(input.communicationRating().shortValueExact());
        value.setTimelinessRating(input.timelinessRating().shortValueExact());
        value.setComment(input.comment() == null ? null : input.comment().strip());
        value.setCreatedAt(clock.instant().truncatedTo(ChronoUnit.MILLIS));
        reviews.saveAndFlush(value);
        AuditLog log = new AuditLog();
        log.setActor(users.getReferenceById(actor.userId()));
        log.setEntityType("reviews");
        log.setEntityId(value.getId());
        log.setAction("REVIEW_CREATED");
        log.setCreatedAt(value.getCreatedAt());
        log.setRequestId(UUID.randomUUID());
        audit.save(log);
        audit.flush();
        return detail(value, a);
    }

    private void access(AuthPrincipal actor, Assignment a, boolean create) {
        if (!create && actor.roles().contains(Role.ADMIN)) return;
        if (actor.roles().contains(Role.CLIENT)
                && Objects.equals(actor.userId(), a.getClient().getUserId())) return;
        if (!create
                && actor.roles().contains(Role.FREELANCER)
                && Objects.equals(actor.userId(), a.getFreelancer().getUserId())) return;
        throw missing();
    }

    private Detail detail(Review value, Assignment a) {
        return new Detail(
                value.getId(),
                a.getId(),
                value.getReviewer().getId(),
                value.getFreelancer().getUserId(),
                value.getOverallRating(),
                value.getQualityRating(),
                value.getCommunicationRating(),
                value.getTimelinessRating(),
                value.getComment(),
                value.getCreatedAt());
    }

    private static ApiException missing() {
        return new ApiException(
                HttpStatus.NOT_FOUND, "REVIEW_NOT_FOUND", "Review or Assignment not found.");
    }

    private static ApiException conflict(String text) {
        return new ApiException(HttpStatus.CONFLICT, "REVIEW_CONFLICT", text);
    }
}
