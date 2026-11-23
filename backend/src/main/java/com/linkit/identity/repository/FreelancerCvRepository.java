package com.linkit.identity.repository;

import com.linkit.identity.entity.FreelancerCv;

import jakarta.persistence.LockModeType;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.*;

public interface FreelancerCvRepository extends JpaRepository<FreelancerCv, Long> {
    interface Metadata {
        Long getId();

        String getFileName();

        Integer getByteSize();

        Instant getUploadedAt();
    }

    List<Metadata> findByFreelancerIdOrderByUploadedAtDescIdDesc(Long freelancerId);

    Optional<FreelancerCv> findByIdAndFreelancerId(Long id, Long freelancerId);

    Optional<Metadata> findMetadataByIdAndFreelancerId(Long id, Long freelancerId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from FreelancerCv c where c.id=:id and c.freelancerId=:owner")
    Optional<FreelancerCv> findOwnedForUpdate(@Param("id") Long id, @Param("owner") Long owner);
}
