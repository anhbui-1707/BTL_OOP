package com.linkit.projects.service;

import com.linkit.auth.security.AuthPrincipal;
import com.linkit.common.ApiException;
import com.linkit.identity.entity.UserRole.Role;
import com.linkit.projects.dto.AssignmentDtos.*;
import com.linkit.projects.entity.Assignment;
import com.linkit.projects.repository.AssignmentRepository;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

@Service
@Transactional(readOnly = true)
public class AssignmentService {
    private final AssignmentRepository assignments;

    public AssignmentService(AssignmentRepository assignments) {
        this.assignments = assignments;
    }

    public Detail get(AuthPrincipal actor, Long id) {
        Assignment value = assignments.findDetailedById(id).orElseThrow(AssignmentService::missing);
        if (!actor.roles().contains(Role.ADMIN)
                && !(actor.roles().contains(Role.CLIENT)
                        && Objects.equals(value.getClient().getUserId(), actor.userId()))
                && !(actor.roles().contains(Role.FREELANCER)
                        && Objects.equals(value.getFreelancer().getUserId(), actor.userId())))
            throw missing();
        return detail(value);
    }

    public Page list(AuthPrincipal actor, Assignment.Status status, int page, int size) {
        Specification<Assignment> specification =
                (root, query, cb) -> {
                    var conditions = new ArrayList<jakarta.persistence.criteria.Predicate>();
                    if (!actor.roles().contains(Role.ADMIN)) {
                        var allowed = new ArrayList<jakarta.persistence.criteria.Predicate>();
                        if (actor.roles().contains(Role.CLIENT))
                            allowed.add(cb.equal(root.get("client").get("userId"), actor.userId()));
                        if (actor.roles().contains(Role.FREELANCER))
                            allowed.add(
                                    cb.equal(root.get("freelancer").get("userId"), actor.userId()));
                        conditions.add(
                                cb.or(
                                        allowed.toArray(
                                                jakarta.persistence.criteria.Predicate[]::new)));
                    }
                    if (status != null) conditions.add(cb.equal(root.get("status"), status));
                    return cb.and(
                            conditions.toArray(jakarta.persistence.criteria.Predicate[]::new));
                };
        var values =
                assignments.findAll(
                        specification,
                        PageRequest.of(
                                page, size, Sort.by(Sort.Direction.DESC, "createdAt", "id")));
        return new Page(
                values.stream().map(AssignmentService::detail).toList(),
                values.getNumber(),
                values.getSize(),
                values.getTotalElements(),
                values.getTotalPages());
    }

    public static Detail detail(Assignment value) {
        return new Detail(
                value.getId(),
                value.getJobId(),
                value.getJob().getTitle(),
                value.getProposalId(),
                value.getClient().getUserId(),
                value.getClient().getCompanyName(),
                value.getFreelancer().getUserId(),
                value.getFreelancer().getUser().getFullName(),
                value.getAgreedBudget(),
                value.getCurrencyCode(),
                value.getStatus(),
                value.getCreatedAt(),
                value.getStartedAt(),
                value.getCompletedAt(),
                Base64.getEncoder().encodeToString(value.getRowVer()));
    }

    private static ApiException missing() {
        return new ApiException(
                HttpStatus.NOT_FOUND, "ASSIGNMENT_NOT_FOUND", "Không tìm thấy Assignment.");
    }
}
