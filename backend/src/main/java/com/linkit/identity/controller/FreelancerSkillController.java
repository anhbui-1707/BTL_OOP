package com.linkit.identity.controller;

import com.linkit.auth.security.AuthPrincipal;
import com.linkit.identity.dto.FreelancerSkillDtos.*;
import com.linkit.identity.service.FreelancerSkillService;

import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/skills/me")
@PreAuthorize("hasRole('FREELANCER')")
public class FreelancerSkillController {
    private final FreelancerSkillService skills;

    public FreelancerSkillController(FreelancerSkillService skills) {
        this.skills = skills;
    }

    @GetMapping
    public List<View> list(@AuthenticationPrincipal AuthPrincipal actor) {
        return skills.list(actor.userId());
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public View create(
            @AuthenticationPrincipal AuthPrincipal actor, @Valid @RequestBody Input input) {
        return skills.save(actor.userId(), null, input);
    }

    @PutMapping("/{skillId}")
    public View update(
            @AuthenticationPrincipal AuthPrincipal actor,
            @PathVariable Long skillId,
            @Valid @RequestBody Input input) {
        return skills.save(actor.userId(), skillId, input);
    }

    @DeleteMapping("/{skillId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal AuthPrincipal actor, @PathVariable Long skillId) {
        skills.delete(actor.userId(), skillId);
    }
}
