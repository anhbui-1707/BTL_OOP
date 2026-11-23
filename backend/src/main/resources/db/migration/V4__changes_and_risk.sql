IF DB_NAME() <> N'LinkIT_V2' THROW 51000, 'Migration requires LinkIT_V2.', 1;

CREATE TABLE dbo.change_requests (
    id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_change_requests PRIMARY KEY,
    assignment_id BIGINT NOT NULL,
    base_scope_version_id BIGINT NOT NULL,
    requested_by BIGINT NOT NULL,
    title NVARCHAR(200) NOT NULL,
    reason NVARCHAR(MAX) NOT NULL,
    proposed_deliverables NVARCHAR(MAX) NOT NULL,
    budget_delta DECIMAL(19,2) NOT NULL CONSTRAINT DF_change_requests_budget DEFAULT 0,
    days_delta INT NOT NULL CONSTRAINT DF_change_requests_days DEFAULT 0,
    status VARCHAR(20) NOT NULL,
    result_scope_version_id BIGINT NULL,
    created_at DATETIME2(3) NOT NULL,
    resolved_at DATETIME2(3) NULL,
    row_ver ROWVERSION NOT NULL,
    CONSTRAINT FK_change_requests_assignment FOREIGN KEY (assignment_id) REFERENCES dbo.assignments(id),
    CONSTRAINT FK_change_requests_requester FOREIGN KEY (requested_by) REFERENCES dbo.users(id),
    CONSTRAINT FK_change_requests_base_scope FOREIGN KEY (assignment_id,base_scope_version_id) REFERENCES dbo.scope_versions(assignment_id,id),
    CONSTRAINT FK_change_requests_result_scope FOREIGN KEY (assignment_id,result_scope_version_id) REFERENCES dbo.scope_versions(assignment_id,id),
    CONSTRAINT CK_change_requests_status CHECK (status IN ('PENDING','APPROVED','REJECTED','APPLIED','CANCELLED'))
);

CREATE TABLE dbo.change_request_approvals (
    id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_change_request_approvals PRIMARY KEY,
    change_request_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    party_role VARCHAR(20) NOT NULL,
    decision VARCHAR(20) NOT NULL,
    comment NVARCHAR(MAX) NULL,
    decided_at DATETIME2(3) NOT NULL,
    CONSTRAINT FK_change_request_approvals_request FOREIGN KEY (change_request_id) REFERENCES dbo.change_requests(id),
    CONSTRAINT FK_change_request_approvals_user FOREIGN KEY (user_id) REFERENCES dbo.users(id),
    CONSTRAINT UQ_change_request_approvals_request_role UNIQUE (change_request_id,party_role),
    CONSTRAINT CK_change_request_approvals_role CHECK (party_role IN ('CLIENT','FREELANCER')),
    CONSTRAINT CK_change_request_approvals_decision CHECK (decision IN ('APPROVED','REJECTED'))
);

CREATE TABLE dbo.risk_alerts (
    id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_risk_alerts PRIMARY KEY,
    assignment_id BIGINT NOT NULL,
    milestone_id BIGINT NULL,
    risk_type VARCHAR(40) NOT NULL,
    severity VARCHAR(10) NOT NULL,
    title NVARCHAR(200) NOT NULL,
    description NVARCHAR(MAX) NOT NULL,
    rule_code VARCHAR(60) NOT NULL,
    status VARCHAR(20) NOT NULL,
    detected_at DATETIME2(3) NOT NULL,
    resolved_at DATETIME2(3) NULL,
    CONSTRAINT FK_risk_alerts_assignment FOREIGN KEY (assignment_id) REFERENCES dbo.assignments(id),
    CONSTRAINT FK_risk_alerts_milestone FOREIGN KEY (milestone_id) REFERENCES dbo.milestones(id),
    CONSTRAINT FK_risk_alerts_assignment_milestone FOREIGN KEY (assignment_id,milestone_id) REFERENCES dbo.milestones(assignment_id,id),
    CONSTRAINT CK_risk_alerts_severity CHECK (severity IN ('LOW','MEDIUM','HIGH','CRITICAL')),
    CONSTRAINT CK_risk_alerts_status CHECK (status IN ('OPEN','ACKNOWLEDGED','RESOLVED'))
);
