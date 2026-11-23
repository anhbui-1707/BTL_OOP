package com.linkit.identity.controller;

import com.linkit.auth.security.AuthPrincipal;
import com.linkit.common.ApiError;
import com.linkit.identity.dto.ProfileHistoryDtos.*;
import com.linkit.identity.service.ProfileHistoryService;

import jakarta.validation.Valid;

import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.multipart.support.MissingServletRequestPartException;

import java.nio.charset.StandardCharsets;
import java.util.List;

@RestController
@PreAuthorize("hasRole('FREELANCER')")
public class ProfileHistoryController {
    private final ProfileHistoryService history;

    public ProfileHistoryController(ProfileHistoryService history) {
        this.history = history;
    }

    @GetMapping("/api/freelancers/me")
    public Snapshot snapshot(@AuthenticationPrincipal AuthPrincipal actor) {
        return history.snapshot(actor.userId());
    }

    @PutMapping("/api/freelancers/me")
    public Snapshot updateProfile(
            @AuthenticationPrincipal AuthPrincipal actor, @Valid @RequestBody ProfileInput input) {
        return history.updateProfile(actor.userId(), input);
    }

    @GetMapping("/api/cvs/me")
    public List<CvView> cvs(@AuthenticationPrincipal AuthPrincipal actor) {
        return history.listCvs(actor.userId());
    }

    @PostMapping(value = "/api/cvs/me/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public CvView upload(
            @AuthenticationPrincipal AuthPrincipal actor, @RequestPart("file") MultipartFile file) {
        return history.upload(actor.userId(), file);
    }

    @GetMapping("/api/cvs/{id}/download")
    public ResponseEntity<byte[]> download(
            @AuthenticationPrincipal AuthPrincipal actor, @PathVariable Long id) {
        CvDownload cv = history.download(actor.userId(), id);
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

    @DeleteMapping("/api/cvs/me/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteCv(@AuthenticationPrincipal AuthPrincipal actor, @PathVariable Long id) {
        history.deleteCv(actor.userId(), id);
    }

    @GetMapping("/api/work-experiences/me")
    public List<WorkView> experiences(@AuthenticationPrincipal AuthPrincipal actor) {
        return history.listWork(actor.userId());
    }

    @PostMapping("/api/work-experiences/me")
    @ResponseStatus(HttpStatus.CREATED)
    public WorkView createWork(
            @AuthenticationPrincipal AuthPrincipal actor, @Valid @RequestBody WorkInput input) {
        return history.saveWork(actor.userId(), null, input);
    }

    @PutMapping("/api/work-experiences/me/{id}")
    public WorkView updateWork(
            @AuthenticationPrincipal AuthPrincipal actor,
            @PathVariable Long id,
            @Valid @RequestBody WorkInput input) {
        return history.saveWork(actor.userId(), id, input);
    }

    @DeleteMapping("/api/work-experiences/me/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteWork(
            @AuthenticationPrincipal AuthPrincipal actor,
            @PathVariable Long id,
            @RequestParam(required = false) Long version) {
        history.deleteWork(actor.userId(), id, version);
    }

    @GetMapping("/api/portfolios/me")
    public List<PortfolioView> portfolios(@AuthenticationPrincipal AuthPrincipal actor) {
        return history.listPortfolios(actor.userId());
    }

    @PostMapping("/api/portfolios/me")
    @ResponseStatus(HttpStatus.CREATED)
    public PortfolioView createPortfolio(
            @AuthenticationPrincipal AuthPrincipal actor,
            @Valid @RequestBody PortfolioInput input) {
        return history.savePortfolio(actor.userId(), null, input);
    }

    @PutMapping("/api/portfolios/me/{id}")
    public PortfolioView updatePortfolio(
            @AuthenticationPrincipal AuthPrincipal actor,
            @PathVariable Long id,
            @Valid @RequestBody PortfolioInput input) {
        return history.savePortfolio(actor.userId(), id, input);
    }

    @DeleteMapping("/api/portfolios/me/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deletePortfolio(
            @AuthenticationPrincipal AuthPrincipal actor,
            @PathVariable Long id,
            @RequestParam(required = false) Long version) {
        history.deletePortfolio(actor.userId(), id, version);
    }

    @ExceptionHandler({
        MaxUploadSizeExceededException.class,
        MissingServletRequestPartException.class
    })
    public ResponseEntity<ApiError> invalidUpload() {
        return ResponseEntity.unprocessableEntity()
                .cacheControl(CacheControl.noStore())
                .body(ApiError.of(422, "INVALID_CV", "Vui lòng chọn một tệp PDF, tối đa 2 MB."));
    }
}
