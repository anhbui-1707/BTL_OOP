package com.linkit.projects.controller;

import com.linkit.auth.security.AuthPrincipal;
import com.linkit.projects.dto.AssignmentDtos.*;
import com.linkit.projects.entity.Assignment;
import com.linkit.projects.service.AssignmentService;

import jakarta.validation.constraints.*;

import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/assignments")
public class AssignmentController {
    private final AssignmentService assignments;

    public AssignmentController(AssignmentService assignments) {
        this.assignments = assignments;
    }

    @GetMapping
    Page list(
            @AuthenticationPrincipal AuthPrincipal actor,
            @RequestParam(required = false) Assignment.Status status,
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size) {
        return assignments.list(actor, status, page, size);
    }

    @GetMapping("/{id}")
    ResponseEntity<Detail> get(
            @AuthenticationPrincipal AuthPrincipal actor, @PathVariable @Positive Long id) {
        Detail value = assignments.get(actor, id);
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .eTag(value.version())
                .body(value);
    }
}
