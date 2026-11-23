package com.linkit.notifications;

import com.linkit.auth.security.AuthPrincipal;

import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.constraints.*;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/notifications")
@PreAuthorize("hasAnyRole('ADMIN','CLIENT','FREELANCER')")
public class NotificationController {
    private final NotificationService service;

    public NotificationController(NotificationService service) {
        this.service = service;
    }

    @ModelAttribute
    public void noCache(HttpServletResponse response) {
        response.setHeader("Cache-Control", "no-store");
    }

    @GetMapping
    public NotificationDtos.Page list(
            @AuthenticationPrincipal AuthPrincipal actor,
            @RequestParam(defaultValue = "false") boolean unreadOnly,
            @RequestParam(defaultValue = "0") @Min(0) @Max(1000000) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size) {
        return service.list(actor, unreadOnly, page, size);
    }

    @GetMapping("/unread-count")
    public NotificationDtos.Count count(@AuthenticationPrincipal AuthPrincipal actor) {
        return service.count(actor);
    }

    @PatchMapping("/{id}/read")
    public NotificationDtos.Count read(
            @AuthenticationPrincipal AuthPrincipal actor, @PathVariable @Positive Long id) {
        return service.read(actor, id);
    }

    @PatchMapping("/read-all")
    public NotificationDtos.Count readAll(@AuthenticationPrincipal AuthPrincipal actor) {
        return service.readAll(actor);
    }
}
