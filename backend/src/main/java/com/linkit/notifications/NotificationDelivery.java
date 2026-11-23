package com.linkit.notifications;

import com.linkit.audit.entity.AuditLog;
import com.linkit.audit.repository.AuditLogRepository;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

@Service
public class NotificationDelivery {
    private final NotificationRepository notifications;
    private final AuditLogRepository audit;
    private final NotificationContextRepository context;

    public NotificationDelivery(
            NotificationRepository notifications,
            AuditLogRepository audit,
            NotificationContextRepository context) {
        this.notifications = notifications;
        this.audit = audit;
        this.context = context;
    }

    @Transactional
    public void deliverBatch() {
        Long cursor = notifications.lockCursor();
        if (cursor == null) throw new IllegalStateException("Notification migration is required");
        for (Long id : notifications.committedAuditIds(cursor)) {
            audit.findById(id).ifPresent(this::deliver);
            notifications.acknowledge(id);
        }
        notifications.flush();
    }

    private void send(
            AuditLog event,
            Long recipient,
            String kind,
            String title,
            String text,
            String type,
            Long resource,
            Long job,
            String section) {
        if (!notifications.existsBySourceAuditIdAndRecipientIdAndKind(
                event.getId(), recipient, kind))
            notifications.save(
                    new Notification(
                            recipient,
                            event.getId(),
                            kind,
                            title,
                            text,
                            type,
                            resource,
                            job,
                            section,
                            event.getCreatedAt()));
    }

