IF DB_NAME() <> N'LinkIT_V2' THROW 51000, 'Migration requires LinkIT_V2.', 1;

CREATE TABLE dbo.jobs (
    id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_jobs PRIMARY KEY,
    client_id BIGINT NOT NULL,
    title NVARCHAR(200) NOT NULL,
    description NVARCHAR(MAX) NOT NULL,
    deliverables NVARCHAR(MAX) NOT NULL,
    acceptance_criteria NVARCHAR(MAX) NOT NULL,
    budget_min DECIMAL(19,2) NOT NULL,
    budget_max DECIMAL(19,2) NOT NULL,
    currency_code CHAR(3) NOT NULL CONSTRAINT DF_jobs_currency DEFAULT 'VND',
    deadline DATE NOT NULL,
    status VARCHAR(20) NOT NULL,
    published_at DATETIME2(3) NULL,
    created_at DATETIME2(3) NOT NULL,
    updated_at DATETIME2(3) NOT NULL,
    row_ver ROWVERSION NOT NULL,
    CONSTRAINT FK_jobs_client FOREIGN KEY (client_id) REFERENCES dbo.client_profiles(user_id),
    CONSTRAINT UQ_jobs_id_client UNIQUE (id,client_id),
    CONSTRAINT CK_jobs_budget CHECK (budget_min >= 0 AND budget_max >= budget_min),
    CONSTRAINT CK_jobs_status CHECK (status IN ('DRAFT','OPEN','ASSIGNED','IN_PROGRESS','COMPLETED','CANCELLED','CLOSED'))
);

CREATE TABLE dbo.job_skills (
    job_id BIGINT NOT NULL,
    skill_id BIGINT NOT NULL,
    required_level TINYINT NOT NULL,
    is_required BIT NOT NULL,
    weight DECIMAL(5,2) NOT NULL,
    CONSTRAINT PK_job_skills PRIMARY KEY (job_id,skill_id),
    CONSTRAINT FK_job_skills_job FOREIGN KEY (job_id) REFERENCES dbo.jobs(id),
    CONSTRAINT FK_job_skills_skill FOREIGN KEY (skill_id) REFERENCES dbo.skills(id),
    CONSTRAINT CK_job_skills_level CHECK (required_level BETWEEN 1 AND 5),
    CONSTRAINT CK_job_skills_weight CHECK (weight > 0 AND weight <= 100)
);

CREATE TABLE dbo.job_quality_assessments (
    id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_job_quality_assessments PRIMARY KEY,
    job_id BIGINT NOT NULL,
    score DECIMAL(5,2) NOT NULL,
    rules_version VARCHAR(30) NOT NULL,
    breakdown_json NVARCHAR(MAX) NOT NULL,
    recommendations_json NVARCHAR(MAX) NOT NULL,
    evaluated_at DATETIME2(3) NOT NULL,
    CONSTRAINT FK_job_quality_assessments_job FOREIGN KEY (job_id) REFERENCES dbo.jobs(id),
    CONSTRAINT CK_job_quality_assessments_score CHECK (score BETWEEN 0 AND 100),
    CONSTRAINT CK_job_quality_assessments_breakdown CHECK (ISJSON(breakdown_json) = 1),
    CONSTRAINT CK_job_quality_assessments_recommendations CHECK (ISJSON(recommendations_json) = 1)
);

CREATE TABLE dbo.compatibility_scores (
    id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_compatibility_scores PRIMARY KEY,
    job_id BIGINT NOT NULL,
    freelancer_id BIGINT NOT NULL,
    score DECIMAL(5,2) NOT NULL,
    rules_version VARCHAR(30) NOT NULL,
    breakdown_json NVARCHAR(MAX) NOT NULL,
    evaluated_at DATETIME2(3) NOT NULL,
    CONSTRAINT FK_compatibility_scores_job FOREIGN KEY (job_id) REFERENCES dbo.jobs(id),
    CONSTRAINT FK_compatibility_scores_freelancer FOREIGN KEY (freelancer_id) REFERENCES dbo.freelancer_profiles(user_id),
    CONSTRAINT CK_compatibility_scores_score CHECK (score BETWEEN 0 AND 100),
    CONSTRAINT CK_compatibility_scores_breakdown CHECK (ISJSON(breakdown_json) = 1)
);

CREATE TABLE dbo.proposals (
    id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_proposals PRIMARY KEY,
    job_id BIGINT NOT NULL,
    freelancer_id BIGINT NOT NULL,
    cover_letter NVARCHAR(MAX) NOT NULL,
    proposed_budget DECIMAL(19,2) NOT NULL,
    estimated_days INT NOT NULL,
    status VARCHAR(20) NOT NULL,
    submitted_at DATETIME2(3) NOT NULL,
    updated_at DATETIME2(3) NOT NULL,
    row_ver ROWVERSION NOT NULL,
    CONSTRAINT FK_proposals_job FOREIGN KEY (job_id) REFERENCES dbo.jobs(id),
    CONSTRAINT FK_proposals_freelancer FOREIGN KEY (freelancer_id) REFERENCES dbo.freelancer_profiles(user_id),
    CONSTRAINT UQ_proposals_job_freelancer UNIQUE (job_id,freelancer_id),
    CONSTRAINT UQ_proposals_id_job_freelancer UNIQUE (id,job_id,freelancer_id),
    CONSTRAINT CK_proposals_budget CHECK (proposed_budget >= 0),
    CONSTRAINT CK_proposals_days CHECK (estimated_days > 0),
    CONSTRAINT CK_proposals_status CHECK (status IN ('PENDING','ACCEPTED','REJECTED','WITHDRAWN'))
);
