CREATE TABLE dbo.support_requests (
    id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    sender_name NVARCHAR(150) NOT NULL,
    sender_email VARCHAR(254) NOT NULL,
    subject NVARCHAR(200) NOT NULL,
    message NVARCHAR(4000) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'NEW',
    created_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT ck_support_request_status CHECK (status IN ('NEW','IN_PROGRESS','RESOLVED'))
);
CREATE INDEX ix_support_requests_status_created ON dbo.support_requests(status, created_at DESC);
