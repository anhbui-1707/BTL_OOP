package com.linkit.projects.controller;

import com.linkit.auth.security.AuthPrincipal;
import com.linkit.projects.dto.ScopeDtos.*;
import com.linkit.projects.service.ScopeService;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.net.URI;

@RestController
public class ScopeController {
    private final ScopeService scopes;

    public ScopeController(ScopeService scopes) {
        this.scopes = scopes;
    }

    @GetMapping("/api/assignments/{id}/scopes")
    Page list(
            @AuthenticationPrincipal AuthPrincipal actor,
            @PathVariable @Positive Long id,
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size) {
        return scopes.list(actor, id, page, size);
    }

    @PostMapping("/api/assignments/{id}/scopes")
    ResponseEntity<Detail> create(
            @AuthenticationPrincipal AuthPrincipal actor,
            @PathVariable @Positive Long id,
            @Valid @RequestBody Create input,
            @RequestHeader(value = "If-Match", required = false) String version) {
        Detail value = scopes.create(actor, id, input, version);
        return ResponseEntity.created(URI.create("/api/scopes/" + value.id()))
                .cacheControl(CacheControl.noStore())
                .eTag(value.assignmentVersion())
                .body(value);
    }

    @GetMapping("/api/scopes/{id}")
    ResponseEntity<Detail> get(
            @AuthenticationPrincipal AuthPrincipal actor, @PathVariable @Positive Long id) {
        return response(scopes.get(actor, id));
    }

    @PostMapping("/api/scopes/{id}/submit")
    ResponseEntity<Detail> submit(
            @AuthenticationPrincipal AuthPrincipal actor,
            @PathVariable @Positive Long id,
            @RequestHeader(value = "If-Match", required = false) String version) {
        return response(scopes.submit(actor, id, version));
    }

    @PostMapping("/api/scopes/{id}/approve")
    ResponseEntity<Detail> approve(
            @AuthenticationPrincipal AuthPrincipal actor,
            @PathVariable @Positive Long id,
            @RequestHeader(value = "If-Match", required = false) String version) {
        return response(scopes.approve(actor, id, version));
    }

    private ResponseEntity<Detail> response(Detail value) {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .eTag(value.assignmentVersion())
                .body(value);
    }
}
