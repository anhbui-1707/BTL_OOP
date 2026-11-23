package com.linkit.jobs.controller;

import com.linkit.auth.security.AuthPrincipal;
import com.linkit.jobs.dto.JobDtos.*;
import com.linkit.jobs.entity.Job;
import com.linkit.jobs.service.JobService;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.net.URI;
import java.util.List;

@RestController
@RequestMapping("/api/jobs")
public class JobController {
    private final JobService jobs;

    public JobController(JobService jobs) {
        this.jobs = jobs;
    }

    @PostMapping
    ResponseEntity<Detail> create(
            @AuthenticationPrincipal AuthPrincipal actor,
            @Valid @RequestBody WriteRequest request) {
        Detail result = jobs.create(actor, request);
        return ResponseEntity.created(URI.create("/api/jobs/" + result.id()))
                .eTag(result.version())
                .body(result);
    }

    @GetMapping("/{id}")
    ResponseEntity<Detail> get(
            @AuthenticationPrincipal AuthPrincipal actor, @PathVariable @Positive Long id) {
        return response(jobs.get(actor, id));
    }

    @PutMapping("/{id}")
    ResponseEntity<Detail> update(
            @AuthenticationPrincipal AuthPrincipal actor,
            @PathVariable @Positive Long id,
            @RequestHeader(value = "If-Match", required = false) String version,
            @Valid @RequestBody WriteRequest request) {
        return response(jobs.update(actor, id, version, request));
    }

    @PostMapping("/{id}/publish")
    ResponseEntity<Detail> publish(
            @AuthenticationPrincipal AuthPrincipal actor,
            @PathVariable @Positive Long id,
            @RequestHeader(value = "If-Match", required = false) String version) {
        return response(jobs.publish(actor, id, version));
    }

    @DeleteMapping("/{id}")
    ResponseEntity<Void> cancel(
            @AuthenticationPrincipal AuthPrincipal actor,
            @PathVariable @Positive Long id,
            @RequestHeader(value = "If-Match", required = false) String version) {
        jobs.cancel(actor, id, version);
        return ResponseEntity.noContent().build();
    }

    @GetMapping
    PageResponse<Summary> list(
            @AuthenticationPrincipal AuthPrincipal actor,
            @RequestParam(required = false) @Size(max = 200) String q,
            @RequestParam(required = false) @Size(max = 50) List<Long> skillIds,
            @RequestParam(required = false) @DecimalMin("0") @Digits(integer = 17, fraction = 2)
                    BigDecimal minBudget,
            @RequestParam(required = false) @DecimalMin("0") @Digits(integer = 17, fraction = 2)
                    BigDecimal maxBudget,
            @RequestParam(required = false) @Pattern(regexp = "[A-Z]{3}") String currency,
            @RequestParam(required = false) Job.Status status,
            @RequestParam(defaultValue = "false") boolean mine,
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size) {
        return jobs.list(
                actor, q, skillIds, minBudget, maxBudget, currency, status, mine, page, size);
    }

    private ResponseEntity<Detail> response(Detail detail) {
        return ResponseEntity.ok().eTag(detail.version()).body(detail);
    }
}
