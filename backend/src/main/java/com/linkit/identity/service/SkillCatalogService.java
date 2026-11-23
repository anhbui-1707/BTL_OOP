package com.linkit.identity.service;

import com.linkit.identity.dto.SkillCatalogDtos.*;
import com.linkit.identity.repository.SkillRepository;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Locale;

@Service
@Transactional(readOnly = true)
public class SkillCatalogService {
    private final SkillRepository skills;

    public SkillCatalogService(SkillRepository skills) {
        this.skills = skills;
    }

    public Page list(String q, int page, int size) {
        String needle = q == null ? "" : q.strip().toLowerCase(Locale.ROOT);
        String pattern =
                "%"
                        + needle.replace("\\", "\\\\")
                                .replace("%", "\\%")
                                .replace("_", "\\_")
                                .replace("[", "\\[")
                                .replace("]", "\\]")
                        + "%";
        var result =
                skills.findAll(
                        (root, query, cb) -> {
                            var active = cb.isTrue(root.get("isActive"));
                            return needle.isEmpty()
                                    ? active
                                    : cb.and(
                                            active,
                                            cb.or(
                                                    cb.like(
                                                            cb.lower(root.get("name")),
                                                            pattern,
                                                            '\\'),
                                                    cb.like(
                                                            cb.lower(root.get("category")),
                                                            pattern,
                                                            '\\')));
                        },
                        PageRequest.of(page, size, Sort.by("name", "id")));
        return new Page(
                result.stream()
                        .map(s -> new Skill(s.getId(), s.getName(), s.getCategory()))
                        .toList(),
                page,
                size,
                result.getTotalElements(),
                result.getTotalPages());
    }
}
