package com.linkit.auth.repository;

import com.linkit.auth.entity.RefreshToken;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Optional;

public interface RefreshTokenRepository extends JpaRepository<RefreshToken, Long> {
    @EntityGraph(attributePaths = {"user", "user.roles"})
    @Query("select t from RefreshToken t where t.id = :id")
    Optional<RefreshToken> findSessionById(@Param("id") Long id);

    @EntityGraph(attributePaths = {"user", "user.roles"})
    Optional<RefreshToken> findByTokenHash(byte[] tokenHash);

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query(
            "update RefreshToken t set t.revokedAt = :now where t.id = :id and t.revokedAt is null and t.expiresAt > :now")
    int consume(@Param("id") Long id, @Param("now") Instant now);
}
