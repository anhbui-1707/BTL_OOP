package com.linkit.identity.dto;

import jakarta.validation.constraints.*;

public final class FreelancerSkillDtos {
    private FreelancerSkillDtos() {}

    public record Input(
            @NotBlank @Size(max = 100) String name,
            @NotNull @Min(1) @Max(5) Short proficiency,
            @NotNull @Min(0) @Max(32767) Short yearsExperience) {}

    public record View(Long id, String name, Short proficiency, Short yearsExperience) {}
}
