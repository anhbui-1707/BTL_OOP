package com.linkit.identity.repository;

import com.linkit.identity.entity.FreelancerProfile;

import jakarta.persistence.LockModeType;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface FreelancerProfileRepository extends JpaRepository<FreelancerProfile, Long> {

    @Query(
            value =
                    """
            select f
            from FreelancerProfile f
            join f.user u
            where u.status = com.linkit.identity.entity.User.Status.ACTIVE
              and (
                  :q is null
                  or lower(u.fullName) like lower(concat('%', :q, '%'))
                  or lower(f.headline) like lower(concat('%', :q, '%'))
              )
            """,
            countQuery =
                    """
            select count(f)
            from FreelancerProfile f
            join f.user u
            where u.status = com.linkit.identity.entity.User.Status.ACTIVE
              and (
                  :q is null
                  or lower(u.fullName) like lower(concat('%', :q, '%'))
                  or lower(f.headline) like lower(concat('%', :q, '%'))
              )
            """)
    Page<FreelancerProfile> findPublic(@Param("q") String q, Pageable pageable);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @EntityGraph(attributePaths = {"user", "user.roles"})
    @Query(
            """
        select f
        from FreelancerProfile f
        where f.userId = :id
        """)
    Optional<FreelancerProfile> findForSelection(@Param("id") Long id);
}
