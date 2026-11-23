SET NOCOUNT ON;
IF DB_NAME()<>N'LinkIT_V2' THROW 51000,'Verification requires LinkIT_V2.',1;
-- Read-only. Set to 0 after intentionally editing demo records through the application.
DECLARE @assert_pristine bit=1;
DECLARE @targets TABLE(name sysname,expected int,key_column sysname,first_id bigint,last_id bigint);
INSERT @targets VALUES
('users',72,'id',2000001,2000072),('user_roles',72,'user_id',2000001,2000072),
('client_profiles',20,'user_id',2000001,2000020),('freelancer_profiles',50,'user_id',2000021,2000070),
('freelancer_skills',200,'freelancer_id',2000021,2000070),('work_experiences',50,'id',2000001,2000050),
('portfolio_projects',50,'id',2000001,2000050),('freelancer_cvs',50,'id',2000001,2000050),
('jobs',100,'id',2000001,2000100),('job_skills',300,'job_id',2000001,2000100),
('job_quality_assessments',100,'id',2000001,2000100),('proposals',250,'id',2000001,2000250),
('compatibility_scores',300,'id',2000001,2000300),('saved_jobs',100,'id',2000001,2000100),
('assignments',35,'id',2000001,2000035),('scope_versions',35,'id',2000001,2000035),
('scope_approvals',70,'id',2000001,2000070),('milestones',120,'id',2000001,2000120),
('milestone_submissions',80,'id',2000001,2000080),('risk_alerts',20,'id',2000001,2000020),
('final_acceptances',15,'id',2000001,2000015),('reviews',15,'id',2000001,2000015),
('audit_logs',300,'id',2000001,2000300),('notifications',180,'id',2000001,2000180),
('notification_delivery_receipts',300,'source_audit_id',2000001,2000300);
DECLARE @report TABLE(name sysname,expected int,demo_count bigint,database_total bigint);
DECLARE @name sysname,@expected int,@key sysname,@first bigint,@last bigint,@sql nvarchar(max),@demo bigint,@total bigint;
DECLARE targets CURSOR LOCAL FAST_FORWARD FOR SELECT * FROM @targets;
OPEN targets;FETCH NEXT FROM targets INTO @name,@expected,@key,@first,@last;
WHILE @@FETCH_STATUS=0
BEGIN
 SET @sql=N'SELECT @demo=COUNT_BIG(*) FROM dbo.'+QUOTENAME(@name)+N' WHERE '+QUOTENAME(@key)+N' BETWEEN @first AND @last; SELECT @total=COUNT_BIG(*) FROM dbo.'+QUOTENAME(@name)+N';';
 EXEC sys.sp_executesql @sql,N'@first bigint,@last bigint,@demo bigint OUTPUT,@total bigint OUTPUT',@first,@last,@demo OUTPUT,@total OUTPUT;
 INSERT @report VALUES(@name,@expected,@demo,@total);
 FETCH NEXT FROM targets INTO @name,@expected,@key,@first,@last;
END;
CLOSE targets;DEALLOCATE targets;
-- The catalog is shared: count distinct skills actually referenced by this demo.
INSERT @report SELECT 'skills',50,COUNT(DISTINCT skill_id),(SELECT COUNT_BIG(*) FROM dbo.skills)
FROM (SELECT skill_id FROM dbo.freelancer_skills WHERE freelancer_id BETWEEN 2000021 AND 2000070
UNION SELECT skill_id FROM dbo.job_skills WHERE job_id BETWEEN 2000001 AND 2000100) s;
SELECT * FROM @report ORDER BY name;
SELECT SUM(demo_count) AS scenario_records FROM @report;
SELECT status,COUNT_BIG(*) AS demo_jobs,MIN(deadline) AS earliest_deadline,MAX(deadline) AS latest_deadline
FROM dbo.jobs WHERE id BETWEEN 2000001 AND 2000100 GROUP BY status ORDER BY status;
SELECT status,COUNT_BIG(*) AS all_jobs FROM dbo.jobs GROUP BY status ORDER BY status;
SELECT COUNT(*) AS marker_count FROM dbo.audit_logs WHERE id=2009999 AND entity_type='demo_seed' AND action='DEMO_SEED_CREATED';
SELECT COUNT(*) AS marker_receipt FROM dbo.notification_delivery_receipts WHERE source_audit_id=2009999;
SELECT COUNT(*) AS legacy_change_requests FROM dbo.change_requests;
IF @assert_pristine=1 AND EXISTS(SELECT 1 FROM @report WHERE expected<>demo_count)
 THROW 51001,'Demo count mismatch. No data was changed; inspect report or intentional user edits.',1;
IF @assert_pristine=1 AND (SELECT COUNT(*) FROM dbo.jobs WHERE id BETWEEN 2000001 AND 2000100 AND status='OPEN' AND deadline>=CONVERT(date,SYSUTCDATETIME()))<>50
 THROW 51002,'Expected 50 unexpired demo OPEN jobs. Do not reopen expired/user-edited jobs automatically.',1;
IF EXISTS(SELECT 1 FROM dbo.change_requests WHERE id BETWEEN 2000001 AND 2009999)
 THROW 51003,'Unexpected Change Request in demo namespace.',1;
DBCC CHECKCONSTRAINTS WITH ALL_CONSTRAINTS;
