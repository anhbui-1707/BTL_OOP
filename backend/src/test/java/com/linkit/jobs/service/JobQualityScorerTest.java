package com.linkit.jobs.service;

import static org.assertj.core.api.Assertions.*;

import com.linkit.jobs.dto.JobDtos.*;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

class JobQualityScorerTest {
    private final JobQualityScorer scorer = new JobQualityScorer();
    private final LocalDate today = LocalDate.of(2026, 11, 15);

    private WriteRequest request(
            String title,
            String description,
            String deliverables,
            String criteria,
            BigDecimal max,
            LocalDate deadline,
            List<SkillInput> skills) {
        return new WriteRequest(
                title == null ? null : title.repeat(10),
                description == null ? null : description.repeat(100),
                deliverables == null ? null : deliverables.repeat(50),
                criteria == null ? null : criteria.repeat(50),
                BigDecimal.ZERO,
                max,
                "VND",
                deadline,
                skills);
    }

    private List<SkillInput> skills() {
        return List.of(new SkillInput(1L, true));
    }

    @Test
    void completeJobHasExactApprovedWeightsAndIsPublishable() {
        var result =
                scorer.evaluate(
                        request(
                                "Tiêu đề",
                                "Mô tả",
                                "Sản phẩm",
                                "Nghiệm thu",
                                BigDecimal.TEN,
                                today.plusDays(1),
                                skills()),
                        today);
        assertThat(result.score()).isEqualByComparingTo("100");
        assertThat(result.publishable()).isTrue();
        assertThat(result.breakdown().values()).containsExactly(10, 20, 20, 20, 10, 10, 10);
        assertThat(result.recommendations()).isEmpty();
        assertThat(JobQualityScorer.PUBLISH_MINIMUM).isEqualByComparingTo("80");
    }

    @Test
    void emptyDraftHasZeroAndExplanationsForEveryMissingCriterion() {
        var result =
                scorer.evaluate(
                        request(null, null, null, null, BigDecimal.ZERO, today, List.of()), today);
        assertThat(result.score()).isEqualByComparingTo("0");
        assertThat(result.recommendations()).hasSize(7);
        assertThat(result.publishable()).isFalse();
    }

    @Test
    void eightyPointsDoNotBypassAnEssentialField() {
        var result =
                scorer.evaluate(
                        request(
                                "Title",
                                "Description",
                                "",
                                "Criteria",
                                BigDecimal.TEN,
                                today.plusDays(1),
                                skills()),
                        today);
        assertThat(result.score()).isEqualByComparingTo("80");
        assertThat(result.publishable()).isFalse();
    }

    @Test
    void deadlineMustBeStrictlyInTheFuture() {
        for (LocalDate deadline : List.of(today, today.minusDays(1))) {
            var result =
                    scorer.evaluate(
                            request(
                                    "Title",
                                    "Description",
                                    "Deliverable",
                                    "Criteria",
                                    BigDecimal.TEN,
                                    deadline,
                                    skills()),
                            today);
            assertThat(result.score()).isEqualByComparingTo("90");
            assertThat(result.publishable()).isFalse();
        }
    }

    @Test
    void skillsAndPositiveBudgetAreRequiredIndependentlyOfThreshold() {
        assertThat(
                        scorer.evaluate(
                                        request(
                                                "T",
                                                "D",
                                                "B",
                                                "N",
                                                BigDecimal.TEN,
                                                today.plusDays(1),
                                                List.of()),
                                        today)
                                .publishable())
                .isFalse();
        assertThat(
                        scorer.evaluate(
                                        request(
                                                "T",
                                                "D",
                                                "B",
                                                "N",
                                                BigDecimal.ZERO,
                                                today.plusDays(1),
                                                skills()),
                                        today)
                                .publishable())
                .isFalse();
    }

    @Test
    void exactlyEightyWithEssentialFieldsCanPublishButSeventyCannot() {
        var complete =
                request(
                        "Title",
                        "Description",
                        "Delivery",
                        "Criteria",
                        BigDecimal.TEN,
                        today.plusDays(1),
                        skills());
        var eighty =
                new WriteRequest(
                        complete.title(),
                        "Mô tả ngắn",
                        "Mã nguồn",
                        complete.acceptanceCriteria(),
                        BigDecimal.ZERO,
                        BigDecimal.TEN,
                        "VND",
                        complete.deadline(),
                        skills());
        assertThat(scorer.evaluate(eighty, today).score()).isEqualByComparingTo("80");
        assertThat(scorer.evaluate(eighty, today).publishable()).isTrue();
        var seventy =
                new WriteRequest(
                        complete.title(),
                        eighty.description(),
                        eighty.deliverables(),
                        "Chạy đúng",
                        BigDecimal.ZERO,
                        BigDecimal.TEN,
                        "VND",
                        complete.deadline(),
                        skills());
        assertThat(scorer.evaluate(seventy, today).score()).isEqualByComparingTo("70");
        assertThat(scorer.evaluate(seventy, today).publishable()).isFalse();
    }
}
