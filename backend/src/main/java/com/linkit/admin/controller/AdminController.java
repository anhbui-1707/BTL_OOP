package com.linkit.admin.controller;

import com.linkit.admin.dto.AdminDtos.*;
import com.linkit.admin.service.AdminService;
import com.linkit.auth.security.AuthPrincipal;
import com.linkit.identity.entity.User;
import com.linkit.identity.entity.UserRole.Role;
import com.linkit.proposals.entity.Proposal;

import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.constraints.*;

import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/admin")
@PreAuthorize("hasRole('ADMIN')")
public class AdminController {
    private final AdminService service;

    public AdminController(AdminService service) {
        this.service = service;
    }

    @ModelAttribute
    public void noCache(HttpServletResponse response) {
        response.setHeader(HttpHeaders.CACHE_CONTROL, "no-store");
    }

    @GetMapping("/users")
    public Page<UserView> users(
            @RequestParam(required = false) @Size(max = 200) String keyword,
            @RequestParam(required = false) Role role,
            @RequestParam(required = false) User.Status status,
            @RequestParam(defaultValue = "0") @Min(0) @Max(1000000) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size) {
        return service.users(keyword, role, status, page, size);
    }

    @GetMapping("/users/{id}")
    public ResponseEntity<UserView> user(@PathVariable @Positive Long id) {
        return userResponse(service.user(id));
    }

    @PatchMapping("/users/{id}/lock")
    public ResponseEntity<UserView> lock(
            @AuthenticationPrincipal AuthPrincipal actor,
            @PathVariable @Positive Long id,
            @RequestHeader(value = "If-Match", required = false) @Size(max = 100) String version) {
        return userResponse(service.setLocked(actor, id, true, version));
    }

    @PatchMapping("/users/{id}/unlock")
    public ResponseEntity<UserView> unlock(
            @AuthenticationPrincipal AuthPrincipal actor,
            @PathVariable @Positive Long id,
            @RequestHeader(value = "If-Match", required = false) @Size(max = 100) String version) {
        return userResponse(service.setLocked(actor, id, false, version));
    }

    @GetMapping("/proposals")
    public Page<ProposalView> proposals(
            @RequestParam(required = false) @Size(max = 200) String keyword,
            @RequestParam(required = false) Proposal.Status status,
            @RequestParam(defaultValue = "0") @Min(0) @Max(1000000) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size) {
        return service.proposals(keyword, status, page, size);
    }

    @GetMapping("/proposals/{id}")
    public ProposalDetail proposal(@PathVariable @Positive Long id) {
        return service.proposal(id);
    }

    @GetMapping("/activities")
    public Page<Activity> activities(
            @RequestParam(required = false) @Size(max = 200) String keyword,
            @RequestParam(required = false) @Pattern(regexp = "[A-Z0-9_]{1,80}") String action,
            @RequestParam(defaultValue = "0") @Min(0) @Max(1000000) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size) {
        return service.activities(keyword, action, page, size);
    }

    @GetMapping("/stats")
    public Stats stats() {
        return service.stats();
    }

    private ResponseEntity<UserView> userResponse(UserView value) {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .eTag(value.version())
                .body(value);
    }
}
