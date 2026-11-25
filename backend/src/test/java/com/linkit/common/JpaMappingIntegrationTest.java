package com.linkit.common;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.linkit.identity.entity.*;
import com.linkit.identity.repository.*;
import com.linkit.jobs.entity.Job;
import com.linkit.projects.entity.*;
import com.linkit.proposals.entity.Proposal;

import jakarta.persistence.Column;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.EntityManager;
import jakarta.persistence.EntityManagerFactory;
import jakarta.persistence.OptimisticLockException;
import jakarta.persistence.Table;

import org.hibernate.Hibernate;
import org.hibernate.exception.ConstraintViolationException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.BeanWrapperImpl;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.transaction.AfterTransaction;
import org.springframework.test.context.transaction.BeforeTransaction;
import org.springframework.test.context.transaction.TestTransaction;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

@DataJpaTest(
        showSql = false,
        properties = {
            "spring.datasource.url=jdbc:sqlserver://localhost:1433;databaseName=LinkIT_V2;integratedSecurity=true;encrypt=true;trustServerCertificate=true",
            "spring.datasource.username=",
            "spring.datasource.password=",
            "spring.jpa.hibernate.ddl-auto=validate",
            "spring.jpa.show-sql=false",
            "debug=false"
        })
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@EnabledIfEnvironmentVariable(named = "LINKIT_JPA_TEST", matches = "true")
class JpaMappingIntegrationTest {
    @Autowired EntityManager em;
    @Autowired EntityManagerFactory emf;
    @Autowired JdbcTemplate jdbc;
    @Autowired UserRepository users;
    @Autowired SkillRepository skills;
    @Autowired Map<String, JpaRepository<?, ?>> repositories;
    private Map<String, Long> before;

    @BeforeTransaction
    void snapshotRows() {
        before = rowCounts();
    }

    @AfterTransaction
    void verifyRollback() {
        assertThat(rowCounts()).isEqualTo(before);
    }

    private Map<String, Long> rowCounts() {
        Map<String, Long> counts = new TreeMap<>();
        emf.getMetamodel()
                .getEntities()
                .forEach(
                        type -> {
                            String table = type.getJavaType().getAnnotation(Table.class).name();
                            counts.put(
                                    table,
                                    jdbc.queryForObject(
                                            "SELECT COUNT_BIG(*) FROM dbo." + table, Long.class));
                        });
        return counts;
    }

    @Test
    void validatesAllEntitiesAgainstSqlServer() {
        assertThat(em.getMetamodel().getEntities()).hasSize(24);
        assertThat(repositories).hasSize(24);
        assertThat(em.createNativeQuery("SELECT DB_NAME()", String.class).getSingleResult())
                .isEqualTo("LinkIT_V2");
    }

    @Test
    void basicColumnDefinitionsMatchSqlServerMetadata() {
        emf.getMetamodel()
                .getEntities()
                .forEach(
                        type -> {
                            String table = type.getJavaType().getAnnotation(Table.class).name();
                            Map<String, Map<String, Object>> columns = new HashMap<>();
                            jdbc.queryForList(
                                            "SELECT c.name, TYPE_NAME(c.user_type_id) AS sql_type, c.max_length, "
                                                    + "c.precision, c.scale, c.is_nullable FROM sys.columns c "
                                                    + "WHERE c.object_id = OBJECT_ID(?)",
                                            "dbo." + table)
                                    .forEach(row -> columns.put((String) row.get("name"), row));
                            List<java.lang.reflect.Field> fields =
                                    new ArrayList<>(
                                            List.of(type.getJavaType().getDeclaredFields()));
                            for (var field : type.getJavaType().getDeclaredFields()) {
                                if (field.isAnnotationPresent(EmbeddedId.class))
                                    fields.addAll(List.of(field.getType().getDeclaredFields()));
                            }
                            for (var field : fields) {
                                Column column = field.getAnnotation(Column.class);
                                if (column == null) continue;
                                Map<String, Object> actual = columns.get(column.name());
                                assertThat(actual).as(table + "." + column.name()).isNotNull();
                                assertThat(actual.get("is_nullable")).isEqualTo(column.nullable());
                                String sqlType = (String) actual.get("sql_type");
                                assertThat(column.columnDefinition()).startsWith(sqlType);
                                int length = ((Number) actual.get("max_length")).intValue();
                                if (sqlType.contains("char")
                                        || sqlType.equals("varbinary")
                                        || sqlType.equals("timestamp")) {
                                    int expected =
                                            length == -1
                                                    ? Integer.MAX_VALUE
                                                    : sqlType.startsWith("n") ? length / 2 : length;
                                    assertThat(column.length())
                                            .as(table + "." + column.name())
                                            .isEqualTo(expected);
                                }
                                if (sqlType.equals("decimal")) {
                                    assertThat(column.precision())
                                            .isEqualTo(
                                                    ((Number) actual.get("precision")).intValue());
                                    assertThat(column.scale())
                                            .isEqualTo(((Number) actual.get("scale")).intValue());
                                }
                            }
                        });
    }

