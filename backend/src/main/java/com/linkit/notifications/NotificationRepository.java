package com.linkit.notifications;

import org.springframework.data.domain.*;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;

public interface NotificationRepository extends JpaRepository<Notification, Long> {
    Page<Notification> findByRecipientId(Long recipientId, Pageable page);

    Page<Notification> findByRecipientIdAndReadAtIsNull(Long recipientId, Pageable page);

    long countByRecipientIdAndReadAtIsNull(Long recipientId);

    boolean existsByIdAndRecipientId(Long id, Long recipientId);

    boolean existsBySourceAuditIdAndRecipientIdAndKind(
            Long sourceAuditId, Long recipientId, String kind);

    @Modifying
    @Query(
            "update Notification n set n.readAt=case when n.createdAt>:now then n.createdAt else :now end where n.id=:id and n.recipientId=:owner and n.readAt is null")
    int read(@Param("id") Long id, @Param("owner") Long owner, @Param("now") Instant now);

    @Modifying
    @Query(
            "update Notification n set n.readAt=case when n.createdAt>:now then n.createdAt else :now end where n.recipientId=:owner and n.readAt is null")
    int readAll(@Param("owner") Long owner, @Param("now") Instant now);

    @Query(
            value =
                    "select last_audit_id from dbo.notification_delivery_cursor with(updlock,holdlock) where id=1",
            nativeQuery = true)
    Long lockCursor();

    @Modifying
    @Query(
            value = "insert into dbo.notification_delivery_receipts(source_audit_id) values(:id)",
            nativeQuery = true)
    int acknowledge(@Param("id") long id);

    @Query(
            value =
                    "select top (200) a.id from dbo.audit_logs a with(readcommittedlock) where a.id>:after and not exists (select 1 from dbo.notification_delivery_receipts d where d.source_audit_id=a.id) order by a.id",
            nativeQuery = true)
    List<Long> committedAuditIds(@Param("after") long after);
}
