package com.linkit.matching.controller;

import com.linkit.auth.security.AuthPrincipal;
import com.linkit.matching.dto.MatchingDtos.Page;
import com.linkit.matching.service.MatchingService;
import com.linkit.proposals.entity.Proposal;

import jakarta.validation.constraints.*;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/jobs/{jobId}")
public class MatchingController {
    private final MatchingService matching;

    public MatchingController(MatchingService matching) {
        this.matching = matching;
    }

    @GetMapping("/candidates")
    Page candidates(
            @AuthenticationPrincipal AuthPrincipal actor,
            @PathVariable @Positive Long jobId,
            @RequestParam(defaultValue = "PENDING") Proposal.Status status,
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size) {
        return matching.candidates(actor, jobId, status, page, size);
    }
}
