package com.linkit.identity.dto;

import java.util.List;

public final class SkillCatalogDtos {
    private SkillCatalogDtos() {}

    public record Skill(Long id, String name, String category) {}

    public record Page(
            List<Skill> content, int page, int size, long totalElements, int totalPages) {}
}
