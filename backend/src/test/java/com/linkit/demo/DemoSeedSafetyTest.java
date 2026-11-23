package com.linkit.demo;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.core.env.MapPropertySource;
import org.springframework.core.env.StandardEnvironment;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.SimpleTransactionStatus;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;

class DemoSeedSafetyTest {
    private final ApplicationContextRunner context =
            new ApplicationContextRunner()
                    .withUserConfiguration(DemoSeedConfiguration.class)
                    .withBean(JdbcTemplate.class, () -> mock(JdbcTemplate.class))
                    .withBean(
                            PlatformTransactionManager.class,
                            () -> mock(PlatformTransactionManager.class))
                    .withBean(
                            org.springframework.security.crypto.password.PasswordEncoder.class,
                            BCryptPasswordEncoder::new);

    @Test
    void productionNeverRegistersSeederEvenWithOptInOrMixedProfiles() {
        for (String profile :
                new String[] {"prod", "production", "dev,prod", "demo,production", "staging", ""}) {
            context.withPropertyValues(
                            "spring.profiles.active=" + profile, "linkit.seed.enabled=true")
                    .run(ctx -> assertThat(ctx).doesNotHaveBean(DemoSeeder.class));
        }
    }

    @Test
    void developmentRequiresExplicitOptIn() {
        context.withPropertyValues("spring.profiles.active=dev")
                .run(ctx -> assertThat(ctx).doesNotHaveBean(DemoSeeder.class));
        context.withPropertyValues("spring.profiles.active=demo", "linkit.seed.enabled=true")
                .run(ctx -> assertThat(ctx).hasSingleBean(DemoSeeder.class));
    }

