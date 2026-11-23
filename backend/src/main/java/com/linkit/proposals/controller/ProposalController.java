package com.linkit.proposals.controller;

import com.linkit.auth.security.AuthPrincipal;
import com.linkit.proposals.dto.ProposalDtos.*;
import com.linkit.proposals.entity.Proposal;
import com.linkit.proposals.service.ProposalService;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.nio.charset.StandardCharsets;

@RestController
@RequestMapping("/api")
public class ProposalController {
    private final ProposalService proposals;

    public ProposalController(ProposalService proposals) {
        this.proposals = proposals;
    }

    @PostMapping("/jobs/{jobId}/proposals")
    ResponseEntity<Detail> submit(
            @AuthenticationPrincipal AuthPrincipal actor,
            @PathVariable @Positive Long jobId,
            @Valid @RequestBody SubmitRequest request) {
        Detail result = proposals.submit(actor, jobId, request);
        return ResponseEntity.created(URI.create("/api/proposals/" + result.id()))
                .cacheControl(CacheControl.noStore())
                .eTag(result.version())
                .body(result);
    }

    @GetMapping("/jobs/{jobId}/proposals")
    PageResponse forJob(
            @AuthenticationPrincipal AuthPrincipal actor,
            @PathVariable @Positive Long jobId,
            @RequestParam(required = false) Proposal.Status status,
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size) {
        return proposals.forJob(actor, jobId, status, page, size);
    }

    @GetMapping("/proposals/me")
    PageResponse mine(
            @AuthenticationPrincipal AuthPrincipal actor,
            @RequestParam(required = false) Proposal.Status status,
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size) {
        return proposals.mine(actor, status, page, size);
    }

    @GetMapping("/proposals/{id}")
    ResponseEntity<Detail> get(
            @AuthenticationPrincipal AuthPrincipal actor, @PathVariable @Positive Long id) {
        return response(proposals.get(actor, id));
    }

    @GetMapping("/proposals/{id}/cv/download")
    ResponseEntity<byte[]> downloadCv(
            @AuthenticationPrincipal AuthPrincipal actor, @PathVariable @Positive Long id) {
        CvDownload cv = proposals.downloadCv(actor, id);
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .contentLength(cv.content().length)
                .cacheControl(CacheControl.noStore())
                .header("X-Content-Type-Options", "nosniff")
                .header(
                        "Content-Disposition",
                        ContentDisposition.attachment()
                                .filename(cv.fileName(), StandardCharsets.UTF_8)
                                .build()
                                .toString())
                .body(cv.content());
    }

    @PatchMapping("/proposals/{id}/status")
    ResponseEntity<Detail> reject(
            @AuthenticationPrincipal AuthPrincipal actor,
            @PathVariable @Positive Long id,
            @RequestHeader(value = "If-Match", required = false) String version,
            @Valid @RequestBody StatusRequest request) {
        return response(proposals.reject(actor, id, version, request));
    }

    @PostMapping("/proposals/{id}/withdraw")
    ResponseEntity<Detail> withdraw(
            @AuthenticationPrincipal AuthPrincipal actor,
            @PathVariable @Positive Long id,
            @RequestHeader(value = "If-Match", required = false) String version) {
        return response(proposals.withdraw(actor, id, version));
    }

    private ResponseEntity<Detail> response(Detail detail) {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .eTag(detail.version())
                .body(detail);
    }
}
