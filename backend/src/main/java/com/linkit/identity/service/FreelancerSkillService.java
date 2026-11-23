package com.linkit.identity.service;

import com.linkit.common.ApiException;
import com.linkit.identity.dto.FreelancerSkillDtos.*;
import com.linkit.identity.entity.*;
import com.linkit.identity.repository.*;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class FreelancerSkillService {
    private final FreelancerSkillRepository entries;
    private final FreelancerProfileRepository profiles;
    private final SkillRepository skills;

    public FreelancerSkillService(
            FreelancerSkillRepository entries,
            FreelancerProfileRepository profiles,
            SkillRepository skills) {
        this.entries = entries;
        this.profiles = profiles;
        this.skills = skills;
    }

    @Transactional(readOnly = true)
    public List<View> list(Long userId) {
        return entries.findWithSkillById_FreelancerIdOrderById_SkillId(userId).stream()
                .map(FreelancerSkillService::view)
                .toList();
    }

    @Transactional
    public View save(Long userId, Long previousSkillId, Input input) {

        FreelancerProfile profile =
                profiles.findForSelection(userId).orElseThrow(FreelancerSkillService::missing);
        FreelancerSkill previous =
                previousSkillId == null
                        ? null
                        : entries.findById(new FreelancerSkillId(userId, previousSkillId))
                                .orElseThrow(FreelancerSkillService::missing);
        String name = input.name().strip();
        Skill skill =
                skills.findByNameIgnoreCase(name)
                        .orElseGet(
                                () -> {
                                    Skill created = new Skill();
                                    created.setName(name);
                                    return skills.saveAndFlush(created);
                                });
        if (!Boolean.TRUE.equals(skill.getIsActive()))
            throw new ApiException(
                    HttpStatus.UNPROCESSABLE_ENTITY,
                    "INACTIVE_SKILL",
                    "Kỹ năng không còn hoạt động.");
        FreelancerSkillId id = new FreelancerSkillId(userId, skill.getId());
        boolean same = previous != null && previous.getId().equals(id);
        if (!same && entries.existsById(id))
            throw new ApiException(
                    HttpStatus.CONFLICT, "DUPLICATE_SKILL", "Kỹ năng đã có trong hồ sơ.");
        FreelancerSkill entry = same ? previous : new FreelancerSkill();
        if (!same) {
            entry.setId(id);
            entry.setFreelancer(profile);
            entry.setSkill(skill);
        }
        entry.setProficiency(input.proficiency());
        entry.setYearsExperience(input.yearsExperience());
        if (previous != null && !same) entries.delete(previous);
        return view(entries.saveAndFlush(entry));
    }

    @Transactional
    public void delete(Long userId, Long skillId) {
        profiles.findForSelection(userId).orElseThrow(FreelancerSkillService::missing);
        FreelancerSkill entry =
                entries.findById(new FreelancerSkillId(userId, skillId))
                        .orElseThrow(FreelancerSkillService::missing);
        entries.delete(entry);
    }

    private static View view(FreelancerSkill entry) {
        return new View(
                entry.getSkill().getId(),
                entry.getSkill().getName(),
                entry.getProficiency(),
                entry.getYearsExperience());
    }

    private static ApiException missing() {
        return new ApiException(
                HttpStatus.NOT_FOUND,
                "PROFILE_SKILL_NOT_FOUND",
                "Không tìm thấy hồ sơ hoặc kỹ năng của bạn.");
    }
}
