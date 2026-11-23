package com.linkit.projects.controller;

import com.linkit.auth.security.AuthPrincipal;
import com.linkit.projects.dto.AssignmentDtos.Detail;
import com.linkit.projects.service.SelectionService;

import jakarta.validation.constraints.Positive;

import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.net.URI;

@RestController
public class SelectionController {
    private final SelectionService selection;

    public SelectionController(SelectionService selection) {
        this.selection = selection;
    }

    @PostMapping("/api/proposals/{id}/select")
    ResponseEntity<Detail> select(
            @AuthenticationPrincipal AuthPrincipal actor,
            @PathVariable @Positive Long id,
            @RequestHeader(value = "If-Match", required = false) String version) {
        Detail result = selection.select(actor, id, version);
        return ResponseEntity.created(URI.create("/api/assignments/" + result.id()))
                .cacheControl(CacheControl.noStore())
                .eTag(result.version())
                .body(result);
    }
}
