package com.linkit.jobs.dto;

import java.time.Instant;

public record SavedJobDto(Long jobId, Instant savedAt, JobDtos.Summary job, Instant publishedAt) {}
