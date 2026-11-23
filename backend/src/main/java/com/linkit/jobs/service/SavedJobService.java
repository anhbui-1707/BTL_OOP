package com.linkit.jobs.service;

import com.linkit.auth.security.AuthPrincipal;
import com.linkit.common.ApiException;
import com.linkit.identity.entity.FreelancerProfile;
import com.linkit.identity.entity.UserRole.Role;
import com.linkit.jobs.dto.JobDtos;
import com.linkit.jobs.dto.SavedJobDto;
import com.linkit.jobs.entity.Job;
import com.linkit.jobs.entity.SavedJob;
import com.linkit.jobs.repository.JobRepository;
import com.linkit.jobs.repository.SavedJobRepository;

import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.temporal.ChronoUnit;
import java.util.Comparator;
import java.util.List;

@Service
public class SavedJobService {
    private final SavedJobRepository savedJobs;
    private final JobRepository jobs;
    private final EntityManager entities;
    private final Clock clock;

    public SavedJobService(
            SavedJobRepository savedJobs, JobRepository jobs, EntityManager entities, Clock clock) {
        this.savedJobs = savedJobs;
        this.jobs = jobs;
        this.entities = entities;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public List<SavedJobDto> list(AuthPrincipal actor) {
        requireFreelancer(actor);
        return savedJobs.findByFreelancerIdOrderBySavedAtDescIdDesc(actor.userId()).stream()
                .map(this::response)
                .toList();
    }

    @Transactional
    public SavedJobDto save(AuthPrincipal actor, Long jobId) {
        lockFreelancer(actor);
        var existing = savedJobs.findByFreelancerIdAndJob_Id(actor.userId(), jobId);
        if (existing.isPresent()) return response(existing.get());

        Job job =
                jobs.findForUpdate(jobId)
                        .orElseThrow(
                                () ->
                                        new ApiException(
                                                HttpStatus.NOT_FOUND,
                                                "JOB_NOT_FOUND",
                                                "Job không còn khả dụng."));
        if (job.getStatus() != Job.Status.OPEN) {
            throw new ApiException(
                    HttpStatus.CONFLICT,
                    "JOB_NOT_OPEN",
                    "Job đã ngừng tuyển dụng, không thể lưu mới.");
        }
        SavedJob saved =
                new SavedJob(actor.userId(), job, clock.instant().truncatedTo(ChronoUnit.MILLIS));
        savedJobs.saveAndFlush(saved);

        return response(savedJobs.findByFreelancerIdAndJob_Id(actor.userId(), jobId).orElseThrow());
    }

    @Transactional
    public void remove(AuthPrincipal actor, Long jobId) {
        lockFreelancer(actor);
        savedJobs.deleteByFreelancerIdAndJob_Id(actor.userId(), jobId);
    }

    private void requireFreelancer(AuthPrincipal actor) {
        if (actor == null) throw ApiException.unauthorized();
        if (!actor.roles().contains(Role.FREELANCER)) {
            throw new ApiException(
                    HttpStatus.FORBIDDEN, "FORBIDDEN", "Chức năng dành cho Freelancer.");
        }
    }

    private void lockFreelancer(AuthPrincipal actor) {
        requireFreelancer(actor);

        if (entities.find(FreelancerProfile.class, actor.userId(), LockModeType.PESSIMISTIC_WRITE)
                == null) {
            throw new ApiException(
                    HttpStatus.FORBIDDEN, "FORBIDDEN", "Không tìm thấy hồ sơ Freelancer.");
        }
    }

    private SavedJobDto response(SavedJob saved) {
        Job job = saved.getJob();

        if (job.getStatus() == Job.Status.DRAFT) {
            return new SavedJobDto(job.getId(), saved.getSavedAt(), null, null);
        }
        var skills =
                job.getSkills().stream()
                        .sorted(Comparator.comparing(item -> item.getSkill().getId()))
                        .map(
                                item ->
                                        new JobDtos.SkillResponse(
                                                item.getSkill().getId(),
                                                item.getSkill().getName(),
                                                item.getIsRequired()))
                        .toList();
        var summary =
                new JobDtos.Summary(
                        job.getId(),
                        job.getClientId(),
                        job.getClient().getCompanyName(),
                        job.getTitle(),
                        job.getBudgetMin(),
                        job.getBudgetMax(),
                        job.getCurrencyCode(),
                        job.getDeadline(),
                        job.getStatus(),
                        job.getCreatedAt(),
                        skills,
                        null);
        return new SavedJobDto(job.getId(), saved.getSavedAt(), summary, job.getPublishedAt());
    }
}