    @Test
    void directInvocationCannotBypassProductionGuard() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        StandardEnvironment environment = new StandardEnvironment();
        environment.setActiveProfiles("dev", "prod");
        environment
                .getPropertySources()
                .addFirst(new MapPropertySource("test", Map.of("linkit.seed.enabled", "true")));
        DemoSeeder seeder =
                new DemoSeeder(
                        jdbc,
                        mock(PlatformTransactionManager.class),
                        new BCryptPasswordEncoder(),
                        environment);
        assertThatThrownBy(seeder::seed)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("production");
        verifyNoInteractions(jdbc);
    }

    @Test
    void planHasExactCountsAndStableNonSecretContent() {
        DemoSeedPlan first = new DemoSeedPlan(LocalDate.of(2026, 11, 23)),
                second = new DemoSeedPlan(LocalDate.of(2026, 11, 23));
        assertThat(first.tables)
                .hasSize(26)
                .doesNotContainKeys(
                        "change_requests", "change_request_approvals", "refresh_tokens");
        assertThat(first.tables.values().stream().mapToInt(t -> t.rows().size()).sum())
                .isEqualTo(2934);
        assertThat(first.tables).usingRecursiveComparison().isEqualTo(second.tables);
    }

    @Test
    void jobsAreDiverseAndRecruitingDatesRemainFutureForLaterInstallations() {
        for (LocalDate today : List.of(LocalDate.of(2026, 11, 23), LocalDate.of(2028, 6, 1))) {
            var plan = new DemoSeedPlan(today);
            var jobs = plan.tables.get("jobs").rows();
            assertThat(jobs).extracting(r -> r.get("title")).doesNotHaveDuplicates();
            assertThat(
                            jobs.stream()
                                    .collect(
                                            java.util.stream.Collectors.groupingBy(
                                                    r -> r.get("status"),
                                                    java.util.stream.Collectors.counting())))
                    .containsExactlyInAnyOrderEntriesOf(
                            Map.of(
                                    "OPEN",
                                    50L,
                                    "CLOSED",
                                    15L,
                                    "IN_PROGRESS",
                                    20L,
                                    "COMPLETED",
                                    15L));
            jobs.stream()
                    .filter(r -> r.get("status").equals("OPEN"))
                    .forEach(
                            r ->
                                    assertThat(((java.sql.Date) r.get("deadline")).toLocalDate())
                                            .isAfter(today));
        }
    }

    @Test
    void projectScenariosHaveCorrectPartiesBudgetApprovalsAndReviewEligibility() {
        var plan = new DemoSeedPlan(LocalDate.of(2026, 11, 23));
        for (var assignment : plan.tables.get("assignments").rows()) {
            Object id = assignment.get("id");
            var scope =
                    plan.tables.get("scope_versions").rows().stream()
                            .filter(r -> r.get("assignment_id").equals(id))
                            .findFirst()
                            .orElseThrow();
            var approvals =
                    plan.tables.get("scope_approvals").rows().stream()
                            .filter(r -> r.get("scope_version_id").equals(scope.get("id")))
                            .toList();
            assertThat(approvals)
                    .hasSize(2)
                    .extracting(r -> r.get("user_id"))
                    .containsExactlyInAnyOrder(
                            assignment.get("client_id"), assignment.get("freelancer_id"));
            var milestones =
                    plan.tables.get("milestones").rows().stream()
                            .filter(r -> r.get("assignment_id").equals(id))
                            .toList();
            assertThat(
                            milestones.stream()
                                    .map(r -> (BigDecimal) r.get("amount"))
                                    .reduce(BigDecimal.ZERO, BigDecimal::add))
                    .isEqualByComparingTo((BigDecimal) assignment.get("agreed_budget"));
            boolean completed = assignment.get("status").equals("COMPLETED");
            var reviews =
                    plan.tables.get("reviews").rows().stream()
                            .filter(r -> r.get("assignment_id").equals(id))
                            .toList();
            assertThat(reviews).hasSize(completed ? 1 : 0);
            if (completed) assertThat(milestones).allMatch(r -> r.get("status").equals("APPROVED"));
        }
        var primary =
                plan.tables.get("users").rows().stream()
                        .filter(r -> r.get("email").equals("freelancer@demo.linkit.test"))
                        .findFirst()
                        .orElseThrow();
        assertThat(
                        plan.tables.get("assignments").rows().stream()
                                .filter(r -> r.get("freelancer_id").equals(primary.get("id")))
                                .map(r -> r.get("status")))
                .contains("ACTIVE", "COMPLETED");
    }

    @Test
    void compatibilityUsesProductionRulesAndVariesWithApplicantSkills() {
        var scores =
                new DemoSeedPlan(LocalDate.of(2026, 11, 23))
                        .tables
                        .get("compatibility_scores")
                        .rows();
        assertThat(scores).allMatch(r -> r.get("rules_version").equals("matching-v1"));
        assertThat(scores.stream().map(r -> r.get("score")).distinct().count()).isGreaterThan(5);
        assertThat(scores)
                .allMatch(
                        r ->
                                ((BigDecimal) r.get("score")).signum() >= 0
                                        && ((BigDecimal) r.get("score"))
                                                        .compareTo(new BigDecimal("100"))
                                                <= 0);
    }

    @Test
    void namespaceCollisionRollsBackBeforeAnyInsert() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForObject("SELECT DB_NAME()", String.class)).thenReturn("LinkIT_V2");
        when(jdbc.queryForObject(
                        "SELECT COUNT(*) FROM dbo.users WHERE id=?", Integer.class, 2000001L))
                .thenReturn(1);
        PlatformTransactionManager manager = mock(PlatformTransactionManager.class);
        when(manager.getTransaction(any())).thenReturn(new SimpleTransactionStatus());
        var seeder = new DemoSeeder(jdbc, manager, new BCryptPasswordEncoder(), demoEnvironment());
        assertThatThrownBy(seeder::seed)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("namespace collision");
        verify(manager).rollback(any());
        assertThat(mockingDetails(jdbc).getInvocations())
                .noneMatch(i -> i.getMethod().getName().equals("update"));
    }

    private static StandardEnvironment demoEnvironment() {
        var env = new StandardEnvironment();
        env.setActiveProfiles("demo");
        env.getPropertySources()
                .addFirst(
                        new MapPropertySource(
                                "test",
                                Map.of(
                                        "linkit.seed.enabled",
                                        "true",
                                        "LINKIT_DEMO_PASSWORD",
                                        "Generated-test-only-2026")));
        return env;
    }
}
