package com.linkit.identity.repository;

import com.linkit.identity.entity.UserRole;
import com.linkit.identity.entity.UserRoleId;

import org.springframework.data.jpa.repository.JpaRepository;

public interface UserRoleRepository extends JpaRepository<UserRole, UserRoleId> {

}