    @Test
    void roundTripsAllTablesAndEmbeddedIdsAndLazyRelationships() {
        JpaTestGraph graph = new JpaTestGraph(em);
        var types = graph.entities.stream().map(Object::getClass).toList();
        List<Object> ids =
                graph.entities.stream().map(emf.getPersistenceUnitUtil()::getIdentifier).toList();
        em.clear();
        for (int i = 0; i < ids.size(); i++) {
            Object loaded = em.find(types.get(i), ids.get(i));
            assertThat(loaded).isNotNull();
        }
        em.clear();
        Job job = em.find(Job.class, graph.job.getId());
        assertThat(Hibernate.isInitialized(job.getClient())).isFalse();
        assertThat(Hibernate.isInitialized(job.getSkills())).isFalse();
        assertThat(job.getSkills()).hasSize(1);
        assertThat(job.getBudgetMin()).isEqualByComparingTo(graph.money);
        assertThat(job.getTitle()).isEqualTo("Phát triển ứng dụng tiếng Việt");
        assertThat(job.getCreatedAt()).isEqualTo(graph.now);
        assertThat(job.getDeadline()).isEqualTo(graph.deadline);
        assertThat(em.find(ClientProfile.class, graph.client.getId()).getUser().getId())
                .isEqualTo(graph.client.getId());
        Assignment assignment = em.find(Assignment.class, graph.assignment.getId());
        assertThat(assignment.getJob().getId()).isEqualTo(job.getId());
        assertThat(assignment.getProposal().getId()).isEqualTo(graph.proposal.getId());
        assertThat(assignment.getScopeVersions()).hasSize(1);
        assertThat(em.find(Milestone.class, graph.milestone.getId()).getScopeVersion().getId())
                .isEqualTo(graph.scope.getId());
        assertThat(em.find(ScopeVersion.class, graph.scope.getId()).getMilestones()).hasSize(1);
        assertThat(
                        em.find(com.linkit.reviews.entity.Review.class, graph.review.getId())
                                .getFinalAcceptance()
                                .getAssignment()
                                .getId())
                .isEqualTo(assignment.getId());
        assertThat(users.findByEmailIgnoreCase(graph.client.getEmail().toUpperCase(Locale.ROOT)))
                .isPresent();
    }

    @Test
    void repositoriesSupportCreateReadUpdateDeleteAndPagination() {
        Skill skill = new Skill();
        skill.setName("jpa-it-" + UUID.randomUUID());
        skill = skills.saveAndFlush(skill);
        Long id = skill.getId();
        em.clear();
        skill = skills.findById(id).orElseThrow();
        skill.setCategory("Đã cập nhật");
        skills.saveAndFlush(skill);
        em.clear();
        assertThat(skills.findById(id).orElseThrow().getCategory()).isEqualTo("Đã cập nhật");
        assertThat(skills.findAll(PageRequest.of(0, 1)).getContent()).hasSize(1);
        skills.deleteById(id);
        skills.flush();
        em.clear();
        assertThat(skills.findById(id)).isEmpty();
    }

    @Test
    void rejectsCrossAssignmentScopeThroughJpa() {
        JpaTestGraph first = new JpaTestGraph(em);
        JpaTestGraph second = new JpaTestGraph(em);
        first.milestone.setScopeVersion(second.scope);
        assertThatThrownBy(em::flush)
                .isInstanceOf(ConstraintViolationException.class)
                .hasMessageContaining("FK_milestones_assignment_scope");
    }

    @Test
    void rejectsDuplicateUniqueKeysThroughRepository() {
        Skill first = new Skill();
        first.setName("jpa-it-" + UUID.randomUUID());
        skills.saveAndFlush(first);
        Skill second = new Skill();
        second.setName(first.getName());
        assertThatThrownBy(() -> skills.saveAndFlush(second))
                .isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
    }

