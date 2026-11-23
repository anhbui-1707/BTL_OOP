package com.linkit.identity.entity;

import jakarta.persistence.*;

import org.hibernate.annotations.Nationalized;

import java.util.*;

@Entity
@Table(
        name = "skills",
        schema = "dbo",
        uniqueConstraints = {
            @UniqueConstraint(
                    name = "UQ_skills_name",
                    columnNames = {"name"})
        })
public class Skill {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false, columnDefinition = "bigint")
    private Long id;

    @Nationalized
    @Column(name = "name", nullable = false, length = 100, columnDefinition = "nvarchar(100)")
    private String name;

    @Nationalized
    @Column(name = "category", nullable = true, length = 100, columnDefinition = "nvarchar(100)")
    private String category;

    @Column(name = "is_active", nullable = false, columnDefinition = "bit")
    private Boolean isActive = true;

    public Skill() {}

    public Long getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getCategory() {
        return category;
    }

    public void setCategory(String category) {
        this.category = category;
    }

    public Boolean getIsActive() {
        return isActive;
    }

    public void setIsActive(Boolean isActive) {
        this.isActive = isActive;
    }
}
