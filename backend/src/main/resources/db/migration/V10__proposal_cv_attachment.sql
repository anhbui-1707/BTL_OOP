IF DB_NAME() <> N'LinkIT_V2' THROW 51000, 'Migration requires LinkIT_V2.', 1;

ALTER TABLE dbo.proposals ADD cv_id BIGINT NULL;


ALTER TABLE dbo.freelancer_cvs ADD CONSTRAINT UQ_freelancer_cvs_id_owner UNIQUE (id, freelancer_id);


EXEC sys.sp_executesql N'ALTER TABLE dbo.proposals WITH CHECK ADD CONSTRAINT FK_proposals_cv_owner
    FOREIGN KEY (cv_id, freelancer_id) REFERENCES dbo.freelancer_cvs(id, freelancer_id)
    ON DELETE NO ACTION ON UPDATE NO ACTION;';

EXEC sys.sp_executesql N'CREATE INDEX IX_proposals_cv_id ON dbo.proposals(cv_id) WHERE cv_id IS NOT NULL;';
