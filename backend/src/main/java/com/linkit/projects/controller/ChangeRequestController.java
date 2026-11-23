package com.linkit.projects.controller;

import com.linkit.auth.security.AuthPrincipal;
import com.linkit.projects.dto.ChangeRequestDtos.*;
import com.linkit.projects.service.ChangeRequestService;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.net.URI;

@RestController
public class ChangeRequestController {
    private final ChangeRequestService changes;

    public ChangeRequestController(ChangeRequestService changes) {
        this.changes = changes;
    }

    @GetMapping("/api/assignments/{id}/change-requests")
    Page list(
            @AuthenticationPrincipal AuthPrincipal actor,
            @PathVariable @Positive Long id,
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size) {
        return changes.list(actor, id, page, size);
    }

    @PostMapping("/api/assignments/{id}/change-requests")
    ResponseEntity<Detail> create(
            @AuthenticationPrincipal AuthPrincipal actor,
            @PathVariable @Positive Long id,
            @Valid @RequestBody Create input) {
        Detail value = changes.create(actor, id, input);
        return ResponseEntity.created(URI.create("/api/change-requests/" + value.id()))
                .cacheControl(CacheControl.noStore())
                .eTag(value.version())
                .body(value);
    }

    @GetMapping("/api/change-requests/{id}")
    ResponseEntity<Detail> get(
            @AuthenticationPrincipal AuthPrincipal actor, @PathVariable @Positive Long id) {
        return response(changes.get(actor, id));
    }

    @PostMapping("/api/change-requests/{id}/decisions")
    ResponseEntity<Detail> decide(
            @AuthenticationPrincipal AuthPrincipal actor,
            @PathVariable @Positive Long id,
            @Valid @RequestBody Decide input,
            @RequestHeader(value = "If-Match", required = false) String expected) {
        return response(changes.decide(actor, id, input, expected));
    }

    @PostMapping("/api/change-requests/{id}/apply")
    ResponseEntity<Detail> apply(
            @AuthenticationPrincipal AuthPrincipal actor,
            @PathVariable @Positive Long id,
            @RequestHeader(value = "If-Match", required = false) String expected) {
        return response(changes.apply(actor, id, expected));
    }

    private ResponseEntity<Detail> response(Detail value) {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .eTag(value.version())
                .body(value);
    }
}
