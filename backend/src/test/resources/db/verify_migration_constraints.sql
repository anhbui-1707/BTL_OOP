-- Run with sqlcmd -b -S localhost -E -C -d LinkIT_V2 -i <this file>.
-- Integration fixtures are always rolled back; this is not a demo seeder.
SET NOCOUNT ON;
SET XACT_ABORT OFF;
SET ANSI_NULLS ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET QUOTED_IDENTIFIER ON;
SET NUMERIC_ROUNDABORT OFF;
IF DB_NAME() <> N'LinkIT_V2' THROW 51000, 'Verification requires LinkIT_V2.', 1;
IF (SELECT COUNT(*) FROM sys.tables WHERE schema_id = SCHEMA_ID('dbo') AND name <> 'flyway_schema_history') <> 23
    THROW 51001, 'Expected 23 application tables.', 1;
IF (SELECT COUNT(*) FROM sys.key_constraints WHERE type = 'PK' AND parent_object_id IN
    (SELECT object_id FROM sys.tables WHERE schema_id = SCHEMA_ID('dbo') AND name <> 'flyway_schema_history')) <> 23
    THROW 51002, 'Expected 23 primary keys.', 1;
IF (SELECT COUNT(*) FROM sys.columns WHERE system_type_id = 189 AND object_id IN
    (SELECT object_id FROM sys.tables WHERE schema_id = SCHEMA_ID('dbo'))) <> 7
    THROW 51003, 'Expected seven ROWVERSION columns.', 1;
IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE schema_id = SCHEMA_ID('dbo')
    AND (is_disabled = 1 OR is_not_trusted = 1 OR delete_referential_action <> 0))
    THROW 51004, 'Foreign keys must be trusted, enabled and restrict deletion.', 1;

