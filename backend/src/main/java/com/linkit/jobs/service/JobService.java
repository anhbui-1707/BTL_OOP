package com.linkit.jobs.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.linkit.audit.entity.AuditLog;
import com.linkit.audit.repository.AuditLogRepository;
import com.linkit.auth.security.AuthPrincipal;
import com.linkit.common.ApiException;
import com.linkit.identity.entity.Skill;
import com.linkit.identity.entity.UserRole.Role;
import com.linkit.identity.repository.*;
import com.linkit.jobs.dto.JobDtos.*;
import com.linkit.jobs.entity.*;
import com.linkit.jobs.repository.*;

import org.hibernate.query.criteria.HibernateCriteriaBuilder;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class JobService {
    private final JobRepository jobs;
    private final JobSkillRepository jobSkills;
    private final SkillRepository skills;
    private final ClientProfileRepository clients;
    private final UserRepository users;
    private final JobQualityAssessmentRepository assessments;
    private final AuditLogRepository audit;
    private final JobQualityScorer scorer;
    private final ObjectMapper json;
    private final Clock clock;

    public JobService(
            JobRepository jobs,
            JobSkillRepository jobSkills,
            SkillRepository skills,
            ClientProfileRepository clients,
            UserRepository users,
            JobQualityAssessmentRepository assessments,
            AuditLogRepository audit,
            JobQualityScorer scorer,
            ObjectMapper json,
            Clock clock) {
        this.jobs = jobs;
        this.jobSkills = jobSkills;
        this.skills = skills;
        this.clients = clients;
        this.users = users;
        this.assessments = assessments;
        this.audit = audit;
        this.scorer = scorer;
        this.json = json;
        this.clock = clock;
    }

    @Scheduled(cron = "0 */5 * * * *", zone = "Asia/Ho_Chi_Minh")
    @Transactional
    public void closeExpiredJobs() {
        jobs.closeExpiredOpenJobs(LocalDate.now(clock), now());
    }

    @Transactional
    public Detail create(AuthPrincipal actor, WriteRequest request) {
        require(actor, Role.CLIENT);
        var client = clients.findById(actor.userId()).orElseThrow(JobService::forbidden);
        Map<Long, Skill> chosen = validate(request);
        Job job = new Job();
        job.setClient(client);
        job.setStatus(Job.Status.DRAFT);
        job.setCreatedAt(now());
        job.setUpdatedAt(now());
        apply(job, request);
        jobs.saveAndFlush(job);
        replaceSkills(job, request, chosen);
        assess(job, request);
        record(actor, job, "JOB_CREATED", null);
        jobs.flush();
        return detail(job);
    }

    @Transactional
    public Detail update(AuthPrincipal actor, Long id, String expected, WriteRequest request) {
        require(actor, Role.CLIENT);
        Job job = locked(id);
        if (!Objects.equals(job.getClientId(), actor.userId())) throw forbidden();
        match(job, expected);
        editable(job);
        touchAndLock(job);
        noApplications(job);
        Map<Long, Skill> chosen = validate(request);
        JobQualityScorer.Evaluation evaluation = evaluate(request);
        if (job.getStatus() == Job.Status.OPEN && !evaluation.publishable()) throw unpublishable();
        apply(job, request);
        replaceSkills(job, request, chosen);
        assess(job, request);
        record(actor, job, "JOB_UPDATED", job.getStatus());
        jobs.flush();
        return detail(job);
    }

    @Transactional
    public Detail publish(AuthPrincipal actor, Long id, String expected) {
        require(actor, Role.CLIENT);
        Job job = locked(id);
        if (!Objects.equals(job.getClientId(), actor.userId())) throw forbidden();
        match(job, expected);
        if (job.getStatus() != Job.Status.DRAFT) throw conflict("Chỉ Job DRAFT được đăng tuyển.");
        touchAndLock(job);
        noApplications(job);
        WriteRequest request = from(job);
        validate(request);
        if (!evaluate(request).publishable()) throw unpublishable();
        if (!job.getDeadline().isAfter(LocalDate.now(clock)))
            throw invalid("Hạn nhận Proposal phải sau ngày hiện tại.");
        job.setStatus(Job.Status.OPEN);
        job.setPublishedAt(now());
        assess(job, request);
        record(actor, job, "JOB_PUBLISHED", Job.Status.DRAFT);
        jobs.flush();
        return detail(job);
    }

    @Transactional
    public void cancel(AuthPrincipal actor, Long id, String expected) {
        if (!actor.roles().contains(Role.CLIENT) && !actor.roles().contains(Role.ADMIN))
            throw forbidden();
        Job job = locked(id);
        if (!actor.roles().contains(Role.ADMIN)
                && !Objects.equals(job.getClientId(), actor.userId())) throw forbidden();
        match(job, expected);
        editable(job);
        touchAndLock(job);
        noApplications(job);
        Job.Status previous = job.getStatus();
        job.setStatus(Job.Status.CANCELLED);
        record(actor, job, "JOB_CANCELLED", previous);
        jobs.flush();
    }

    @Transactional(readOnly = true)
    public Detail get(AuthPrincipal actor, Long id) {
        Job job = jobs.findDetailedById(id).orElseThrow(JobService::missing);
        if (!visible(actor, job)) throw missing();
        return detail(job);
    }

    @Transactional(readOnly = true)
    public Detail publicGet(Long id) {
        Job job = jobs.findDetailedById(id).orElseThrow(JobService::missing);
        if (job.getStatus() != Job.Status.OPEN || job.getDeadline().isBefore(LocalDate.now(clock)))
            throw missing();
        return detail(job);
    }

    @Transactional(readOnly = true)
    public PageResponse<Summary> publicList(
            String search,
            List<Long> skillIds,
            BigDecimal minBudget,
            BigDecimal maxBudget,
            String currency,
            int page,
            int size) {
        return list(
                null,
                search,
                skillIds,
                minBudget,
                maxBudget,
                currency,
                Job.Status.OPEN,
                false,
                page,
                size);
    }

    @Transactional(readOnly = true)
    public PageResponse<Summary> list(
            AuthPrincipal actor,
            String search,
            List<Long> skillIds,
            BigDecimal minBudget,
            BigDecimal maxBudget,
            String currency,
            Job.Status status,
            boolean mine,
            int page,
            int size) {
        if (mine && (actor == null || !actor.roles().contains(Role.CLIENT))) throw forbidden();
        if (minBudget != null && maxBudget != null && minBudget.compareTo(maxBudget) > 0)
            throw invalid("Khoảng ngân sách không hợp lệ.");
        List<Long> requested = skillIds == null ? List.of() : skillIds.stream().distinct().toList();
        if (requested.size() > 50 || requested.stream().anyMatch(id -> id == null || id <= 0))
            throw invalid("Danh sách kỹ năng không hợp lệ.");
        String term = search == null ? "" : search.strip().toLowerCase(Locale.ROOT);
        String unit =
                currency == null && (minBudget != null || maxBudget != null) ? "VND" : currency;
        Specification<Job> specification =
                (root, query, cb) -> {
                    var conditions = new ArrayList<jakarta.persistence.criteria.Predicate>();
                    if (mine) conditions.add(cb.equal(root.get("clientId"), actor.userId()));
                    else if (actor == null)
                        conditions.add(cb.equal(root.get("status"), Job.Status.OPEN));
                    else if (!actor.roles().contains(Role.ADMIN)) {
                        var open = cb.equal(root.get("status"), Job.Status.OPEN);
                        conditions.add(
                                actor.roles().contains(Role.CLIENT)
                                        ? cb.or(
                                                open,
                                                cb.equal(root.get("clientId"), actor.userId()))
                                        : open);
                    }
                    if (!term.isEmpty()) {

                        List<String> searchTerms = relatedSearchTerms(term);
                        var description =
                                ((HibernateCriteriaBuilder) cb)
                                        .sql(
                                                "lower(cast(? as nvarchar(max)))",
                                                String.class,
                                                root.get("description"));
                        var matches = new ArrayList<jakarta.persistence.criteria.Predicate>();
                        for (String keyword : searchTerms) {

                            boolean shortToken = keyword.matches("[a-z0-9]{1,3}");
                            String escaped =
                                    keyword.replace("\\", "\\\\")
                                            .replace("%", "\\%")
                                            .replace("_", "\\_")
                                            .replace("[", "\\[")
                                            .replace("]", "\\]");
                            var skillMatches = query.subquery(Long.class);
                            var jobSkill = skillMatches.from(JobSkill.class);
                            var skillName =
                                    cb.lower(jobSkill.get("skill").get("name").as(String.class));
                            if (shortToken) {
                                String pattern = "%[^a-z0-9]" + keyword + "[^a-z0-9]%";
                                var title = cb.lower(root.get("title").as(String.class));
                                matches.add(
                                        cb.greaterThan(
                                                cb.function(
                                                        "patindex",
                                                        Integer.class,
                                                        cb.literal(pattern),
                                                        cb.concat(" ", cb.concat(title, " "))),
                                                0));
                                matches.add(
                                        cb.greaterThan(
                                                cb.function(
                                                        "patindex",
                                                        Integer.class,
                                                        cb.literal(pattern),
                                                        cb.concat(
                                                                " ", cb.concat(description, " "))),
                                                0));
                                skillMatches
                                        .select(jobSkill.get("job").get("id"))
                                        .where(
                                                cb.greaterThan(
                                                        cb.function(
                                                                "patindex",
                                                                Integer.class,
                                                                cb.literal(pattern),
                                                                cb.concat(
                                                                        " ",
                                                                        cb.concat(skillName, " "))),
                                                        0));
                            } else {
                                matches.add(
                                        cb.like(
                                                cb.lower(root.get("title")),
                                                "%" + escaped + "%",
                                                '\\'));
                                matches.add(cb.like(description, "%" + escaped + "%", '\\'));
                                skillMatches
                                        .select(jobSkill.get("job").get("id"))
                                        .where(cb.like(skillName, "%" + escaped + "%", '\\'));
                            }
                            matches.add(root.get("id").in(skillMatches));
                        }
                        conditions.add(
                                cb.or(
                                        matches.toArray(
                                                jakarta.persistence.criteria.Predicate[]::new)));
                    }
                    if (status != null) conditions.add(cb.equal(root.get("status"), status));
                    if (!mine && (actor == null || !actor.roles().contains(Role.ADMIN))) {
                        conditions.add(
                                cb.or(
                                        cb.notEqual(root.get("status"), Job.Status.OPEN),
                                        cb.greaterThanOrEqualTo(
                                                root.get("deadline"), LocalDate.now(clock))));
                    }
                    if (status == Job.Status.OPEN)
                        conditions.add(
                                cb.greaterThanOrEqualTo(
                                        root.get("deadline"), LocalDate.now(clock)));
                    if (minBudget != null)
                        conditions.add(cb.greaterThanOrEqualTo(root.get("budgetMax"), minBudget));
                    if (maxBudget != null)
                        conditions.add(cb.lessThanOrEqualTo(root.get("budgetMin"), maxBudget));
                    if (unit != null) conditions.add(cb.equal(root.get("currencyCode"), unit));
                    if (!requested.isEmpty()) {
                        var matching = query.subquery(Long.class);
                        var skill = matching.from(JobSkill.class);
                        matching.select(skill.get("job").get("id"))
                                .where(skill.get("skill").get("id").in(requested))
                                .groupBy(skill.get("job").get("id"))
                                .having(
                                        cb.equal(
                                                cb.countDistinct(skill.get("skill").get("id")),
                                                (long) requested.size()));
                        conditions.add(root.get("id").in(matching));
                    }
                    return cb.and(
                            conditions.toArray(jakarta.persistence.criteria.Predicate[]::new));
                };
        Page<Job> result =
                jobs.findAll(
                        specification,
                        PageRequest.of(
                                page, size, Sort.by(Sort.Direction.DESC, "createdAt", "id")));
        List<Long> ids = result.stream().map(Job::getId).toList();
        Map<Long, List<SkillResponse>> skillsByJob = skillResponses(ids);
        Map<Long, Quality> quality = qualities(ids);
        List<Summary> content =
                result.stream()
                        .map(
                                job ->
                                        new Summary(
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
                                                skillsByJob.getOrDefault(job.getId(), List.of()),
                                                quality.containsKey(job.getId())
                                                        ? quality.get(job.getId()).score()
                                                        : null))
                        .toList();
        return new PageResponse<>(
                content,
                result.getNumber(),
                result.getSize(),
                result.getTotalElements(),
                result.getTotalPages());
    }

    private static List<String> relatedSearchTerms(String input) {
        String normalized = input.strip().toLowerCase(Locale.ROOT).replaceAll("\\s+", " ");
        Map<String, List<String>> domains =
                Map.ofEntries(
                        Map.entry(
                                "ai",
                                List.of(
                                        "artificial intelligence",
                                        "machine learning",
                                        "deep learning",
                                        "pytorch",
                                        "tensorflow",
                                        "llm",
                                        "nlp",
                                        "computer vision",
                                        "genai",
                                        "generative ai",
                                        "langchain",
                                        "hugging face")),
                        Map.entry(
                                "artificial intelligence",
                                List.of(
                                        "ai",
                                        "machine learning",
                                        "deep learning",
                                        "pytorch",
                                        "tensorflow",
                                        "llm",
                                        "nlp",
                                        "computer vision",
                                        "genai")),
                        Map.entry(
                                "machine learning",
                                List.of(
                                        "ai",
                                        "artificial intelligence",
                                        "deep learning",
                                        "pytorch",
                                        "tensorflow",
                                        "scikit-learn",
                                        "data science")),
                        Map.entry(
                                "data",
                                List.of(
                                        "data analyst",
                                        "data engineer",
                                        "data scientist",
                                        "data science",
                                        "sql",
                                        "pandas",
                                        "power bi",
                                        "tableau",
                                        "spark",
                                        "etl",
                                        "big data",
                                        "machine learning")),
                        Map.entry(
                                "web",
                                List.of(
                                        "frontend",
                                        "front-end",
                                        "backend",
                                        "back-end",
                                        "fullstack",
                                        "full-stack",
                                        "react",
                                        "next.js",
                                        "vue",
                                        "angular",
                                        "node.js",
                                        "spring boot",
                                        "django",
                                        "laravel")),
                        Map.entry(
                                "mobile",
                                List.of(
                                        "android",
                                        "ios",
                                        "flutter",
                                        "react native",
                                        "kotlin",
                                        "swift",
                                        "dart")),
                        Map.entry(
                                "ui/ux",
                                List.of(
                                        "figma",
                                        "user experience",
                                        "user interface",
                                        "product design",
                                        "ux designer",
                                        "ui designer")),
                        Map.entry(
                                "devops",
                                List.of(
                                        "docker",
                                        "kubernetes",
                                        "terraform",
                                        "ci/cd",
                                        "jenkins",
                                        "aws",
                                        "azure",
                                        "cloud")),
                        Map.entry(
                                "cloud",
                                List.of("aws", "azure", "gcp", "kubernetes", "docker", "devops")),
                        Map.entry(
                                "cyber security",
                                List.of(
                                        "cybersecurity",
                                        "information security",
                                        "pentest",
                                        "penetration testing",
                                        "soc",
                                        "siem",
                                        "network security")),
                        Map.entry(
                                "security",
                                List.of(
                                        "cybersecurity",
                                        "information security",
                                        "pentest",
                                        "penetration testing",
                                        "soc",
                                        "siem")),
                        Map.entry(
                                "java",
                                List.of(
                                        "spring boot",
                                        "spring framework",
                                        "spring mvc",
                                        "hibernate",
                                        "jpa",
                                        "maven",
                                        "gradle")));
        var terms = new LinkedHashSet<String>();
        terms.add(normalized);
        List<String> related = domains.get(normalized);
        if (related != null) terms.addAll(related);
        return List.copyOf(terms);
    }

    private Map<Long, Skill> validate(WriteRequest request) {
        if (request.budgetMax().compareTo(request.budgetMin()) < 0)
            throw invalid("Ngân sách tối đa phải lớn hơn hoặc bằng ngân sách tối thiểu.");
        List<Long> ids = request.skills().stream().map(SkillInput::skillId).toList();
        if (new HashSet<>(ids).size() != ids.size()) throw invalid("Kỹ năng không được trùng lặp.");
        Map<Long, Skill> chosen =
                skills.findAllById(ids).stream()
                        .collect(Collectors.toMap(Skill::getId, skill -> skill));
        if (chosen.size() != ids.size()
                || chosen.values().stream()
                        .anyMatch(skill -> !Boolean.TRUE.equals(skill.getIsActive())))
            throw invalid("Kỹ năng không tồn tại hoặc đã ngừng sử dụng.");
        return chosen;
    }

    private void apply(Job job, WriteRequest request) {
        job.setTitle(request.title());
        job.setDescription(request.description());
        job.setDeliverables(request.deliverables());
        job.setAcceptanceCriteria(request.acceptanceCriteria());
        job.setBudgetMin(request.budgetMin().setScale(2));
        job.setBudgetMax(request.budgetMax().setScale(2));
        job.setCurrencyCode(request.currencyCode());
        job.setDeadline(request.deadline());
    }

    private void replaceSkills(Job job, WriteRequest request, Map<Long, Skill> chosen) {
        Map<Long, JobSkill> existing =
                jobSkills.findByJob_IdIn(List.of(job.getId())).stream()
                        .collect(Collectors.toMap(s -> s.getId().getSkillId(), s -> s));
        Set<Long> desired =
                request.skills().stream().map(SkillInput::skillId).collect(Collectors.toSet());
        jobSkills.deleteAll(
                existing.values().stream()
                        .filter(s -> !desired.contains(s.getId().getSkillId()))
                        .toList());
        for (SkillInput input : request.skills()) {
            JobSkill value = existing.get(input.skillId());
            if (value == null) {
                value = new JobSkill();
                value.setId(new JobSkillId(job.getId(), input.skillId()));
                value.setJob(job);
                value.setSkill(chosen.get(input.skillId()));
            }
            value.setIsRequired(input.isRequired());
            jobSkills.save(value);
        }
        jobSkills.flush();
    }

    private WriteRequest from(Job job) {
        List<SkillInput> inputs =
                jobSkills.findByJob_IdIn(List.of(job.getId())).stream()
                        .map(s -> new SkillInput(s.getId().getSkillId(), s.getIsRequired()))
                        .toList();
        return new WriteRequest(
                job.getTitle(),
                job.getDescription(),
                job.getDeliverables(),
                job.getAcceptanceCriteria(),
                job.getBudgetMin(),
                job.getBudgetMax(),
                job.getCurrencyCode(),
                job.getDeadline(),
                inputs);
    }

    private void assess(Job job, WriteRequest request) {
        var result = evaluate(request);
        JobQualityAssessment snapshot = new JobQualityAssessment();
        snapshot.setJob(job);
        snapshot.setScore(result.score());
        snapshot.setRulesVersion(JobQualityScorer.VERSION);
        snapshot.setBreakdownJson(encode(result.breakdown()));
        snapshot.setRecommendationsJson(encode(result.recommendations()));
        snapshot.setEvaluatedAt(now());
        assessments.saveAndFlush(snapshot);
    }

    private JobQualityScorer.Evaluation evaluate(WriteRequest request) {
        return scorer.evaluate(request, LocalDate.now(clock));
    }

    private void record(AuthPrincipal actor, Job job, String action, Job.Status previous) {
        AuditLog event = new AuditLog();
        event.setActor(users.getReferenceById(actor.userId()));
        event.setEntityType("jobs");
        event.setEntityId(job.getId());
        event.setAction(action);
        event.setBeforeJson(previous == null ? null : encode(Map.of("status", previous.name())));
        event.setAfterJson(encode(Map.of("status", job.getStatus().name())));
        event.setCreatedAt(now());
        event.setRequestId(UUID.randomUUID());
        audit.save(event);
    }

    private Detail detail(Job job) {
        Long id = job.getId();
        return new Detail(
                id,
                job.getClientId(),
                job.getClient().getCompanyName(),
                job.getTitle(),
                job.getDescription(),
                job.getDeliverables(),
                job.getAcceptanceCriteria(),
                job.getBudgetMin(),
                job.getBudgetMax(),
                job.getCurrencyCode(),
                job.getDeadline(),
                job.getStatus(),
                job.getCreatedAt(),
                job.getUpdatedAt(),
                job.getPublishedAt(),
                Base64.getEncoder().encodeToString(job.getRowVer()),
                skillResponses(List.of(id)).getOrDefault(id, List.of()),
                qualities(List.of(id)).get(id));
    }

    private Map<Long, List<SkillResponse>> skillResponses(List<Long> ids) {
        if (ids.isEmpty()) return Map.of();
        return jobSkills.findByJob_IdIn(ids).stream()
                .sorted(Comparator.comparing(s -> s.getId().getSkillId()))
                .collect(
                        Collectors.groupingBy(
                                s -> s.getId().getJobId(),
                                Collectors.mapping(
                                        s ->
                                                new SkillResponse(
                                                        s.getId().getSkillId(),
                                                        s.getSkill().getName(),
                                                        s.getIsRequired()),
                                        Collectors.toList())));
    }

    private Map<Long, Quality> qualities(List<Long> ids) {
        if (ids.isEmpty()) return Map.of();
        return assessments.findLatestByJobIds(ids).stream()
                .collect(
                        Collectors.toMap(
                                a -> a.getJob().getId(),
                                a ->
                                        new Quality(
                                                a.getScore(),
                                                a.getRulesVersion(),
                                                tree(a.getBreakdownJson()),
                                                tree(a.getRecommendationsJson()),
                                                a.getEvaluatedAt())));
    }

    private Job locked(Long id) {
        return jobs.findForUpdate(id).orElseThrow(JobService::missing);
    }

    private void touchAndLock(Job job) {
        Instant time = now();
        job.setUpdatedAt(
                time.isAfter(job.getUpdatedAt()) ? time : job.getUpdatedAt().plusMillis(1));

        jobs.flush();
    }

    private void noApplications(Job job) {
        long proposals = jobs.countProposals(job.getId());
        long assignments = jobs.countAssignments(job.getId());
        if (proposals != 0 || assignments != 0)
            throw conflict("Job đã có proposal hoặc assignment, không thể sửa, đăng lại hoặc hủy.");
    }

    private void editable(Job job) {
        if (job.getStatus() != Job.Status.DRAFT && job.getStatus() != Job.Status.OPEN)
            throw conflict("Chỉ Job DRAFT hoặc OPEN được sửa/hủy.");
    }

    private boolean visible(AuthPrincipal actor, Job job) {
        return actor.roles().contains(Role.ADMIN)
                || job.getStatus() == Job.Status.OPEN
                || actor.roles().contains(Role.CLIENT)
                        && Objects.equals(job.getClientId(), actor.userId())
                || actor.roles().contains(Role.FREELANCER)
                        && (jobs.countAssignmentsForFreelancer(job.getId(), actor.userId()) > 0
                                || jobs.countProposalsForFreelancer(job.getId(), actor.userId())
                                        > 0);
    }

    private static void require(AuthPrincipal actor, Role role) {
        if (actor == null) throw ApiException.unauthorized();
        if (!actor.roles().contains(role)) throw forbidden();
    }

    private void match(Job job, String expected) {
        if (expected == null)
            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "IF_MATCH_REQUIRED",
                    "Cần gửi If-Match từ ETag hiện tại.");
        try {
            if (!expected.startsWith("\"") || !expected.endsWith("\""))
                throw new IllegalArgumentException();
            byte[] supplied =
                    Base64.getDecoder().decode(expected.substring(1, expected.length() - 1));
            if (supplied.length != 8) throw new IllegalArgumentException();
            if (!Arrays.equals(supplied, job.getRowVer()))
                throw conflict("Job đã thay đổi; hãy tải lại dữ liệu.");
        } catch (IllegalArgumentException error) {
            throw new ApiException(
                    HttpStatus.BAD_REQUEST, "INVALID_IF_MATCH", "If-Match không hợp lệ.");
        }
    }

    private String encode(Object value) {
        try {
            return json.writeValueAsString(value);
        } catch (JsonProcessingException error) {
            throw new IllegalStateException("Cannot encode Job snapshot");
        }
    }

    private com.fasterxml.jackson.databind.JsonNode tree(String value) {
        try {
            return json.readTree(value);
        } catch (JsonProcessingException error) {
            throw new IllegalStateException("Invalid Job quality snapshot");
        }
    }

    private Instant now() {
        return clock.instant().truncatedTo(ChronoUnit.MILLIS);
    }

    private static ApiException missing() {
        return new ApiException(HttpStatus.NOT_FOUND, "JOB_NOT_FOUND", "Không tìm thấy Job.");
    }

    private static ApiException forbidden() {
        return new ApiException(
                HttpStatus.FORBIDDEN, "FORBIDDEN", "Bạn không có quyền thực hiện thao tác này.");
    }

    private static ApiException invalid(String message) {
        return new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "VALIDATION_FAILED", message);
    }

    private static ApiException conflict(String message) {
        return new ApiException(HttpStatus.CONFLICT, "JOB_CONFLICT", message);
    }

    private static ApiException unpublishable() {
        return invalid(
                "Job cần tối thiểu 80 điểm, đủ trường thiết yếu, deadline tương lai và ít nhất một kỹ năng.");
    }
}
