package com.linkit.demo;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;

import org.springframework.core.env.Environment;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

import java.nio.charset.StandardCharsets;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.*;

public final class DemoSeeder {
    public record Result(boolean created, Map<String, Integer> counts) {
        public int total() {
            return counts.values().stream().mapToInt(Integer::intValue).sum();
        }
    }

    private final JdbcTemplate jdbc;
    private final TransactionTemplate transaction;
    private final PasswordEncoder encoder;
    private final Environment environment;

    public DemoSeeder(
            JdbcTemplate jdbc,
            PlatformTransactionManager manager,
            PasswordEncoder encoder,
            Environment environment) {
        this.jdbc = jdbc;
        this.encoder = encoder;
        this.environment = environment;
        transaction = new TransactionTemplate(manager);
        transaction.setIsolationLevel(TransactionDefinition.ISOLATION_SERIALIZABLE);
        transaction.setTimeout(180);
    }

    public Result seed() {
        Set<String> profiles = new HashSet<>(Arrays.asList(environment.getActiveProfiles()));
        if ((!profiles.contains("dev") && !profiles.contains("demo"))
                || !Set.of("dev", "demo", "test").containsAll(profiles)
                || !environment.getProperty("linkit.seed.enabled", Boolean.class, false))
            throw new IllegalStateException(
                    "Demo seed requires an explicit dev/demo profile and linkit.seed.enabled=true; production is forbidden");
        String password = environment.getProperty("LINKIT_DEMO_PASSWORD");
        if (password == null
                || password.length() < 12
                || password.getBytes(StandardCharsets.UTF_8).length > 72)
            throw new IllegalStateException(
                    "Set LINKIT_DEMO_PASSWORD to at least 12 characters and at most 72 UTF-8 bytes");
        return Objects.requireNonNull(transaction.execute(status -> load(password)));
    }

    private Result load(String password) {
        if (!"LinkIT_V2".equals(jdbc.queryForObject("SELECT DB_NAME()", String.class)))
            throw new IllegalStateException("Demo seed can only target LinkIT_V2");
        jdbc.execute(
                "SET ANSI_NULLS ON; SET ANSI_PADDING ON; SET ANSI_WARNINGS ON; SET ARITHABORT ON; SET CONCAT_NULL_YIELDS_NULL ON; SET QUOTED_IDENTIFIER ON; SET NUMERIC_ROUNDABORT OFF;");

        jdbc.queryForList(
                "SELECT id FROM dbo.notification_delivery_cursor WITH (UPDLOCK,HOLDLOCK) WHERE id=1");
        List<Map<String, Object>> marker =
                jdbc.queryForList(
                        "SELECT entity_type,action,after_json FROM dbo.audit_logs WITH (UPDLOCK,HOLDLOCK) WHERE id=?",
                        DemoSeedPlan.MARKER_ID);
        if (!marker.isEmpty()) {
            var m = marker.getFirst();
            if (!"demo_seed".equals(m.get("entity_type"))
                    || !"DEMO_SEED_CREATED".equals(m.get("action")))
                throw collision("audit_logs marker");
            try {
                var json = new ObjectMapper().readTree((String) m.get("after_json"));
                if (!DemoSeedPlan.VERSION.equals(json.path("seedVersion").asText()))
                    throw collision("seed version");
                DemoSeedPlan original =
                        new DemoSeedPlan(LocalDate.parse(json.path("referenceDate").asText()));
                resolveSkills(original, false);

                return new Result(false, DemoSeedValidator.counts(jdbc, original));
            } catch (JsonProcessingException | java.time.DateTimeException e) {
                throw new IllegalStateException("Invalid demo seed marker; no data was changed", e);
            }
        }
        DemoSeedPlan plan = new DemoSeedPlan();
        for (var t : plan.tables.values())
            jdbc.queryForObject(
                    "SELECT COUNT_BIG(*) FROM dbo." + t.name() + " WITH (TABLOCKX,HOLDLOCK)",
                    Long.class);
        Set<Long> reusedSkills = resolveSkills(plan, true);
        for (var t : plan.tables.values())
            if (t.identity())
                for (var row : t.rows()) {
                    long id = ((Number) row.get("id")).longValue();
                    if (t.name().equals("skills") && reusedSkills.contains(id)) continue;
                    if (jdbc.queryForObject(
                                    "SELECT COUNT(*) FROM dbo." + t.name() + " WHERE id=?",
                                    Integer.class,
                                    id)
                            != 0) throw collision(t.name() + " id " + id);
                }
        for (var row : plan.tables.get("users").rows())
            if (jdbc.queryForObject(
                            "SELECT COUNT(*) FROM dbo.users WHERE email=?",
                            Integer.class,
                            row.get("email"))
                    != 0) throw collision("demo email");
        for (var t : plan.tables.values()) insert(t, password, reusedSkills);
        DemoSeedValidator.validate(jdbc, plan);
        jdbc.execute("SET IDENTITY_INSERT dbo.audit_logs ON");
        try {
            String manifest;
            try {
                manifest =
                        new ObjectMapper()
                                .writeValueAsString(
                                        Map.of(
                                                "seedVersion",
                                                DemoSeedPlan.VERSION,
                                                "referenceDate",
                                                plan.reference.toString()));
            } catch (JsonProcessingException e) {
                throw new IllegalStateException(e);
            }
            jdbc.update(
                    "INSERT dbo.audit_logs(id,entity_type,entity_id,action,after_json,request_id,created_at) VALUES (?,'demo_seed',?,'DEMO_SEED_CREATED',?,?,?)",
                    DemoSeedPlan.MARKER_ID,
                    DemoSeedPlan.MARKER_ID,
                    manifest,
                    UUID.nameUUIDFromBytes(DemoSeedPlan.VERSION.getBytes(StandardCharsets.UTF_8))
                            .toString(),
                    Timestamp.from(plan.reference.atStartOfDay().toInstant(ZoneOffset.UTC)));
        } finally {
            jdbc.execute("SET IDENTITY_INSERT dbo.audit_logs OFF");
        }
        jdbc.update(
                "INSERT dbo.notification_delivery_receipts(source_audit_id) VALUES (?)",
                DemoSeedPlan.MARKER_ID);
        return new Result(true, DemoSeedValidator.counts(jdbc, plan));
    }

