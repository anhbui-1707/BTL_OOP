CREATE TABLE dbo.password_reset_codes (
 id BIGINT IDENTITY(1,1) PRIMARY KEY,
 user_id BIGINT NOT NULL REFERENCES dbo.users(id),
 code_hash VARBINARY(32) NOT NULL,
 expires_at DATETIME2(3) NOT NULL,
 attempts INT NOT NULL DEFAULT 0,
 consumed_at DATETIME2(3) NULL,
 created_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME()
);
CREATE INDEX ix_password_reset_user_created ON dbo.password_reset_codes(user_id, created_at DESC);
