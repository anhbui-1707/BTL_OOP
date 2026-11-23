package com.linkit.projects.controller;

import com.linkit.auth.security.AuthPrincipal;
import com.linkit.projects.dto.RiskDtos.*;
import com.linkit.projects.service.RiskAlertService;

import jakarta.validation.constraints.*;

import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
public class RiskAlertController {
    private final RiskAlertService risks;

    public RiskAlertController(RiskAlertService risks) {
        this.risks = risks;
    }

    @GetMapping("/api/assignments/{id}/risk-alerts")
    Page list(
            @AuthenticationPrincipal AuthPrincipal actor,
            @PathVariable @Positive Long id,
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size) {
        return risks.list(actor, id, page, size);
    }

    @GetMapping("/api/risk-alerts/{id}")
    Detail get(@AuthenticationPrincipal AuthPrincipal actor, @PathVariable @Positive Long id) {
        return risks.get(actor, id);
    }

    @PostMapping("/api/assignments/{id}/risk-alerts/evaluate")
    Evaluation evaluate(
            @AuthenticationPrincipal AuthPrincipal actor, @PathVariable @Positive Long id) {
        return risks.evaluate(actor, id);
    }

    @PostMapping("/api/risk-alerts/{id}/acknowledge")
    Detail acknowledge(
            @AuthenticationPrincipal AuthPrincipal actor, @PathVariable @Positive Long id) {
        return risks.acknowledge(actor, id);
    }

    @PostMapping("/api/risk-alerts/{id}/resolve")
    Detail resolve(@AuthenticationPrincipal AuthPrincipal actor, @PathVariable @Positive Long id) {
        return risks.resolve(actor, id);
    }
}
