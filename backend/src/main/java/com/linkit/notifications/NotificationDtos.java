package com.linkit.notifications;

import java.time.Instant;
import java.util.List;

public final class NotificationDtos {
    private NotificationDtos() {}

    public record Item(
            Long id,
            String kind,
            String title,
            String description,
            String resourceType,
            Long resourceId,
            Long jobId,
            String section,
            Instant createdAt,
            Instant readAt) {}

    public record Page(
            List<Item> content, int page, int size, long totalElements, int totalPages) {}

    public record Count(long unreadCount) {}
}
