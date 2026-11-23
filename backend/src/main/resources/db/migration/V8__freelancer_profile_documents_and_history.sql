IF DB_NAME() <> N'LinkIT_V2' THROW 51000, 'Migration requires LinkIT_V2.', 1;

CREATE TABLE dbo.freelancer_cvs (
    id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_freelancer_cvs PRIMARY KEY,
    freelancer_id BIGINT NOT NULL,
    file_name NVARCHAR(255) NOT NULL,
    byte_size INT NOT NULL,
    content VARBINARY(MAX) NOT NULL,
    uploaded_at DATETIME2(3) NOT NULL,
    CONSTRAINT FK_freelancer_cvs_profile FOREIGN KEY (freelancer_id) REFERENCES dbo.freelancer_profiles(user_id),
    CONSTRAINT CK_freelancer_cvs_size CHECK (byte_size BETWEEN 1 AND 2097152 AND DATALENGTH(content) = byte_size)
);
CREATE INDEX IX_freelancer_cvs_owner ON dbo.freelancer_cvs(freelancer_id, uploaded_at DESC, id DESC);

CREATE TABLE dbo.work_experiences (
    id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_work_experiences PRIMARY KEY,
    freelancer_id BIGINT NOT NULL,
    company_name NVARCHAR(200) NOT NULL,
    position NVARCHAR(200) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NULL,
    is_current BIT NOT NULL,
    description NVARCHAR(MAX) NOT NULL,
    achievements NVARCHAR(MAX) NOT NULL,
    created_at DATETIME2(3) NOT NULL,
    updated_at DATETIME2(3) NOT NULL,
    version BIGINT NOT NULL CONSTRAINT DF_work_experiences_version DEFAULT 0,
    CONSTRAINT FK_work_experiences_profile FOREIGN KEY (freelancer_id) REFERENCES dbo.freelancer_profiles(user_id),
    CONSTRAINT CK_work_experiences_dates CHECK ((is_current = 1 AND end_date IS NULL) OR (is_current = 0 AND end_date IS NOT NULL AND end_date >= start_date)),
    CONSTRAINT CK_work_experiences_version CHECK (version >= 0)
);
CREATE INDEX IX_work_experiences_owner ON dbo.work_experiences(freelancer_id, start_date DESC, id DESC);

CREATE TABLE dbo.portfolio_projects (
    id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_portfolio_projects PRIMARY KEY,
    freelancer_id BIGINT NOT NULL,
    title NVARCHAR(200) NOT NULL,
    description NVARCHAR(MAX) NOT NULL,
    project_role NVARCHAR(200) NOT NULL,
    technologies NVARCHAR(500) NOT NULL,
    project_url NVARCHAR(1000) NULL,
    github_url NVARCHAR(1000) NULL,
    start_date DATE NULL,
    end_date DATE NULL,
    created_at DATETIME2(3) NOT NULL,
    updated_at DATETIME2(3) NOT NULL,
    version BIGINT NOT NULL CONSTRAINT DF_portfolio_projects_version DEFAULT 0,
    CONSTRAINT FK_portfolio_projects_profile FOREIGN KEY (freelancer_id) REFERENCES dbo.freelancer_profiles(user_id),
    CONSTRAINT CK_portfolio_projects_dates CHECK (end_date IS NULL OR (start_date IS NOT NULL AND end_date >= start_date)),
    CONSTRAINT CK_portfolio_projects_version CHECK (version >= 0)
);
CREATE INDEX IX_portfolio_projects_owner ON dbo.portfolio_projects(freelancer_id, created_at DESC, id DESC);
