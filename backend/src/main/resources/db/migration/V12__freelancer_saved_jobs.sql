IF DB_NAME() <> N'LinkIT_V2' THROW 51000, 'Migration requires LinkIT_V2.', 1;

CREATE TABLE dbo.saved_jobs (
    id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_saved_jobs PRIMARY KEY,
    freelancer_id BIGINT NOT NULL,
    job_id BIGINT NOT NULL,
    saved_at DATETIME2(3) NOT NULL,
    CONSTRAINT FK_saved_jobs_freelancer FOREIGN KEY (freelancer_id) REFERENCES dbo.freelancer_profiles(user_id),
    CONSTRAINT FK_saved_jobs_job FOREIGN KEY (job_id) REFERENCES dbo.jobs(id) ON DELETE CASCADE,
    CONSTRAINT UQ_saved_jobs_freelancer_job UNIQUE (freelancer_id, job_id)
);

CREATE INDEX IX_saved_jobs_freelancer_date ON dbo.saved_jobs(freelancer_id, saved_at DESC, id DESC);
CREATE INDEX IX_saved_jobs_job ON dbo.saved_jobs(job_id);
