IF DB_NAME() <> N'LinkIT_V2' THROW 51000, 'Migration requires LinkIT_V2.', 1;
CREATE TABLE dbo.notifications (
    id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_notifications PRIMARY KEY,
    recipient_id BIGINT NOT NULL,
    source_audit_id BIGINT NOT NULL,
    kind VARCHAR(80) NOT NULL,
    title NVARCHAR(200) NOT NULL,
    description NVARCHAR(1000) NOT NULL,
    resource_type VARCHAR(30) NOT NULL,
    resource_id BIGINT NOT NULL,
    job_id BIGINT NULL,
    section VARCHAR(30) NULL,
    created_at DATETIME2(3) NOT NULL,
    read_at DATETIME2(3) NULL,
    CONSTRAINT FK_notifications_recipient FOREIGN KEY(recipient_id) REFERENCES dbo.users(id),
    CONSTRAINT FK_notifications_audit FOREIGN KEY(source_audit_id) REFERENCES dbo.audit_logs(id),
    CONSTRAINT UQ_notifications_event_recipient_kind UNIQUE(source_audit_id,recipient_id,kind),
    CONSTRAINT CK_notifications_resource CHECK(resource_type IN ('JOB_PROPOSAL','PROPOSAL','ASSIGNMENT','USER')),
    CONSTRAINT CK_notifications_read CHECK(read_at IS NULL OR read_at >= created_at)
);
CREATE INDEX IX_notifications_inbox ON dbo.notifications(recipient_id,created_at DESC,id DESC);
CREATE INDEX IX_notifications_unread ON dbo.notifications(recipient_id,id) WHERE read_at IS NULL;
CREATE TABLE dbo.notification_delivery_cursor (
    id INT NOT NULL CONSTRAINT PK_notification_delivery_cursor PRIMARY KEY,
    last_audit_id BIGINT NOT NULL,
    CONSTRAINT CK_notification_delivery_cursor_singleton CHECK(id=1 AND last_audit_id>=0)
);
-- Start at deployment; do not synthesize historical/demo notifications.
INSERT INTO dbo.notification_delivery_cursor(id,last_audit_id)
SELECT 1,COALESCE(MAX(id),0) FROM dbo.audit_logs WITH(READCOMMITTEDLOCK);
-- This cursor is an immutable deployment boundary, not a moving watermark:
-- identity values can commit out of order. Receipts prevent losing late commits.
CREATE TABLE dbo.notification_delivery_receipts (
    source_audit_id BIGINT NOT NULL CONSTRAINT PK_notification_delivery_receipts PRIMARY KEY,
    CONSTRAINT FK_notification_delivery_receipts_audit FOREIGN KEY(source_audit_id) REFERENCES dbo.audit_logs(id)
);
