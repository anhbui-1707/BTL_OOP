package com.linkit.admin.service;

import com.linkit.admin.dto.AdminDtos.*;
import com.linkit.admin.repository.AdminRepository;
import com.linkit.audit.entity.AuditLog;
import com.linkit.audit.repository.AuditLogRepository;
import com.linkit.auth.security.AuthPrincipal;
import com.linkit.common.ApiException;
import com.linkit.identity.entity.User;
import com.linkit.identity.entity.UserRole.Role;
import com.linkit.identity.repository.UserRepository;
import com.linkit.proposals.entity.Proposal;

import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.temporal.ChronoUnit;
import java.util.*;

@Service
@PreAuthorize("hasRole('ADMIN')")
@Transactional(readOnly = true)
public class AdminService {
    private final AdminRepository repository;
    private final UserRepository users;
    private final AuditLogRepository audit;
    private final Clock clock;

    public AdminService(
            AdminRepository repository,
            UserRepository users,
            AuditLogRepository audit,
            Clock clock) {
        this.repository = repository;
        this.users = users;
        this.audit = audit;
        this.clock = clock;
    }

    private static <T, R> Page<R> mapped(Page<T> page, java.util.function.Function<T, R> mapper) {
        return new Page<>(
                page.content().stream().map(mapper).toList(),
                page.page(),
                page.size(),
                page.totalElements(),
                page.totalPages());
    }

    private static UserView userView(User user) {
        return new UserView(
                user.getId(),
                user.getFullName(),
                user.getEmail(),
                user.getAvatarUrl(),
                user.getRoles().stream().map(r -> r.getId().getRole()).sorted().toList(),
                user.getStatus(),
                user.getCreatedAt(),
                Base64.getEncoder().encodeToString(user.getRowVer()));
    }

    private User managedUser(Long id) {
        User user = users.findWithRolesById(id).orElseThrow(AdminService::missing);
        if (user.getRoles().stream().anyMatch(r -> r.getId().getRole() == Role.ADMIN)
                || user.getRoles().stream()
                        .noneMatch(
                                r ->
                                        r.getId().getRole() == Role.CLIENT
                                                || r.getId().getRole() == Role.FREELANCER))
            throw missing();
        return user;
    }

    public Page<UserView> users(String keyword, Role role, User.Status status, int page, int size) {
        if (role == Role.ADMIN)
            throw new ApiException(
                    HttpStatus.UNPROCESSABLE_ENTITY,
                    "INVALID_ROLE",
                    "Trang này chỉ quản lý Client và Freelancer.");
        return mapped(repository.users(keyword, role, status, page, size), AdminService::userView);
    }

    public UserView user(Long id) {
        return userView(managedUser(id));
    }

    @Transactional
    public UserView setLocked(AuthPrincipal actor, Long id, boolean locked, String expected) {
        if (Objects.equals(actor.userId(), id))
            throw new ApiException(
                    HttpStatus.FORBIDDEN,
                    "SELF_LOCK_FORBIDDEN",
                    "Không thể thay đổi trạng thái tài khoản của chính mình.");
        User user = managedUser(id);
        if (expected == null || expected.isBlank())
            throw new ApiException(
                    HttpStatus.PRECONDITION_REQUIRED,
                    "VERSION_REQUIRED",
                    "Cần phiên bản tài khoản để cập nhật an toàn.");
        if (!expected.equals('"' + Base64.getEncoder().encodeToString(user.getRowVer()) + '"'))
            throw new ApiException(
                    HttpStatus.PRECONDITION_FAILED,
                    "STALE_VERSION",
                    "Tài khoản đã thay đổi. Hãy tải lại trước khi thao tác.");
        if (user.getStatus() == User.Status.DISABLED)
            throw new ApiException(
                    HttpStatus.CONFLICT,
                    "INVALID_STATUS",
                    "Không thể khóa/mở tài khoản đã vô hiệu hóa.");
        User.Status target = locked ? User.Status.LOCKED : User.Status.ACTIVE;
        if (user.getStatus() == target) return userView(user);
        var now = clock.instant().truncatedTo(ChronoUnit.MILLIS);
        String before = user.getStatus().name();
        user.setStatus(target);
        user.setUpdatedAt(now);
        users.saveAndFlush(user);
        if (locked) repository.revokeSessions(id, now);
        AuditLog event = new AuditLog();
        event.setActor(users.getReferenceById(actor.userId()));
        event.setEntityType("users");
        event.setEntityId(id);
        event.setAction(locked ? "ADMIN_USER_LOCKED" : "ADMIN_USER_UNLOCKED");
        event.setBeforeJson("{\"status\":\"" + before + "\"}");
        event.setAfterJson("{\"status\":\"" + target.name() + "\"}");
        event.setCreatedAt(now);
        audit.save(event);
        return userView(user);
    }

    private static ProposalView proposalView(Proposal value) {
        var client = value.getJob().getClient();
        return new ProposalView(
                value.getId(),
                value.getJobId(),
                value.getJob().getTitle(),
                client.getUserId(),
                client.getCompanyName() == null || client.getCompanyName().isBlank()
                        ? client.getUser().getFullName()
                        : client.getCompanyName(),
                value.getFreelancerId(),
                value.getFreelancer().getUser().getFullName(),
                value.getProposedBudget(),
                value.getJob().getCurrencyCode(),
                value.getEstimatedDays(),
                value.getStatus(),
                value.getSubmittedAt());
    }

    public Page<ProposalView> proposals(
            String keyword, Proposal.Status status, int page, int size) {
        return mapped(
                repository.proposals(keyword, status, page, size), AdminService::proposalView);
    }

    public ProposalDetail proposal(Long id) {
        Proposal value = repository.proposal(id).orElseThrow(AdminService::missing);
        return new ProposalDetail(proposalView(value), value.getCoverLetter());
    }

    public Page<Activity> activities(String keyword, String action, int page, int size) {
        return mapped(
                repository.activities(keyword, action, page, size),
                value ->
                        new Activity(
                                value.getId(),
                                value.getActor() == null ? null : value.getActor().getId(),
                                value.getActor() == null
                                        ? "Hệ thống"
                                        : value.getActor().getFullName(),
                                value.getAction(),
                                value.getEntityType(),
                                value.getEntityId(),
                                value.getCreatedAt()));
    }

    private static long total(Map<String, Long> values) {
        return values.values().stream().mapToLong(Long::longValue).sum();
    }

    public Stats stats() {
        var jobs = repository.counts("Job");
        var proposals = repository.counts("Proposal");
        var projects = repository.counts("Assignment");
        return new Stats(
                repository.totalUsers(),
                total(jobs),
                total(proposals),
                projects.getOrDefault("ACTIVE", 0L),
                repository.usersByRole(),
                jobs,
                proposals,
                projects);
    }

    private static ApiException missing() {
        return new ApiException(
                HttpStatus.NOT_FOUND,
                "ADMIN_RESOURCE_NOT_FOUND",
                "Không tìm thấy dữ liệu quản trị.");
    }
}
