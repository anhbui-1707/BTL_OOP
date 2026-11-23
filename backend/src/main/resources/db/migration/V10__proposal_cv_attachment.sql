IF DB_NAME() <> N'LinkIT_V2' THROW 51000, 'Migration requires LinkIT_V2.', 1;

-- Existing proposals remain unchanged and have no attachment.
ALTER TABLE dbo.proposals ADD cv_id BIGINT NULL;

-- Enforce both attachment identity and ownership at the database boundary.
ALTER TABLE dbo.freelancer_cvs ADD CONSTRAINT UQ_freelancer_cvs_id_owner UNIQUE (id, freelancer_id);

-- Compile references to the new column only after ALTER TABLE has executed.
-- An IF COL_LENGTH guard alone would not create a separate compilation batch.
EXEC sys.sp_executesql N'ALTER TABLE dbo.proposals WITH CHECK ADD CONSTRAINT FK_proposals_cv_owner
    FOREIGN KEY (cv_id, freelancer_id) REFERENCES dbo.freelancer_cvs(id, freelancer_id)
    ON DELETE NO ACTION ON UPDATE NO ACTION;';

EXEC sys.sp_executesql N'CREATE INDEX IX_proposals_cv_id ON dbo.proposals(cv_id) WHERE cv_id IS NOT NULL;';
