package com.linkit.jobs.controller;

import com.linkit.auth.security.AuthPrincipal;
import com.linkit.jobs.dto.SavedJobDto;
import com.linkit.jobs.service.SavedJobService;

import jakarta.validation.constraints.Positive;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/freelancer/saved-jobs")
public class SavedJobController {
    private final SavedJobService savedJobs;

    public SavedJobController(SavedJobService savedJobs) {
        this.savedJobs = savedJobs;
    }

    @GetMapping
    List<SavedJobDto> list(@AuthenticationPrincipal AuthPrincipal actor) {
        return savedJobs.list(actor);
    }

    @PutMapping("/{jobId}")
    SavedJobDto save(
            @AuthenticationPrincipal AuthPrincipal actor, @PathVariable @Positive Long jobId) {
        return savedJobs.save(actor, jobId);
    }

    @DeleteMapping("/{jobId}")
    ResponseEntity<Void> remove(
            @AuthenticationPrincipal AuthPrincipal actor, @PathVariable @Positive Long jobId) {
        savedJobs.remove(actor, jobId);
        return ResponseEntity.noContent().build();
    }
}
