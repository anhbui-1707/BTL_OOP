package com.linkit.identity.service;

import com.linkit.common.ApiException;
import com.linkit.identity.dto.ClientProfileDtos.*;
import com.linkit.identity.entity.ClientProfile;
import com.linkit.identity.repository.ClientProfileRepository;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

@Service
public class ClientProfileService {
    private final ClientProfileRepository profiles;

    public ClientProfileService(ClientProfileRepository profiles) {
        this.profiles = profiles;
    }

    @Transactional(readOnly = true)
    public View get(Long owner) {
        return view(profile(owner));
    }

    @Transactional
    public View update(Long owner, Input input) {
        ClientProfile profile = profile(owner);
        var user = profile.getUser();

        user.setFullName(input.fullName().strip());
        if (input.phoneNumber() != null) user.setPhoneNumber(input.phoneNumber().strip());
        user.setUpdatedAt(Instant.now());
        if (input.bio() != null) profile.setDescription(input.bio().strip());
        if (input.title() != null) profile.setJobTitle(input.title().strip());
        if (input.companyName() != null) profile.setCompanyName(clean(input.companyName()));
        if (input.companyWebsite() != null)
            profile.setCompanyWebsite(website(input.companyWebsite()));
        if (input.industry() != null) profile.setIndustry(clean(input.industry()));
        if (input.location() != null) profile.setLocation(clean(input.location()));
        if (input.publicContactPhone() != null)
            profile.setPublicContactPhone(clean(input.publicContactPhone()));
        if (input.publicContactEmail() != null)
            profile.setPublicContactEmail(clean(input.publicContactEmail()));
        profile.setUpdatedAt(Instant.now());
        profiles.saveAndFlush(profile);
        return view(profile);
    }

    private static String clean(String value) {
        return value == null || value.isBlank() ? null : value.strip();
    }

    private static String website(String raw) {
        String value = clean(raw);
        if (value != null && !value.matches("(?i)^https?://[^\\s/]+(?:/[^\\s]*)?$"))
            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "INVALID_WEBSITE",
                    "Website phải bắt đầu bằng http:// hoặc https://.");
        return value;
    }

    private ClientProfile profile(Long owner) {
        return profiles.findById(owner)
                .orElseThrow(
                        () ->
                                new ApiException(
                                        HttpStatus.NOT_FOUND,
                                        "NOT_FOUND",
                                        "Không tìm thấy hồ sơ Client."));
    }

    private View view(ClientProfile profile) {
        var user = profile.getUser();
        return new View(
                user.getId(),
                user.getFullName(),
                user.getEmail(),
                user.getPhoneNumber(),
                profile.getDescription(),
                profile.getJobTitle(),
                profile.getCompanyName(),
                profile.getCompanyWebsite(),
                profile.getIndustry(),
                profile.getLocation(),
                profile.getPublicContactPhone(),
                profile.getPublicContactEmail());
    }
}