    private void deliver(AuditLog e) {
        String action = e.getAction();
        Long id = e.getEntityId();
        if ("proposals".equals(e.getEntityType())
                && Set.of(
                                "PROPOSAL_SUBMITTED",
                                "PROPOSAL_ACCEPTED",
                                "PROPOSAL_REJECTED",
                                "PROPOSAL_REJECTED_AFTER_SELECTION")
                        .contains(action)) {
            Object[] p =
                    context.one(
                            "select p.job.clientId,p.freelancerId,p.jobId,p.job.title,p.freelancer.user.fullName from Proposal p where p.id=:id",
                            id);
            if (p == null) return;
            boolean submitted = action.equals("PROPOSAL_SUBMITTED");
            boolean accepted = action.equals("PROPOSAL_ACCEPTED");
            send(
                    e,
                    (Long) p[submitted ? 0 : 1],
                    action,
                    submitted
                            ? "Có đề xuất ứng tuyển mới"
                            : accepted ? "Đề xuất đã được chấp nhận" : "Đề xuất chưa được lựa chọn",
                    submitted
                            ? p[4] + " đã gửi đề xuất cho “" + p[3] + "”."
                            : "Đề xuất cho “"
                                    + p[3]
                                    + "” "
                                    + (accepted
                                            ? "đã được Client chấp nhận."
                                            : "đã được Client từ chối."),
                    submitted ? "JOB_PROPOSAL" : "PROPOSAL",
                    id,
                    (Long) p[2],
                    null);
        } else if ("scope_versions".equals(e.getEntityType()) && action.equals("SCOPE_APPROVED")) {
            Object[] scope =
                    context.one(
                            "select s.assignment.client.userId,s.assignment.freelancer.userId,s.assignment.id,s.assignment.jobId,s.assignment.job.title from ScopeVersion s where s.id=:id",
                            id);
            if (scope == null) return;

            if (Objects.equals(e.getActor().getId(), scope[0]))
                send(
                        e,
                        (Long) scope[1],
                        "SCOPE_APPROVAL_REQUESTED",
                        "Phạm vi dự án chờ bạn xác nhận",
                        "Client đã gửi và xác nhận phạm vi dự án “"
                                + scope[4]
                                + "”. Hãy xem sản phẩm, lịch bàn giao và tiêu chí nghiệm thu.",
                        "ASSIGNMENT",
                        (Long) scope[2],
                        (Long) scope[3],
                        "scope");
        } else if ("scope_versions".equals(e.getEntityType()) && action.equals("SCOPE_LOCKED")) {
            Object[] scope =
                    context.one(
                            "select s.assignment.client.userId,s.assignment.freelancer.userId,s.assignment.id,s.assignment.jobId,s.assignment.job.title from ScopeVersion s where s.id=:id",
                            id);
            if (scope != null) {
                send(
                        e,
                        (Long) scope[0],
                        "SCOPE_LOCKED",
                        "Phạm vi dự án đã thống nhất",
                        "Hai bên đã xác nhận phạm vi dự án “"
                                + scope[4]
                                + "”. Có thể bắt đầu triển khai các mốc.",
                        "ASSIGNMENT",
                        (Long) scope[2],
                        (Long) scope[3],
                        "milestones");
                send(
                        e,
                        (Long) scope[1],
                        "SCOPE_LOCKED",
                        "Dự án sẵn sàng triển khai",
                        "Phạm vi dự án “"
                                + scope[4]
                                + "” đã được chốt. Bạn có thể theo dõi và nộp sản phẩm theo mốc.",
                        "ASSIGNMENT",
                        (Long) scope[2],
                        (Long) scope[3],
                        "milestones");
            }
        } else if ("assignments".equals(e.getEntityType()) && action.equals("ASSIGNMENT_CREATED")) {
            Object[] a =
                    context.one(
                            "select a.freelancer.userId,a.jobId,a.job.title from Assignment a where a.id=:id",
                            id);
            if (a != null)
                send(
                        e,
                        (Long) a[0],
                        action,
                        "Bạn được giao dự án mới",
                        "Dự án “" + a[2] + "” đã được tạo. Hai bên cần thống nhất phạm vi.",
                        "ASSIGNMENT",
                        id,
                        (Long) a[1],
                        "scope");
        } else if ("milestone_submissions".equals(e.getEntityType())
                && Set.of(
                                "MILESTONE_SUBMITTED",
                                "MILESTONE_APPROVED",
                                "MILESTONE_REVISION_REQUIRED")
                        .contains(action)) {
            Object[] m =
                    context.one(
                            "select s.milestone.assignment.id,s.milestone.assignment.client.userId,s.milestone.assignment.freelancer.userId,s.milestone.assignment.jobId,s.milestone.title from MilestoneSubmission s where s.id=:id",
                            id);
            if (m == null) return;
            boolean submitted = action.equals("MILESTONE_SUBMITTED");
            boolean approved = action.equals("MILESTONE_APPROVED");
            send(
                    e,
                    (Long) m[submitted ? 1 : 2],
                    action,
                    submitted
                            ? "Có mốc bàn giao cần xem xét"
                            : approved
                                    ? "Mốc bàn giao đã được duyệt"
                                    : "Mốc bàn giao cần chỉnh sửa",
                    "Mốc “"
                            + m[4]
                            + "” "
                            + (submitted
                                    ? "đã có bài nộp mới."
                                    : approved
                                            ? "đã được Client duyệt."
                                            : "được Client yêu cầu chỉnh sửa."),
                    "ASSIGNMENT",
                    (Long) m[0],
                    (Long) m[3],
                    "milestones");
            if (approved && context.requiredMilestonesApproved((Long) m[0]))
                send(
                        e,
                        (Long) m[1],
                        "FINAL_ACCEPTANCE_READY",
                        "Kiểm tra nghiệm thu dự án",
                        "Các mốc bắt buộc của phạm vi hiện tại đã được duyệt. Hãy kiểm tra các điều kiện nghiệm thu còn lại.",
                        "ASSIGNMENT",
                        (Long) m[0],
                        (Long) m[3],
                        "acceptance");
        } else if ("reviews".equals(e.getEntityType()) && action.equals("REVIEW_CREATED")) {
            Object[] r =
                    context.one(
                            "select r.freelancer.userId,r.finalAcceptance.assignment.id,r.finalAcceptance.assignment.jobId,r.finalAcceptance.assignment.job.title from Review r where r.id=:id",
                            id);
            if (r != null)
                send(
                        e,
                        (Long) r[0],
                        action,
                        "Bạn nhận được đánh giá mới",
                        "Client đã đánh giá dự án “" + r[3] + "”.",
                        "ASSIGNMENT",
                        (Long) r[1],
                        (Long) r[2],
                        "acceptance");
        } else if ("users".equals(e.getEntityType())
                && Set.of("ADMIN_USER_LOCKED", "ADMIN_USER_UNLOCKED").contains(action)) {
            String target = context.userName(id);
            if (target == null) return;
            var admins = context.activeAdmins();
            for (Long admin : admins)
                send(
                        e,
                        admin,
                        action,
                        "Trạng thái tài khoản được cập nhật",
                        target
                                + " "
                                + (action.equals("ADMIN_USER_LOCKED")
                                        ? "đã bị khóa."
                                        : "đã được mở khóa."),
                        "USER",
                        id,
                        null,
                        null);
        }
    }
}
