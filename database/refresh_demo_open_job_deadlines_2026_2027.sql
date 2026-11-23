-- Run manually in SSMS ONLY for the original LinkIT demo database.
-- Never run against real users' production data. Back up the database first.
USE [LinkIT_V2];
GO
SET XACT_ABORT ON;
BEGIN TRANSACTION;
IF DB_NAME() <> N'LinkIT_V2'
    THROW 51000, 'Wrong database.', 1;
IF NOT EXISTS (SELECT 1 FROM dbo.users WHERE id = 1 AND email = 'client@linkit.test')
   OR NOT EXISTS (SELECT 1 FROM dbo.users WHERE id = 31 AND email = 'freelancer@linkit.test')
   OR (SELECT COUNT(*) FROM dbo.jobs WHERE id BETWEEN 11 AND 42) <> 32
   OR EXISTS (SELECT 1 FROM dbo.jobs WHERE id BETWEEN 11 AND 42 AND (status NOT IN ('OPEN','CLOSED') OR title NOT LIKE N'% cho %'))
   OR EXISTS (SELECT 1 FROM dbo.assignments WHERE job_id BETWEEN 11 AND 42)
    THROW 51001, 'Not the expected demo dataset; no changes applied.', 1;

UPDATE j
SET deadline = DATEADD(day, (j.id - 11) * 2, CONVERT(date, '2026-12-01')),
    status = 'OPEN'
FROM dbo.jobs AS j
WHERE j.id BETWEEN 11 AND 42;

SELECT id, title, deadline, status FROM dbo.jobs WHERE id BETWEEN 11 AND 42 ORDER BY id;
COMMIT TRANSACTION;
GO
