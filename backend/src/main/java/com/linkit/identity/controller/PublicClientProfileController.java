package com.linkit.identity.controller;

import com.linkit.common.ApiException;
import com.linkit.identity.entity.ClientProfile;
import com.linkit.identity.entity.User;
import com.linkit.identity.repository.ClientProfileRepository;
import com.linkit.jobs.repository.JobRepository;

import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/public/clients")
public class PublicClientProfileController {
    public record PublicClientProfile(
            Long id,
            String representativeName,
            String companyName,
            String jobTitle,
            String industry,
            String location,
            String companyWebsite,
            String publicContactPhone,
            String contactEmail,
            String description,
            String avatarUrl) {}

    private final ClientProfileRepository profiles;
    private final JobRepository jobs;

    public record PublicClientJob(
            Long id,
            String title,
            BigDecimal budgetMin,
            BigDecimal budgetMax,
            String currencyCode,
            LocalDate deadline) {}

    public PublicClientProfileController(ClientProfileRepository profiles, JobRepository jobs) {
        this.profiles = profiles;
        this.jobs = jobs;
    }

    @GetMapping("/{id}")
    @Transactional(readOnly = true)
    public PublicClientProfile detail(@PathVariable Long id) {
        ClientProfile client =
                profiles.findById(id).orElseThrow(PublicClientProfileController::missing);
        if (client.getUser().getStatus() != User.Status.ACTIVE) throw missing();
        User user = client.getUser();

        return new PublicClientProfile(
                user.getId(),
                user.getFullName(),
                client.getCompanyName(),
                client.getJobTitle(),
                client.getIndustry(),
                client.getLocation(),
                client.getCompanyWebsite(),
                client.getPublicContactPhone(),
                client.getPublicContactEmail(),
                client.getDescription(),
                user.getAvatarUrl());
    }

    @GetMapping("/{id}/jobs")
    @Transactional(readOnly = true)
    public List<PublicClientJob> openJobs(@PathVariable Long id) {
        ClientProfile client =
                profiles.findById(id).orElseThrow(PublicClientProfileController::missing);
        if (client.getUser().getStatus() != User.Status.ACTIVE) throw missing();
        return jobs.findOpenByClientId(id, PageRequest.of(0, 20)).stream()
                .map(
                        j ->
                                new PublicClientJob(
                                        j.getId(),
                                        j.getTitle(),
                                        j.getBudgetMin(),
                                        j.getBudgetMax(),
                                        j.getCurrencyCode(),
                                        j.getDeadline()))
                .toList();
    }

    private static ApiException missing() {
        return new ApiException(
                HttpStatus.NOT_FOUND, "CLIENT_NOT_FOUND", "Không tìm thấy hồ sơ doanh nghiệp.");
    }
}