BEGIN TRANSACTION;
BEGIN TRY
    DECLARE @now DATETIME2(3) = SYSUTCDATETIME();
    INSERT dbo.users(email,password_hash,full_name,status,created_at,updated_at)
        VALUES (N'migration-client@example.invalid','unusable-test-hash',N'Test client','ACTIVE',@now,@now);
    DECLARE @client BIGINT = SCOPE_IDENTITY();
    INSERT dbo.users(email,password_hash,full_name,status,created_at,updated_at)
        VALUES (N'migration-freelancer@example.invalid','unusable-test-hash',N'Test freelancer','ACTIVE',@now,@now);
    DECLARE @freelancer BIGINT = SCOPE_IDENTITY();
    INSERT dbo.client_profiles(user_id,updated_at) VALUES (@client,@now);
    INSERT dbo.freelancer_profiles(user_id,years_experience,availability_status,updated_at)
        VALUES (@freelancer,1,'AVAILABLE',@now);
    -- Both alternate parties exist, so ownership tests exercise composite FKs.
    INSERT dbo.client_profiles(user_id,updated_at) VALUES (@freelancer,@now);
    INSERT dbo.freelancer_profiles(user_id,years_experience,availability_status,updated_at)
        VALUES (@client,1,'AVAILABLE',@now);
    INSERT dbo.jobs(client_id,title,description,deliverables,acceptance_criteria,budget_min,budget_max,deadline,status,created_at,updated_at)
        VALUES (@client,N'Test',N'Test',N'Test',N'Test',0,100,'20300101','OPEN',@now,@now);
    DECLARE @job BIGINT = SCOPE_IDENTITY();
    INSERT dbo.jobs(client_id,title,description,deliverables,acceptance_criteria,budget_min,budget_max,deadline,status,created_at,updated_at)
        VALUES (@client,N'Test 2',N'Test',N'Test',N'Test',0,100,'20300101','OPEN',@now,@now);
    DECLARE @job2 BIGINT = SCOPE_IDENTITY();
    INSERT dbo.proposals(job_id,freelancer_id,cover_letter,proposed_budget,estimated_days,status,submitted_at,updated_at)
        VALUES (@job,@freelancer,N'Test',50,1,'ACCEPTED',@now,@now);
    DECLARE @proposal BIGINT = SCOPE_IDENTITY();
    INSERT dbo.proposals(job_id,freelancer_id,cover_letter,proposed_budget,estimated_days,status,submitted_at,updated_at)
        VALUES (@job2,@freelancer,N'Test',50,1,'ACCEPTED',@now,@now);
    DECLARE @proposal2 BIGINT = SCOPE_IDENTITY();
    INSERT dbo.proposals(job_id,freelancer_id,cover_letter,proposed_budget,estimated_days,status,submitted_at,updated_at)
        VALUES (@job2,@client,N'Test mismatch',50,1,'PENDING',@now,@now);
    DECLARE @proposalMismatch BIGINT = SCOPE_IDENTITY();
    INSERT dbo.assignments(job_id,proposal_id,client_id,freelancer_id,agreed_budget,currency_code,status,created_at)
        VALUES (@job,@proposal,@client,@freelancer,50,'VND','ACTIVE',@now);
    DECLARE @assignment BIGINT = SCOPE_IDENTITY();
    INSERT dbo.assignments(job_id,proposal_id,client_id,freelancer_id,agreed_budget,currency_code,status,created_at)
        VALUES (@job2,@proposal2,@client,@freelancer,50,'VND','ACTIVE',@now);
    DECLARE @assignment2 BIGINT = SCOPE_IDENTITY();
    INSERT dbo.scope_versions(assignment_id,version_number,deliverables,acceptance_criteria,budget,deadline,status,created_by,created_at)
        VALUES (@assignment,1,N'Test',N'Test',50,'20300101','LOCKED',@client,@now);
    DECLARE @scope BIGINT = SCOPE_IDENTITY();
    INSERT dbo.scope_versions(assignment_id,version_number,deliverables,acceptance_criteria,budget,deadline,status,created_by,created_at)
        VALUES (@assignment2,1,N'Test',N'Test',50,'20300101','LOCKED',@client,@now);
    DECLARE @scope2 BIGINT = SCOPE_IDENTITY();
    INSERT dbo.milestones(assignment_id,scope_version_id,title,description,acceptance_criteria,due_date,amount,is_required,sort_order,status,created_at)
        VALUES (@assignment,@scope,N'Test',N'Test',N'Test','20300101',50,1,1,'PLANNED',@now);
    DECLARE @milestone BIGINT = SCOPE_IDENTITY();
    INSERT dbo.scope_approvals(scope_version_id,user_id,party_role,approved_at) VALUES (@scope,@client,'CLIENT',@now);

    DECLARE @cases TABLE (name VARCHAR(80), statement NVARCHAR(MAX));
    INSERT @cases VALUES
    ('case-insensitive email',N'INSERT dbo.users(email,password_hash,full_name,status,created_at,updated_at) VALUES (N''MIGRATION-CLIENT@EXAMPLE.INVALID'',''x'',N''x'',''ACTIVE'',@now,@now)'),
    ('one proposal per freelancer/job',N'INSERT dbo.proposals(job_id,freelancer_id,cover_letter,proposed_budget,estimated_days,status,submitted_at,updated_at) SELECT job_id,freelancer_id,cover_letter,proposed_budget,estimated_days,status,submitted_at,updated_at FROM dbo.proposals WHERE id=@proposal'),
    ('one assignment per job',N'INSERT dbo.assignments(job_id,proposal_id,client_id,freelancer_id,agreed_budget,currency_code,status,created_at) SELECT job_id,proposal_id,client_id,freelancer_id,agreed_budget,currency_code,status,created_at FROM dbo.assignments WHERE id=@assignment'),
    ('proposal matches assignment job',N'UPDATE dbo.assignments SET proposal_id=@proposalMismatch WHERE id=@assignment'),
    ('assignment matches job owner',N'UPDATE dbo.assignments SET client_id=@freelancer WHERE id=@assignment'),
    ('one locked scope',N'INSERT dbo.scope_versions(assignment_id,version_number,deliverables,acceptance_criteria,budget,deadline,status,created_by,created_at) VALUES (@assignment,2,N''x'',N''x'',0,''20300101'',''LOCKED'',@client,@now)'),
    ('one approval per party/version',N'INSERT dbo.scope_approvals(scope_version_id,user_id,party_role,approved_at) VALUES (@scope,@client,''CLIENT'',@now)'),
    ('milestone scope ownership',N'UPDATE dbo.milestones SET scope_version_id=@scope2 WHERE id=@milestone'),
    ('change base scope ownership',N'INSERT dbo.change_requests(assignment_id,base_scope_version_id,requested_by,title,reason,proposed_deliverables,status,created_at) VALUES (@assignment,@scope2,@client,N''x'',N''x'',N''x'',''PENDING'',@now)'),
    ('change result scope ownership',N'INSERT dbo.change_requests(assignment_id,base_scope_version_id,result_scope_version_id,requested_by,title,reason,proposed_deliverables,status,created_at) VALUES (@assignment,@scope,@scope2,@client,N''x'',N''x'',N''x'',''PENDING'',@now)'),
    ('risk milestone ownership',N'INSERT dbo.risk_alerts(assignment_id,milestone_id,risk_type,severity,title,description,rule_code,status,detected_at) VALUES (@assignment2,@milestone,''TEST'',''LOW'',N''x'',N''x'',''TEST'',''OPEN'',@now)'),
    ('acceptance scope ownership',N'INSERT dbo.final_acceptances(assignment_id,scope_version_id,accepted_by,accepted_at) VALUES (@assignment,@scope2,@client,@now)'),
    ('review requires acceptance',N'INSERT dbo.reviews(assignment_id,reviewer_id,freelancer_id,overall_rating,quality_rating,communication_rating,timeliness_rating,created_at) VALUES (@assignment,@client,@freelancer,5,5,5,5,@now)'),
    ('JSON validation',N'INSERT dbo.job_quality_assessments(job_id,score,rules_version,breakdown_json,recommendations_json,evaluated_at) VALUES (@job,50,''test'',N''invalid'',N''[]'',@now)'),
    ('score range',N'INSERT dbo.job_quality_assessments(job_id,score,rules_version,breakdown_json,recommendations_json,evaluated_at) VALUES (@job,101,''test'',N''{}'',N''[]'',@now)'),
    ('restrict history deletion',N'DELETE dbo.jobs WHERE id=@job');

    DECLARE @name VARCHAR(80), @statement NVARCHAR(MAX), @passed INT = 0;
    DECLARE cases CURSOR LOCAL FAST_FORWARD FOR SELECT name,statement FROM @cases;
    OPEN cases;
    FETCH NEXT FROM cases INTO @name,@statement;
    WHILE @@FETCH_STATUS = 0
    BEGIN
        BEGIN TRY
            EXEC sys.sp_executesql @statement,
                N'@now datetime2(3), @client bigint, @freelancer bigint, @job bigint, @proposal bigint, @proposal2 bigint, @assignment bigint, @assignment2 bigint, @scope bigint, @scope2 bigint, @milestone bigint, @proposalMismatch bigint',
                @now,@client,@freelancer,@job,@proposal,@proposal2,@assignment,@assignment2,@scope,@scope2,@milestone,@proposalMismatch;
            THROW 51005, 'Expected a constraint violation.', 1;
        END TRY
        BEGIN CATCH
            IF ERROR_NUMBER() NOT IN (547,2601,2627) THROW;
            PRINT 'PASS: ' + @name;
            SET @passed += 1;
        END CATCH;
        FETCH NEXT FROM cases INTO @name,@statement;
    END;
    CLOSE cases;
    DEALLOCATE cases;
    ROLLBACK TRANSACTION;
    PRINT CONCAT('PASS: schema checks and ',@passed,' negative constraint cases; fixtures rolled back.');
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;
