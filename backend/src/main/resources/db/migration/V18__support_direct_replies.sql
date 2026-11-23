ALTER TABLE dbo.support_requests ADD sender_user_id BIGINT NULL, admin_reply NVARCHAR(4000) NULL, replied_at DATETIME2(3) NULL;
GO
CREATE INDEX ix_support_requests_sender_user ON dbo.support_requests(sender_user_id, created_at DESC) WHERE sender_user_id IS NOT NULL;
