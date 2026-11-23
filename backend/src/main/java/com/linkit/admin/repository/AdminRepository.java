package com.linkit.admin.repository;

import com.linkit.admin.dto.AdminDtos.Page;
import com.linkit.audit.entity.AuditLog;
import com.linkit.identity.entity.User;
import com.linkit.identity.entity.UserRole.Role;
import com.linkit.proposals.entity.Proposal;

import jakarta.persistence.EntityManager;
import jakarta.persistence.TypedQuery;

import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.*;

@Repository
public class AdminRepository {
    private final EntityManager em;

    public AdminRepository(EntityManager em) {
        this.em = em;
    }

    private String term(String keyword) {
        return "%"
                + (keyword == null ? "" : keyword.strip().toLowerCase(Locale.ROOT))
                        .replace("!", "!!")
                        .replace("%", "!%")
                        .replace("_", "!_")
                        .replace("[", "![")
                        .replace("]", "!]")
                + "%";
    }

    private <T> Page<T> page(
            String select,
            String count,
            String where,
            String order,
            Class<T> type,
            Map<String, Object> parameters,
            int page,
            int size) {
        TypedQuery<T> query = em.createQuery(select + where + order, type);
        TypedQuery<Long> total = em.createQuery(count + where, Long.class);
        parameters.forEach(
                (key, value) -> {
                    query.setParameter(key, value);
                    total.setParameter(key, value);
                });
        long number = total.getSingleResult();
        return new Page<>(
                query.setFirstResult(Math.multiplyExact(page, size))
                        .setMaxResults(size)
                        .getResultList(),
                page,
                size,
                number,
                (int) ((number + size - 1) / size));
    }

    public Page<User> users(String keyword, Role role, User.Status status, int page, int size) {
        String where =
                " where not exists (select r from UserRole r where r.user=u and r.id.role=:admin)"
                        + " and exists (select r from UserRole r where r.user=u and r.id.role in (:client,:freelancer))"
                        + " and (lower(u.fullName) like :term escape '!' or lower(u.email) like :term escape '!')";
        Map<String, Object> args = new HashMap<>();
        args.put("admin", Role.ADMIN);
        args.put("client", Role.CLIENT);
        args.put("freelancer", Role.FREELANCER);
        args.put("term", term(keyword));
        if (role != null) {
            where += " and exists (select r from UserRole r where r.user=u and r.id.role=:role)";
            args.put("role", role);
        }
        if (status != null) {
            where += " and u.status=:status";
            args.put("status", status);
        }
        Page<User> values =
                page(
                        "select u from User u",
                        "select count(u) from User u",
                        where,
                        " order by u.createdAt desc,u.id desc",
                        User.class,
                        args,
                        page,
                        size);

        if (!values.content().isEmpty())
            em.createQuery(
                            "select distinct u from User u left join fetch u.roles where u.id in :ids",
                            User.class)
                    .setParameter("ids", values.content().stream().map(User::getId).toList())
                    .getResultList();
        return values;
    }

    public Page<Proposal> proposals(String keyword, Proposal.Status status, int page, int size) {
        String where =
                " where (lower(p.job.title) like :term escape '!' or lower(p.freelancer.user.fullName) like :term escape '!'"
                        + " or lower(p.job.client.user.fullName) like :term escape '!' or lower(p.job.client.companyName) like :term escape '!')";
        Map<String, Object> args = new HashMap<>();
        args.put("term", term(keyword));
        if (status != null) {
            where += " and p.status=:status";
            args.put("status", status);
        }
        return page(
                "select p from Proposal p join fetch p.job j join fetch j.client c join fetch c.user join fetch p.freelancer f join fetch f.user",
                "select count(p) from Proposal p",
                where,
                " order by p.submittedAt desc,p.id desc",
                Proposal.class,
                args,
                page,
                size);
    }

    public Optional<Proposal> proposal(Long id) {
        return em.createQuery(
                        "select p from Proposal p join fetch p.job j join fetch j.client c join fetch c.user join fetch p.freelancer f join fetch f.user where p.id=:id",
                        Proposal.class)
                .setParameter("id", id)
                .getResultStream()
                .findFirst();
    }

    public Page<AuditLog> activities(String keyword, String action, int page, int size) {
        String where =
                " where (lower(a.action) like :term escape '!' or lower(a.entityType) like :term escape '!'"
                        + " or lower(actor.fullName) like :term escape '!' or str(a.entityId) like :term escape '!')";
        Map<String, Object> args = new HashMap<>();
        args.put("term", term(keyword));
        if (action != null && !action.isBlank()) {
            where += " and a.action=:action";
            args.put("action", action);
        }

        return page(
                "select a from AuditLog a left join fetch a.actor actor",
                "select count(a) from AuditLog a left join a.actor actor",
                where,
                " order by a.createdAt desc,a.id desc",
                AuditLog.class,
                args,
                page,
                size);
    }

    public Map<String, Long> counts(String entity) {
        if (!Set.of("Job", "Proposal", "Assignment").contains(entity))
            throw new IllegalArgumentException("Unsupported aggregate");
        Map<String, Long> result = new LinkedHashMap<>();
        for (Object[] row :
                em.createQuery(
                                "select e.status,count(e) from " + entity + " e group by e.status",
                                Object[].class)
                        .getResultList())
            result.put(row[0].toString(), ((Number) row[1]).longValue());
        return result;
    }

    public long totalUsers() {
        return em.createQuery("select count(u) from User u", Long.class).getSingleResult();
    }

    public Map<String, Long> usersByRole() {

        List<?> rows =
                em.createNativeQuery(
                                "select coalesce(r.primary_role,'UNASSIGNED'),count_big(*) from dbo.users u left join "
                                        + "(select user_id,case when max(case when [role]='ADMIN' then 1 else 0 end)=1 then 'ADMIN' "
                                        + "when max(case when [role]='CLIENT' then 1 else 0 end)=1 then 'CLIENT' else 'FREELANCER' end primary_role "
                                        + "from dbo.user_roles group by user_id) r on r.user_id=u.id group by r.primary_role")
                        .getResultList();
        Map<String, Long> result = new LinkedHashMap<>();
        for (Object value : rows) {
            Object[] row = (Object[]) value;
            result.put(row[0].toString(), ((Number) row[1]).longValue());
        }
        return result;
    }

    public void revokeSessions(Long userId, Instant now) {
        em.createQuery(
                        "update RefreshToken t set t.revokedAt=:now where t.user.id=:id and t.revokedAt is null")
                .setParameter("now", now)
                .setParameter("id", userId)
                .executeUpdate();
    }
}
