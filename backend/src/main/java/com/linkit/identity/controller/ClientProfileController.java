package com.linkit.identity.controller;

import com.linkit.auth.security.AuthPrincipal;
import com.linkit.identity.dto.ClientProfileDtos.*;
import com.linkit.identity.service.ClientProfileService;

import jakarta.validation.Valid;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/clients/me")
@PreAuthorize("hasRole('CLIENT')")
public class ClientProfileController {
    private final ClientProfileService profiles;

    public ClientProfileController(ClientProfileService profiles) {
        this.profiles = profiles;
    }

    @GetMapping
    public View get(@AuthenticationPrincipal AuthPrincipal actor) {
        return profiles.get(actor.userId());
    }

    @PutMapping
    public View update(
            @AuthenticationPrincipal AuthPrincipal actor, @Valid @RequestBody Input input) {
        return profiles.update(actor.userId(), input);
    }
}
