package com.linkit.identity.controller;

import com.linkit.auth.security.AuthPrincipal;
import com.linkit.identity.dto.UserProfileDtos.*;
import com.linkit.identity.service.UserProfileService;

import jakarta.validation.Valid;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/users/me")
@PreAuthorize("hasAnyRole('CLIENT','FREELANCER','ADMIN')")
public class UserProfileController {
    private final UserProfileService profiles;

    public UserProfileController(UserProfileService profiles) {
        this.profiles = profiles;
    }

    @GetMapping
    public View get(@AuthenticationPrincipal AuthPrincipal actor) {
        return profiles.get(actor);
    }

    @PutMapping
    public View update(
            @AuthenticationPrincipal AuthPrincipal actor, @Valid @RequestBody Input input) {
        return profiles.update(actor, input);
    }
}
