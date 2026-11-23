IF DB_NAME() <> N'LinkIT_V2' THROW 51000, 'Migration requires LinkIT_V2.', 1;

CREATE TABLE dbo.users (
    id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_users PRIMARY KEY,
    email NVARCHAR(254) COLLATE Latin1_General_100_CI_AS NOT NULL,
    password_hash VARCHAR(100) NOT NULL,
    full_name NVARCHAR(150) NOT NULL,
    phone_number VARCHAR(20) NULL,
    avatar_url NVARCHAR(1000) NULL,
    status VARCHAR(20) NOT NULL,
    email_verified_at DATETIME2(3) NULL,
    created_at DATETIME2(3) NOT NULL,
    updated_at DATETIME2(3) NOT NULL,
    row_ver ROWVERSION NOT NULL,
    CONSTRAINT UQ_users_email UNIQUE (email),
    CONSTRAINT CK_users_status CHECK (status IN ('ACTIVE','LOCKED','DISABLED'))
);

CREATE TABLE dbo.user_roles (
    user_id BIGINT NOT NULL,
    role VARCHAR(20) NOT NULL,
    assigned_at DATETIME2(3) NOT NULL,
    CONSTRAINT PK_user_roles PRIMARY KEY (user_id,role),
    CONSTRAINT FK_user_roles_user FOREIGN KEY (user_id) REFERENCES dbo.users(id),
    CONSTRAINT CK_user_roles_role CHECK (role IN ('CLIENT','FREELANCER','ADMIN'))
);

CREATE TABLE dbo.refresh_tokens (
    id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_refresh_tokens PRIMARY KEY,
    user_id BIGINT NOT NULL,
    token_hash VARBINARY(32) NOT NULL,
    expires_at DATETIME2(3) NOT NULL,
    revoked_at DATETIME2(3) NULL,
    created_at DATETIME2(3) NOT NULL,
    CONSTRAINT UQ_refresh_tokens_hash UNIQUE (token_hash),
    CONSTRAINT FK_refresh_tokens_user FOREIGN KEY (user_id) REFERENCES dbo.users(id)
);

CREATE TABLE dbo.client_profiles (
    user_id BIGINT NOT NULL CONSTRAINT PK_client_profiles PRIMARY KEY,
    company_name NVARCHAR(200) NULL,
    company_website NVARCHAR(1000) NULL,
    industry NVARCHAR(100) NULL,
    description NVARCHAR(MAX) NULL,
    location NVARCHAR(200) NULL,
    updated_at DATETIME2(3) NOT NULL,
    CONSTRAINT FK_client_profiles_user FOREIGN KEY (user_id) REFERENCES dbo.users(id)
);

CREATE TABLE dbo.freelancer_profiles (
    user_id BIGINT NOT NULL CONSTRAINT PK_freelancer_profiles PRIMARY KEY,
    headline NVARCHAR(200) NULL,
    bio NVARCHAR(MAX) NULL,
    years_experience SMALLINT NOT NULL,
    hourly_rate DECIMAL(19,2) NULL,
    location NVARCHAR(200) NULL,
    availability_status VARCHAR(20) NOT NULL,
    portfolio_url NVARCHAR(1000) NULL,
    updated_at DATETIME2(3) NOT NULL,
    row_ver ROWVERSION NOT NULL,
    CONSTRAINT FK_freelancer_profiles_user FOREIGN KEY (user_id) REFERENCES dbo.users(id),
    CONSTRAINT CK_freelancer_profiles_experience CHECK (years_experience >= 0),
    CONSTRAINT CK_freelancer_profiles_rate CHECK (hourly_rate >= 0),
    CONSTRAINT CK_freelancer_profiles_availability CHECK (availability_status IN ('AVAILABLE','BUSY','UNAVAILABLE'))
);

CREATE TABLE dbo.skills (
    id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_skills PRIMARY KEY,
    name NVARCHAR(100) NOT NULL,
    category NVARCHAR(100) NULL,
    is_active BIT NOT NULL CONSTRAINT DF_skills_active DEFAULT 1,
    CONSTRAINT UQ_skills_name UNIQUE (name)
);

CREATE TABLE dbo.freelancer_skills (
    freelancer_id BIGINT NOT NULL,
    skill_id BIGINT NOT NULL,
    proficiency TINYINT NOT NULL,
    years_experience SMALLINT NULL,
    CONSTRAINT PK_freelancer_skills PRIMARY KEY (freelancer_id,skill_id),
    CONSTRAINT FK_freelancer_skills_freelancer FOREIGN KEY (freelancer_id) REFERENCES dbo.freelancer_profiles(user_id),
    CONSTRAINT FK_freelancer_skills_skill FOREIGN KEY (skill_id) REFERENCES dbo.skills(id),
    CONSTRAINT CK_freelancer_skills_proficiency CHECK (proficiency BETWEEN 1 AND 5),
    CONSTRAINT CK_freelancer_skills_experience CHECK (years_experience >= 0)
);
