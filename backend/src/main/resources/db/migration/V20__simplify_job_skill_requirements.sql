
ALTER TABLE dbo.job_skills DROP CONSTRAINT CK_job_skills_level;
ALTER TABLE dbo.job_skills DROP CONSTRAINT CK_job_skills_weight;
ALTER TABLE dbo.job_skills DROP COLUMN required_level, weight;
