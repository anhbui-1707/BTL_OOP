-- Additive migration: preserve existing profiles and descriptions.
ALTER TABLE dbo.client_profiles ADD job_title NVARCHAR(200) NULL;
