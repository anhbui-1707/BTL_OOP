
IF DB_NAME() <> N'LinkIT_V2'
    THROW 51000, 'Migration requires LinkIT_V2.', 1;

ALTER TABLE dbo.freelancer_profiles
ADD is_public BIT NOT NULL
    CONSTRAINT DF_freelancer_profiles_is_public DEFAULT 0;
