package com.linkit.identity.controller;

import com.linkit.identity.dto.SkillCatalogDtos.Page;
import com.linkit.identity.service.SkillCatalogService;

import jakarta.validation.constraints.*;

import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/skills")
public class SkillCatalogController {
    private final SkillCatalogService skills;

    public SkillCatalogController(SkillCatalogService skills) {
        this.skills = skills;
    }

    @GetMapping
    Page list(
            @RequestParam(required = false) @Size(max = 100) String q,
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size) {
        return skills.list(q, page, size);
    }
}
