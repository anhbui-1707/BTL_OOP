package com.linkit.matching;

import static org.assertj.core.api.Assertions.*;

import com.linkit.identity.entity.FreelancerProfile.AvailabilityStatus;
import com.linkit.matching.service.CompatibilityScorer;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import java.math.BigDecimal;
import java.util.*;

class CompatibilityScorerTest {
    private final CompatibilityScorer scorer = new CompatibilityScorer();

    private List<CompatibilityScorer.Requirement> requirements() {
        return List.of(
                new CompatibilityScorer.Requirement(1L, 4, new BigDecimal("75")),
                new CompatibilityScorer.Requirement(2L, 2, new BigDecimal("25")));
    }

    @Test
    void weightedSkillsMissingSkillAndExactTotalMatchApprovedFormula() {
        var score =
                scorer.score(
                        requirements(),
                        Map.of(1L, 2),
                        3,
                        new BigDecimal("110"),
                        new BigDecimal("100"),
                        AvailabilityStatus.BUSY);
        assertThat(score.skills()).isEqualByComparingTo("18.75");
        assertThat(score.experience()).isEqualByComparingTo("12");
        assertThat(score.budget()).isEqualByComparingTo("15");
        assertThat(score.availability()).isEqualByComparingTo("5");
        assertThat(score.total()).isEqualByComparingTo("50.75");
        assertThat(score.skillBreakdown().get(1).proficiency()).isZero();
    }

    @Test
    void proficiencyCapsAtFullMatchAndWeightsAreNormalized() {
        var score =
                scorer.score(
                        requirements(),
                        Map.of(1L, 5, 2L, 5),
                        8,
                        BigDecimal.TEN,
                        BigDecimal.TEN,
                        AvailabilityStatus.AVAILABLE);
        assertThat(score.total()).isEqualByComparingTo("100");
        assertThat(score.skills()).isEqualByComparingTo("50");
        var third =
                scorer.score(
                        List.of(new CompatibilityScorer.Requirement(1L, 3, BigDecimal.ONE)),
                        Map.of(1L, 1),
                        0,
                        BigDecimal.TEN,
                        BigDecimal.ONE,
                        AvailabilityStatus.UNAVAILABLE);
        assertThat(third.total()).isEqualByComparingTo("16.67");
    }

    @ParameterizedTest
    @CsvSource({"0,0", "1,4", "3,12", "5,20", "12,20"})
    void experienceCapsAtFiveYears(int years, String expected) {
        assertThat(
                        scorer.score(
                                        requirements(),
                                        Map.of(),
                                        years,
                                        BigDecimal.ZERO,
                                        BigDecimal.TEN,
                                        AvailabilityStatus.AVAILABLE)
                                .experience())
                .isEqualByComparingTo(expected);
    }

    @ParameterizedTest
    @CsvSource({"90.00,20", "100.00,20", "110.00,15", "110.01,10", "120.00,10", "120.01,0"})
    void budgetUsesExactDecimalBoundaries(String proposed, String expected) {
        assertThat(
                        scorer.score(
                                        requirements(),
                                        Map.of(),
                                        0,
                                        new BigDecimal(proposed),
                                        new BigDecimal("100.00"),
                                        AvailabilityStatus.AVAILABLE)
                                .budget())
                .isEqualByComparingTo(expected);
    }

    @ParameterizedTest
    @CsvSource({"AVAILABLE,10", "BUSY,5", "UNAVAILABLE,0"})
    void availabilityHasApprovedPoints(AvailabilityStatus availability, String expected) {
        assertThat(
                        scorer.score(
                                        requirements(),
                                        Map.of(),
                                        0,
                                        BigDecimal.ZERO,
                                        BigDecimal.TEN,
                                        availability)
                                .availability())
                .isEqualByComparingTo(expected);
    }

    @Test
    void zeroBudgetAndLargeDecimalsAvoidFloatingPointAndDivisionByZero() {
        assertThat(
                        scorer.score(
                                        requirements(),
                                        Map.of(),
                                        0,
                                        BigDecimal.ZERO,
                                        BigDecimal.ZERO,
                                        AvailabilityStatus.AVAILABLE)
                                .budget())
                .isEqualByComparingTo("20");
        assertThat(
                        scorer.score(
                                        requirements(),
                                        Map.of(),
                                        0,
                                        new BigDecimal("0.01"),
                                        BigDecimal.ZERO,
                                        AvailabilityStatus.AVAILABLE)
                                .budget())
                .isEqualByComparingTo("0");
        assertThat(
                        scorer.score(
                                        requirements(),
                                        Map.of(),
                                        0,
                                        new BigDecimal("99999999999999999.99"),
                                        new BigDecimal("99999999999999999.99"),
                                        AvailabilityStatus.AVAILABLE)
                                .budget())
                .isEqualByComparingTo("20");
    }

    @Test
    void missingJobRequirementsAreReportedRatherThanInvented() {
        assertThatThrownBy(
                        () ->
                                scorer.score(
                                        List.of(),
                                        Map.of(),
                                        0,
                                        BigDecimal.ZERO,
                                        BigDecimal.TEN,
                                        AvailabilityStatus.AVAILABLE))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
