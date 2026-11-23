package com.linkit.projects.controller;

import com.linkit.auth.security.AuthPrincipal;
import com.linkit.projects.dto.FinalAcceptanceDtos.*;
import com.linkit.projects.service.FinalAcceptanceService;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Positive;

import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.net.URI;

@RestController
@RequestMapping("/api/assignments/{id}/final-acceptance")
public class FinalAcceptanceController {
    private final FinalAcceptanceService acceptances;

    public FinalAcceptanceController(FinalAcceptanceService acceptances) {
        this.acceptances = acceptances;
    }

    @GetMapping
    ResponseEntity<Status> get(
            @AuthenticationPrincipal AuthPrincipal actor, @PathVariable @Positive Long id) {
        Status value = acceptances.get(actor, id);
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .eTag(value.assignmentVersion())
                .body(value);
    }

    @PostMapping
    ResponseEntity<Status> accept(
            @AuthenticationPrincipal AuthPrincipal actor,
            @PathVariable @Positive Long id,
            @Valid @RequestBody(required = false) Accept input,
            @RequestHeader(value = "If-Match", required = false) String expected) {
        Status value = acceptances.accept(actor, id, input, expected);
        return ResponseEntity.created(URI.create("/api/assignments/" + id + "/final-acceptance"))
                .cacheControl(CacheControl.noStore())
                .eTag(value.assignmentVersion())
                .body(value);
    }
}
