package com.linkit.auth.security;

import com.linkit.identity.entity.UserRole.Role;

import java.util.Set;

public record AuthPrincipal(Long userId, Set<Role> roles) {
    public AuthPrincipal {
        roles = Set.copyOf(roles);
    }
}