    @Test
    void explicitRollbackLeavesNoPersistedGraph() {
        JpaTestGraph graph = new JpaTestGraph(em);
        Long id = graph.client.getId();
        TestTransaction.flagForRollback();
        TestTransaction.end();
        assertThat(users.findById(id)).isEmpty();
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void rejectsStaleUpdatesForAllSixRowversionMappings() {
        Map<String, Long> initial = rowCounts();
        JpaTestGraph graph;
        List<EntityKey> keys;
        try (EntityManager writer = emf.createEntityManager()) {
            writer.getTransaction().begin();
            try {
                graph = new JpaTestGraph(writer);
                keys =
                        graph.entities.stream()
                                .map(
                                        entity ->
                                                new EntityKey(
                                                        entity.getClass(),
                                                        emf.getPersistenceUnitUtil()
                                                                .getIdentifier(entity)))
                                .toList();
                writer.getTransaction().commit();
            } catch (RuntimeException error) {
                if (writer.getTransaction().isActive()) writer.getTransaction().rollback();
                throw error;
            }
        }
        try {
            List<VersionCase> cases =
                    List.of(
                            new VersionCase(User.class, graph.client.getId(), "fullName"),
                            new VersionCase(
                                    FreelancerProfile.class,
                                    graph.freelancer.getUserId(),
                                    "headline"),
                            new VersionCase(Job.class, graph.job.getId(), "title"),
                            new VersionCase(Proposal.class, graph.proposal.getId(), "coverLetter"),
                            new VersionCase(
                                    Assignment.class, graph.assignment.getId(), "currencyCode"),
                            new VersionCase(Milestone.class, graph.milestone.getId(), "title"));
            for (VersionCase testCase : cases) {
                try (EntityManager winner = emf.createEntityManager();
                        EntityManager stale = emf.createEntityManager()) {
                    winner.getTransaction().begin();
                    stale.getTransaction().begin();
                    try {
                        Object first = winner.find(testCase.type(), testCase.id());
                        Object second = stale.find(testCase.type(), testCase.id());
                        BeanWrapperImpl firstBean = new BeanWrapperImpl(first);
                        BeanWrapperImpl staleBean = new BeanWrapperImpl(second);
                        byte[] oldVersion = ((byte[]) firstBean.getPropertyValue("rowVer")).clone();
                        assertThat(oldVersion).hasSize(8);
                        assertThat((byte[]) staleBean.getPropertyValue("rowVer"))
                                .containsExactly(oldVersion);
                        firstBean.setPropertyValue(testCase.property(), "USD");
                        winner.flush();
                        byte[] refreshedVersion = (byte[]) firstBean.getPropertyValue("rowVer");
                        assertThat(refreshedVersion).hasSize(8).isNotEqualTo(oldVersion);
                        winner.getTransaction().commit();
                        staleBean.setPropertyValue(testCase.property(), "EUR");
                        assertThatThrownBy(stale::flush)
                                .as(testCase.type().getSimpleName())
                                .isInstanceOf(OptimisticLockException.class);
                    } finally {
                        if (winner.getTransaction().isActive()) winner.getTransaction().rollback();
                        if (stale.getTransaction().isActive()) stale.getTransaction().rollback();
                    }
                }
                try (EntityManager reader = emf.createEntityManager()) {
                    assertThat(
                                    new BeanWrapperImpl(reader.find(testCase.type(), testCase.id()))
                                            .getPropertyValue(testCase.property()))
                            .isEqualTo("USD");
                }
            }
        } finally {

            try (EntityManager cleanup = emf.createEntityManager()) {
                cleanup.getTransaction().begin();
                try {
                    for (int i = keys.size() - 1; i >= 0; i--) {
                        EntityKey key = keys.get(i);
                        Object entity = cleanup.find(key.type(), key.id());
                        if (entity != null) {
                            cleanup.remove(entity);
                            cleanup.flush();
                        }
                    }
                    cleanup.getTransaction().commit();
                } catch (RuntimeException error) {
                    if (cleanup.getTransaction().isActive()) cleanup.getTransaction().rollback();
                    throw error;
                }
            }
            assertThat(rowCounts()).isEqualTo(initial);
        }
    }

    private record EntityKey(Class<?> type, Object id) {}

    private record VersionCase(Class<?> type, Long id, String property) {}
}
