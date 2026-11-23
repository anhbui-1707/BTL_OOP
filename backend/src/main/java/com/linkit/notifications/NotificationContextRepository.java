package com.linkit.notifications;

import com.linkit.identity.entity.User;
import com.linkit.identity.entity.UserRole.Role;
import com.linkit.projects.entity.Assignment;
import com.linkit.projects.entity.Milestone;
import com.linkit.projects.entity.ScopeVersion;

import jakarta.persistence.EntityManager;

import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public class NotificationContextRepository {
    private final EntityManager em;

    public NotificationContextRepository(EntityManager em) {
        this.em = em;
    }

    public Object[] one(String query, Long id) {
        return em.createQuery(query, Object[].class)
                .setParameter("id", id)
                .getResultStream()
                .findFirst()
                .orElse(null);
    }

    public String userName(Long id) {
        User user = em.find(User.class, id);
        return user == null ? null : user.getFullName();
    }

    public List<Long> activeAdmins() {
        return em.createQuery(
                        "select distinct r.user.id from UserRole r where r.id.role=:role and r.user.status=:status",
                        Long.class)
                .setParameter("role", Role.ADMIN)
                .setParameter("status", User.Status.ACTIVE)
                .getResultList();
    }

    public boolean requiredMilestonesApproved(Long id) {
        var active =
                em.createQuery(
                                "select count(a) from Assignment a where a.id=:id and a.status in :statuses",
                                Long.class)
                        .setParameter("id", id)
                        .setParameter(
                                "statuses",
                                List.of(
                                        Assignment.Status.ACTIVE,
                                        Assignment.Status.AWAITING_ACCEPTANCE))
                        .getSingleResult();
        if (active == 0) return false;
        String where =
                " from Milestone m where m.assignment.id=:id and m.isRequired=true and m.status<>:cancelled and m.scopeVersionId in (select s.id from ScopeVersion s where s.assignment.id=:id and s.status=:locked)";
        long total =
                em.createQuery("select count(m)" + where, Long.class)
                        .setParameter("id", id)
                        .setParameter("cancelled", Milestone.Status.CANCELLED)
                        .setParameter("locked", ScopeVersion.Status.LOCKED)
                        .getSingleResult();
        long pending =
                em.createQuery("select count(m)" + where + " and m.status<>:approved", Long.class)
                        .setParameter("id", id)
                        .setParameter("cancelled", Milestone.Status.CANCELLED)
                        .setParameter("locked", ScopeVersion.Status.LOCKED)
                        .setParameter("approved", Milestone.Status.APPROVED)
                        .getSingleResult();
        return total > 0 && pending == 0;
    }
}