    private Set<Long> resolveSkills(DemoSeedPlan plan, boolean initial) {
        Map<Integer, Long> resolved = new HashMap<>();
        Set<Long> reused = new HashSet<>();
        for (var row : plan.tables.get("skills").rows()) {
            var matches =
                    jdbc.queryForList(
                            "SELECT id,is_active FROM dbo.skills WHERE name=?", row.get("name"));
            if (matches.isEmpty()) {
                if (!initial)
                    throw new IllegalStateException(
                            "Demo skill missing; replay never repairs data");
                continue;
            }
            if (!Boolean.TRUE.equals(matches.getFirst().get("is_active")))
                throw new IllegalStateException(
                        "Demo requires active skill: "
                                + row.get("name")
                                + "; existing skill was not changed");
            long id = ((Number) matches.getFirst().get("id")).longValue();
            resolved.put((Integer) row.get("id"), id);
            row.put("id", id);
            reused.add(id);
        }
        for (String table : List.of("job_skills", "freelancer_skills"))
            for (var row : plan.tables.get(table).rows()) {
                Long id = resolved.get((Integer) row.get("skill_id"));
                if (id != null) row.put("skill_id", id);
            }
        plan.refreshScores();
        return reused;
    }

    private void insert(DemoSeedPlan.Table table, String password, Set<Long> reusedSkills) {
        List<String> columns = new ArrayList<>(table.rows().getFirst().keySet());
        String sql =
                "INSERT dbo."
                        + table.name()
                        + " ("
                        + String.join(",", columns)
                        + ") VALUES ("
                        + String.join(",", Collections.nCopies(columns.size(), "?"))
                        + ")";
        if (table.identity()) jdbc.execute("SET IDENTITY_INSERT dbo." + table.name() + " ON");
        try {
            for (var row : table.rows()) {
                if (table.name().equals("skills")
                        && reusedSkills.contains(((Number) row.get("id")).longValue())) continue;
                Object[] values =
                        columns.stream()
                                .map(
                                        c -> {
                                            Object value = row.get(c);
                                            return value == DemoSeedPlan.Secret.PASSWORD
                                                    ? encoder.encode(password)
                                                    : value instanceof UUID
                                                            ? value.toString()
                                                            : value;
                                        })
                                .toArray();
                jdbc.update(sql, values);
            }
        } finally {
            if (table.identity()) jdbc.execute("SET IDENTITY_INSERT dbo." + table.name() + " OFF");
        }
    }

    private static IllegalStateException collision(String subject) {
        return new IllegalStateException(
                "Demo namespace collision: "
                        + subject
                        + "; transaction rolled back, no existing data was changed");
    }
}
