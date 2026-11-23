package com.linkit.matching.service;

import com.linkit.identity.entity.FreelancerProfile.AvailabilityStatus;

import org.springframework.stereotype.Component;

import java.math.*;
import java.util.*;

@Component
public class CompatibilityScorer {
    public static final String VERSION = "matching-v1";
    private static final MathContext PRECISION = MathContext.DECIMAL128;

    public record Requirement(Long skillId, int requiredLevel, BigDecimal weight) {}

    public record SkillBreakdown(
            Long skillId,
            int requiredLevel,
            int proficiency,
            BigDecimal weight,
            BigDecimal ratio) {}

    public record Result(
            BigDecimal total,
            BigDecimal skills,
            BigDecimal experience,
            BigDecimal budget,
            BigDecimal availability,
            List<SkillBreakdown> skillBreakdown,
            int yearsExperience,
            BigDecimal proposedBudget,
            BigDecimal budgetMax,
            AvailabilityStatus availabilityStatus) {}

    public Result score(
            List<Requirement> requirements,
            Map<Long, Integer> proficiency,
            int years,
            BigDecimal proposedBudget,
            BigDecimal budgetMax,
            AvailabilityStatus availability) {
        if (requirements.isEmpty()
                || years < 0
                || proposedBudget == null
                || budgetMax == null
                || availability == null
                || proposedBudget.signum() < 0
                || budgetMax.signum() < 0)
            throw new IllegalArgumentException("Missing or invalid matching input");
        BigDecimal weighted = BigDecimal.ZERO, weights = BigDecimal.ZERO;
        List<SkillBreakdown> detail = new ArrayList<>();
        for (Requirement requirement : requirements) {
            int actual = proficiency.getOrDefault(requirement.skillId(), 0);
            if (requirement.requiredLevel() < 1
                    || requirement.requiredLevel() > 5
                    || actual < 0
                    || actual > 5
                    || requirement.weight() == null
                    || requirement.weight().signum() <= 0)
                throw new IllegalArgumentException("Invalid skill scale/weight");
            BigDecimal ratio =
                    BigDecimal.valueOf(actual)
                            .divide(BigDecimal.valueOf(requirement.requiredLevel()), PRECISION)
                            .min(BigDecimal.ONE);
            weights = weights.add(requirement.weight());
            weighted = weighted.add(ratio.multiply(requirement.weight(), PRECISION));
            detail.add(
                    new SkillBreakdown(
                            requirement.skillId(),
                            requirement.requiredLevel(),
                            actual,
                            requirement.weight(),
                            ratio));
        }
        BigDecimal skillPoints =
                money(weighted.divide(weights, PRECISION).multiply(BigDecimal.valueOf(50)));
        BigDecimal experience =
                money(
                        BigDecimal.valueOf(years)
                                .divide(BigDecimal.valueOf(5), PRECISION)
                                .min(BigDecimal.ONE)
                                .multiply(BigDecimal.valueOf(20)));
        int budget =
                proposedBudget.compareTo(budgetMax) <= 0
                        ? 20
                        : proposedBudget.compareTo(budgetMax.multiply(new BigDecimal("1.10"))) <= 0
                                ? 15
                                : proposedBudget.compareTo(
                                                        budgetMax.multiply(new BigDecimal("1.20")))
                                                <= 0
                                        ? 10
                                        : 0;
        int available =
                switch (availability) {
                    case AVAILABLE -> 10;
                    case BUSY -> 5;
                    case UNAVAILABLE -> 0;
                };
        return new Result(
                money(skillPoints.add(experience).add(BigDecimal.valueOf(budget + available))),
                skillPoints,
                experience,
                money(BigDecimal.valueOf(budget)),
                money(BigDecimal.valueOf(available)),
                List.copyOf(detail),
                years,
                proposedBudget,
                budgetMax,
                availability);
    }

    private static BigDecimal money(BigDecimal value) {
        return value.setScale(2, RoundingMode.HALF_UP);
    }
}
