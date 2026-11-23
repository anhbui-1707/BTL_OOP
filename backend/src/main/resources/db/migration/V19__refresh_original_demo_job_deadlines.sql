-- Flyway V19: one-time repair of the original November 2026 demo recruitment dates.
-- No-op for databases that do not match the original demo job signatures.
-- The original demo has jobs 11..42, each with a November deadline derived from
-- 2026-11-01 + (7 + id % 15) days. These were OPEN before expiry automation.
IF DB_NAME() = N'LinkIT_V2'
   AND EXISTS (SELECT 1 FROM dbo.users WHERE id = 1 AND email = N'client@linkit.test')
   AND EXISTS (SELECT 1 FROM dbo.users WHERE id = 31 AND email = N'freelancer@linkit.test')
   AND (SELECT COUNT_BIG(*) FROM dbo.jobs WHERE id BETWEEN 11 AND 42) = 32
   AND NOT EXISTS (
       SELECT 1 FROM dbo.jobs AS j
       WHERE j.id BETWEEN 11 AND 42
         AND (j.client_id <> ((j.id - 1) % 30 + 1)
              OR j.deadline <> DATEADD(day, 7 + j.id % 15, CONVERT(date, '2026-11-01'))
              OR j.status NOT IN ('OPEN', 'CLOSED')
              OR j.title NOT LIKE N'% cho %')
   )
   AND NOT EXISTS (SELECT 1 FROM dbo.assignments WHERE job_id BETWEEN 11 AND 42)
BEGIN
    UPDATE dbo.jobs
    SET deadline = DATEADD(day, (id - 11) * 2, CONVERT(date, '2026-12-01')),
        status = 'OPEN',
        updated_at = SYSUTCDATETIME()
    WHERE id BETWEEN 11 AND 42
      AND status IN ('OPEN', 'CLOSED');
END;
