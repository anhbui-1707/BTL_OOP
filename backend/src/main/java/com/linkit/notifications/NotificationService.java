package com.linkit.notifications;

import com.linkit.auth.security.AuthPrincipal;
import com.linkit.common.ApiException;

import org.springframework.data.domain.*;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.temporal.ChronoUnit;

@Service
@PreAuthorize("hasAnyRole('ADMIN','CLIENT','FREELANCER')")
@Transactional(readOnly = true)
public class NotificationService {
    private final NotificationRepository repository;
    private final Clock clock;

    public NotificationService(NotificationRepository repository, Clock clock) {
        this.repository = repository;
        this.clock = clock;
    }

    public NotificationDtos.Page list(AuthPrincipal actor, boolean unread, int page, int size) {
        var paging = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt", "id"));
        var result =
                unread
                        ? repository.findByRecipientIdAndReadAtIsNull(actor.userId(), paging)
                        : repository.findByRecipientId(actor.userId(), paging);
        return new NotificationDtos.Page(
                result.stream()
                        .map(
                                n ->
                                        new NotificationDtos.Item(
                                                n.getId(),
                                                n.getKind(),
                                                n.getTitle(),
                                                n.getDescription(),
                                                n.getResourceType(),
                                                n.getResourceId(),
                                                n.getJobId(),
                                                n.getSection(),
                                                n.getCreatedAt(),
                                                n.getReadAt()))
                        .toList(),
                result.getNumber(),
                result.getSize(),
                result.getTotalElements(),
                result.getTotalPages());
    }

    public NotificationDtos.Count count(AuthPrincipal actor) {
        return new NotificationDtos.Count(
                repository.countByRecipientIdAndReadAtIsNull(actor.userId()));
    }

    @Transactional
    public NotificationDtos.Count read(AuthPrincipal actor, Long id) {
        if (!repository.existsByIdAndRecipientId(id, actor.userId()))
            throw new ApiException(
                    HttpStatus.NOT_FOUND, "NOTIFICATION_NOT_FOUND", "Không tìm thấy thông báo.");
        repository.read(id, actor.userId(), clock.instant().truncatedTo(ChronoUnit.MILLIS));
        return count(actor);
    }

    @Transactional
    public NotificationDtos.Count readAll(AuthPrincipal actor) {
        repository.readAll(actor.userId(), clock.instant().truncatedTo(ChronoUnit.MILLIS));
        return count(actor);
    }
}
