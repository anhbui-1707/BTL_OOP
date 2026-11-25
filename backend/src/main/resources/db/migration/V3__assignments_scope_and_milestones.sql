IF DB_NAME() <> N'LinkIT_V2' THROW 51000, 'Migration requires LinkIT_V2.', 1;


SET ANSI_NULLS ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET QUOTED_IDENTIFIER ON;
SET NUMERIC_ROUNDABORT OFF;

CREATE TABLE dbo.assignments (
    id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_assignments PRIMARY KEY,
    job_id BIGINT NOT NULL,
    proposal_id BIGINT NOT NULL,
    client_id BIGINT NOT NULL,
    freelancer_id BIGINT NOT NULL,
    agreed_budget DECIMAL(19,2) NOT NULL,
    currency_code CHAR(3) NOT NULL,
    status VARCHAR(25) NOT NULL,
    started_at DATETIME2(3) NULL,
    completed_at DATETIME2(3) NULL,
    created_at DATETIME2(3) NOT NULL,
    row_ver ROWVERSION NOT NULL,
    CONSTRAINT UQ_assignments_job UNIQUE (job_id),
    CONSTRAINT UQ_assignments_proposal UNIQUE (proposal_id),
    CONSTRAINT FK_assignments_job FOREIGN KEY (job_id) REFERENCES dbo.jobs(id),
    CONSTRAINT FK_assignments_proposal FOREIGN KEY (proposal_id) REFERENCES dbo.proposals(id),
    CONSTRAINT FK_assignments_client FOREIGN KEY (client_id) REFERENCES dbo.client_profiles(user_id),
    CONSTRAINT FK_assignments_freelancer FOREIGN KEY (freelancer_id) REFERENCES dbo.freelancer_profiles(user_id),
    CONSTRAINT FK_assignments_job_client FOREIGN KEY (job_id,client_id) REFERENCES dbo.jobs(id,client_id),
    CONSTRAINT FK_assignments_proposal_job_freelancer FOREIGN KEY (proposal_id,job_id,freelancer_id) REFERENCES dbo.proposals(id,job_id,freelancer_id),
    CONSTRAINT CK_assignments_budget CHECK (agreed_budget >= 0),
    CONSTRAINT CK_assignments_status CHECK (status IN ('PENDING_SCOPE','ACTIVE','AWAITING_ACCEPTANCE','COMPLETED','CANCELLED'))
);

CREATE TABLE dbo.scope_versions (
    id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_scope_versions PRIMARY KEY,
    assignment_id BIGINT NOT NULL,
    version_number INT NOT NULL,
    deliverables NVARCHAR(MAX) NOT NULL,
    exclusions NVARCHAR(MAX) NULL,
    acceptance_criteria NVARCHAR(MAX) NOT NULL,
    budget DECIMAL(19,2) NOT NULL,
    deadline DATE NOT NULL,
    status VARCHAR(20) NOT NULL,
    created_by BIGINT NOT NULL,
    created_at DATETIME2(3) NOT NULL,
    locked_at DATETIME2(3) NULL,
    CONSTRAINT FK_scope_versions_assignment FOREIGN KEY (assignment_id) REFERENCES dbo.assignments(id),
    CONSTRAINT FK_scope_versions_creator FOREIGN KEY (created_by) REFERENCES dbo.users(id),
    CONSTRAINT UQ_scope_versions_assignment_version UNIQUE (assignment_id,version_number),
    CONSTRAINT UQ_scope_versions_assignment_id UNIQUE (assignment_id,id),
    CONSTRAINT CK_scope_versions_number CHECK (version_number > 0),
    CONSTRAINT CK_scope_versions_budget CHECK (budget >= 0),
    CONSTRAINT CK_scope_versions_status CHECK (status IN ('DRAFT','PENDING_APPROVAL','LOCKED','SUPERSEDED'))
);
CREATE UNIQUE INDEX UX_scope_versions_locked ON dbo.scope_versions(assignment_id) WHERE status = 'LOCKED';

CREATE TABLE dbo.scope_approvals (
    id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_scope_approvals PRIMARY KEY,
    scope_version_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    party_role VARCHAR(20) NOT NULL,
    approved_at DATETIME2(3) NOT NULL,
    CONSTRAINT FK_scope_approvals_scope FOREIGN KEY (scope_version_id) REFERENCES dbo.scope_versions(id),
    CONSTRAINT FK_scope_approvals_user FOREIGN KEY (user_id) REFERENCES dbo.users(id),
    CONSTRAINT UQ_scope_approvals_scope_role UNIQUE (scope_version_id,party_role),
    CONSTRAINT CK_scope_approvals_role CHECK (party_role IN ('CLIENT','FREELANCER'))
);

CREATE TABLE dbo.milestones (
    id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_milestones PRIMARY KEY,
    assignment_id BIGINT NOT NULL,
    scope_version_id BIGINT NOT NULL,
    title NVARCHAR(200) NOT NULL,
    description NVARCHAR(MAX) NOT NULL,
    acceptance_criteria NVARCHAR(MAX) NOT NULL,
    due_date DATE NOT NULL,
    amount DECIMAL(19,2) NOT NULL,
    is_required BIT NOT NULL,
    sort_order INT NOT NULL,
    status VARCHAR(20) NOT NULL,
    approved_at DATETIME2(3) NULL,
    created_at DATETIME2(3) NOT NULL,
    row_ver ROWVERSION NOT NULL,
    CONSTRAINT FK_milestones_assignment FOREIGN KEY (assignment_id) REFERENCES dbo.assignments(id),
    CONSTRAINT FK_milestones_assignment_scope FOREIGN KEY (assignment_id,scope_version_id) REFERENCES dbo.scope_versions(assignment_id,id),
    CONSTRAINT UQ_milestones_assignment_id UNIQUE (assignment_id,id),
    CONSTRAINT CK_milestones_amount CHECK (amount >= 0),
    CONSTRAINT CK_milestones_sort CHECK (sort_order > 0),
    CONSTRAINT CK_milestones_status CHECK (status IN ('PLANNED','IN_PROGRESS','SUBMITTED','REVISION_REQUIRED','APPROVED','CANCELLED'))
);

CREATE TABLE dbo.milestone_submissions (
    id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_milestone_submissions PRIMARY KEY,
    milestone_id BIGINT NOT NULL,
    submission_number INT NOT NULL,
    submitted_by BIGINT NOT NULL,
    evidence_url NVARCHAR(1000) NULL,
    submission_note NVARCHAR(MAX) NOT NULL,
    status VARCHAR(20) NOT NULL,
    reviewed_by BIGINT NULL,
    review_note NVARCHAR(MAX) NULL,
    submitted_at DATETIME2(3) NOT NULL,
    reviewed_at DATETIME2(3) NULL,
    CONSTRAINT FK_milestone_submissions_milestone FOREIGN KEY (milestone_id) REFERENCES dbo.milestones(id),
    CONSTRAINT FK_milestone_submissions_submitter FOREIGN KEY (submitted_by) REFERENCES dbo.users(id),
    CONSTRAINT FK_milestone_submissions_reviewer FOREIGN KEY (reviewed_by) REFERENCES dbo.users(id),
    CONSTRAINT UQ_milestone_submissions_number UNIQUE (milestone_id,submission_number),
    CONSTRAINT CK_milestone_submissions_number CHECK (submission_number > 0),
    CONSTRAINT CK_milestone_submissions_status CHECK (status IN ('SUBMITTED','APPROVED','REVISION_REQUIRED'))
);
