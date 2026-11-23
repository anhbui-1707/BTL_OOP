package com.linkit.notifications;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;

@Configuration
@EnableScheduling
public class NotificationDispatcher {
    private static final Logger log = LoggerFactory.getLogger(NotificationDispatcher.class);
    private final NotificationDelivery delivery;

    public NotificationDispatcher(NotificationDelivery delivery) {
        this.delivery = delivery;
    }

    @Scheduled(
            fixedDelayString = "${linkit.notifications.dispatch-delay-ms:30000}",
            initialDelayString = "${linkit.notifications.initial-delay-ms:5000}")
    public void dispatch() {
        try {
            delivery.deliverBatch();
        } catch (Exception error) {
            log.warn(
                    "Notification delivery deferred; next run will retry ({})",
                    error.getClass().getSimpleName());
        }
    }
}
