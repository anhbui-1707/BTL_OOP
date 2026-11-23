package com.linkit.jobs.controller;

import com.linkit.jobs.dto.JobDtos.*;
import com.linkit.jobs.service.JobService;

import jakarta.validation.constraints.*;

import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;

@RestController
@RequestMapping("/api/public/jobs")
public class PublicJobController {
    private final JobService jobs;

    public PublicJobController(JobService jobs) {
        this.jobs = jobs;
    }

    @GetMapping
    PageResponse<Summary> list(
            @RequestParam(required = false) @Size(max = 200) String q,
            @RequestParam(required = false) @Size(max = 50) List<Long> skillIds,
            @RequestParam(required = false) @DecimalMin("0") BigDecimal minBudget,
            @RequestParam(required = false) @DecimalMin("0") BigDecimal maxBudget,
            @RequestParam(required = false) @Pattern(regexp = "[A-Z]{3}") String currency,
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size) {
        return jobs.publicList(q, skillIds, minBudget, maxBudget, currency, page, size);
    }

    @GetMapping("/{id}")
    ResponseEntity<Detail> detail(@PathVariable @Positive Long id) {
        Detail result = jobs.publicGet(id);

        return ResponseEntity.ok().eTag(result.version()).body(result);
    }
}
