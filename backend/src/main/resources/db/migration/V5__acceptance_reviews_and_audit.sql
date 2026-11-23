IF DB_NAME() <> N'LinkIT_V2' THROW 51000, 'Migration requires LinkIT_V2.', 1;

CREATE TABLE dbo.final_acceptances (
    id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_final_acceptances PRIMARY KEY,
    assignment_id BIGINT NOT NULL,
    scope_version_id BIGINT NOT NULL,
    accepted_by BIGINT NOT NULL,
    acceptance_note NVARCHAR(MAX) NULL,
    accepted_at DATETIME2(3) NOT NULL,
    CONSTRAINT UQ_final_acceptances_assignment UNIQUE (assignment_id),
    CONSTRAINT FK_final_acceptances_assignment FOREIGN KEY (assignment_id) REFERENCES dbo.assignments(id),
    CONSTRAINT FK_final_acceptances_scope FOREIGN KEY (assignment_id,scope_version_id) REFERENCES dbo.scope_versions(assignment_id,id),
    CONSTRAINT FK_final_acceptances_acceptor FOREIGN KEY (accepted_by) REFERENCES dbo.users(id)
);

CREATE TABLE dbo.reviews (
    id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_reviews PRIMARY KEY,
    assignment_id BIGINT NOT NULL,
    reviewer_id BIGINT NOT NULL,
    freelancer_id BIGINT NOT NULL,
    overall_rating TINYINT NOT NULL,
    quality_rating TINYINT NOT NULL,
    communication_rating TINYINT NOT NULL,
    timeliness_rating TINYINT NOT NULL,
    comment NVARCHAR(2000) NULL,
    created_at DATETIME2(3) NOT NULL,
    CONSTRAINT UQ_reviews_assignment UNIQUE (assignment_id),
    CONSTRAINT FK_reviews_acceptance FOREIGN KEY (assignment_id) REFERENCES dbo.final_acceptances(assignment_id),
    CONSTRAINT FK_reviews_reviewer FOREIGN KEY (reviewer_id) REFERENCES dbo.users(id),
    CONSTRAINT FK_reviews_freelancer FOREIGN KEY (freelancer_id) REFERENCES dbo.freelancer_profiles(user_id),
    CONSTRAINT CK_reviews_overall CHECK (overall_rating BETWEEN 1 AND 5),
    CONSTRAINT CK_reviews_quality CHECK (quality_rating BETWEEN 1 AND 5),
    CONSTRAINT CK_reviews_communication CHECK (communication_rating BETWEEN 1 AND 5),
    CONSTRAINT CK_reviews_timeliness CHECK (timeliness_rating BETWEEN 1 AND 5)
);

CREATE TABLE dbo.audit_logs (
    id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_audit_logs PRIMARY KEY,
    actor_user_id BIGINT NULL,
    entity_type VARCHAR(60) NOT NULL,
    entity_id BIGINT NOT NULL,
    action VARCHAR(80) NOT NULL,
    before_json NVARCHAR(MAX) NULL,
    after_json NVARCHAR(MAX) NULL,
    request_id UNIQUEIDENTIFIER NULL,
    created_at DATETIME2(3) NOT NULL,
    CONSTRAINT FK_audit_logs_actor FOREIGN KEY (actor_user_id) REFERENCES dbo.users(id),
    CONSTRAINT CK_audit_logs_before CHECK (before_json IS NULL OR ISJSON(before_json) = 1),
    CONSTRAINT CK_audit_logs_after CHECK (after_json IS NULL OR ISJSON(after_json) = 1)
);
