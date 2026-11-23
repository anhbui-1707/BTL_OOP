package com.linkit.projects.controller;

import com.linkit.auth.security.AuthPrincipal;
import com.linkit.projects.dto.MilestoneDtos.*;
import com.linkit.projects.service.MilestoneService;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.net.URI;

@RestController
public class MilestoneController {
    private final MilestoneService milestones;

    public MilestoneController(MilestoneService milestones) {
        this.milestones = milestones;
    }

    @GetMapping("/api/assignments/{id}/milestones")
    Page<Detail> list(
            @AuthenticationPrincipal AuthPrincipal actor,
            @PathVariable @Positive Long id,
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size) {
        return milestones.list(actor, id, page, size);
    }

    @PostMapping("/api/assignments/{id}/milestones")
    ResponseEntity<Detail> create(
            @AuthenticationPrincipal AuthPrincipal actor,
            @PathVariable @Positive Long id,
            @Valid @RequestBody Write input) {
        Detail value = milestones.create(actor, id, input);
        return ResponseEntity.created(URI.create("/api/milestones/" + value.id()))
                .cacheControl(CacheControl.noStore())
                .eTag(value.version())
                .body(value);
    }

    @GetMapping("/api/milestones/{id}")
    ResponseEntity<Detail> get(
            @AuthenticationPrincipal AuthPrincipal actor, @PathVariable @Positive Long id) {
        return detail(milestones.get(actor, id));
    }

    @PutMapping("/api/milestones/{id}")
    ResponseEntity<Detail> update(
            @AuthenticationPrincipal AuthPrincipal actor,
            @PathVariable @Positive Long id,
            @Valid @RequestBody Write input,
            @RequestHeader(value = "If-Match", required = false) String version) {
        return detail(milestones.update(actor, id, input, version));
    }

    @DeleteMapping("/api/milestones/{id}")
    ResponseEntity<Void> cancel(
            @AuthenticationPrincipal AuthPrincipal actor,
            @PathVariable @Positive Long id,
            @RequestHeader(value = "If-Match", required = false) String version) {
        milestones.cancel(actor, id, version);
        return ResponseEntity.noContent().cacheControl(CacheControl.noStore()).build();
    }

    @GetMapping("/api/milestones/{id}/submissions")
    Page<Submission> history(
            @AuthenticationPrincipal AuthPrincipal actor,
            @PathVariable @Positive Long id,
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size) {
        return milestones.history(actor, id, page, size);
    }

    @PostMapping("/api/milestones/{id}/submissions")
    ResponseEntity<Submission> submit(
            @AuthenticationPrincipal AuthPrincipal actor,
            @PathVariable @Positive Long id,
            @Valid @RequestBody Submit input,
            @RequestHeader(value = "If-Match", required = false) String version) {
        Submission value = milestones.submit(actor, id, input, version);
        return ResponseEntity.status(HttpStatus.CREATED)
                .cacheControl(CacheControl.noStore())
                .eTag(value.milestoneVersion())
                .body(value);
    }

    @PostMapping("/api/submissions/{id}/approve")
    ResponseEntity<Submission> approve(
            @AuthenticationPrincipal AuthPrincipal actor,
            @PathVariable @Positive Long id,
            @Valid @RequestBody(required = false) Review input,
            @RequestHeader(value = "If-Match", required = false) String version) {
        return review(milestones.review(actor, id, input, true, version));
    }

    @PostMapping("/api/submissions/{id}/request-revision")
    ResponseEntity<Submission> revision(
            @AuthenticationPrincipal AuthPrincipal actor,
            @PathVariable @Positive Long id,
            @Valid @RequestBody Review input,
            @RequestHeader(value = "If-Match", required = false) String version) {
        return review(milestones.review(actor, id, input, false, version));
    }

    private ResponseEntity<Detail> detail(Detail value) {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .eTag(value.version())
                .body(value);
    }

    private ResponseEntity<Submission> review(Submission value) {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .eTag(value.milestoneVersion())
                .body(value);
    }
}
