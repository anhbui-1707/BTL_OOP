package com.linkit.identity.service;

import com.linkit.auth.security.AuthPrincipal;
import com.linkit.common.ApiException;
import com.linkit.identity.dto.ClientProfileDtos;
import com.linkit.identity.dto.ProfileHistoryDtos;
import com.linkit.identity.dto.UserProfileDtos.*;
import com.linkit.identity.entity.UserRole.Role;
import com.linkit.identity.repository.UserRepository;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.stream.Collectors;

@Service
public class UserProfileService {
    private final ClientProfileService clients;
    private final ProfileHistoryService freelancers;
    private final UserRepository users;
    private final PasswordEncoder passwords;

    public UserProfileService(
            ClientProfileService clients,
            ProfileHistoryService freelancers,
            UserRepository users,
            PasswordEncoder passwords) {
        this.clients = clients;
        this.freelancers = freelancers;
        this.users = users;
        this.passwords = passwords;
    }

    @Transactional(readOnly = true)
    public View get(AuthPrincipal actor) {
        var user = users.findWithRolesById(actor.userId()).orElseThrow(ApiException::unauthorized);
        String title = null, bio = null;
        if (actor.roles().contains(Role.CLIENT)) {
            var profile = clients.get(actor.userId());
            title = profile.title();
            bio = profile.bio();
        } else if (actor.roles().contains(Role.FREELANCER)) {
            var profile = freelancers.snapshot(actor.userId());
            title = profile.title();
            bio = profile.bio();
        }
        return new View(
                user.getId(),
                user.getFullName(),
                user.getEmail(),
                user.getPhoneNumber(),
                title,
                bio,
                user.getAvatarUrl(),
                user.getStatus(),
                user.getRoles().stream().map(r -> r.getId().getRole()).collect(Collectors.toSet()));
    }

    @Transactional
    public View update(AuthPrincipal actor, Input input) {
        if (actor.roles().contains(Role.CLIENT)) {
            clients.update(
                    actor.userId(),
                    new ClientProfileDtos.Input(
                            input.fullName(),
                            input.phoneNumber(),
                            input.bio(),
                            input.title(),
                            null,
                            null,
                            null,
                            null,
                            null,
                            null));
        } else if (actor.roles().contains(Role.FREELANCER)) {
            freelancers.updateProfile(
                    actor.userId(),
                    new ProfileHistoryDtos.ProfileInput(
                            input.fullName(), input.title(), input.bio(), input.phoneNumber()));
        } else {
            var user = users.findById(actor.userId()).orElseThrow(ApiException::unauthorized);
            user.setFullName(input.fullName().strip());
            if (input.phoneNumber() != null) user.setPhoneNumber(input.phoneNumber().strip());
            user.setUpdatedAt(java.time.Instant.now());
        }
        if (input.newPassword() != null) {
            var user = users.findById(actor.userId()).orElseThrow(ApiException::unauthorized);
            user.setPasswordHash(passwords.encode(input.newPassword()));
        }
        users.flush();
        return get(actor);
    }
}
