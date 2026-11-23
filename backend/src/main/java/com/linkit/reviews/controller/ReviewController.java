package com.linkit.reviews.controller;

import com.linkit.auth.security.AuthPrincipal;
import com.linkit.reviews.dto.ReviewDtos.*;
import com.linkit.reviews.service.ReviewService;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Positive;

import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.net.URI;

@RestController
@RequestMapping("/api/assignments/{id}/review")
public class ReviewController {
    private final ReviewService reviews;

    public ReviewController(ReviewService reviews) {
        this.reviews = reviews;
    }

    @GetMapping
    ResponseEntity<Detail> get(
            @AuthenticationPrincipal AuthPrincipal actor, @PathVariable @Positive Long id) {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .body(reviews.get(actor, id));
    }

    @PostMapping
    ResponseEntity<Detail> create(
            @AuthenticationPrincipal AuthPrincipal actor,
            @PathVariable @Positive Long id,
            @Valid @RequestBody Create input) {
        return ResponseEntity.created(URI.create("/api/assignments/" + id + "/review"))
                .cacheControl(CacheControl.noStore())
                .body(reviews.create(actor, id, input));
    }
}
