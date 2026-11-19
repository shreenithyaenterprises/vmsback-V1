-- ============================================
-- APPROVAL FLOW - MINIMAL VERSION
-- Fixed parameter types for executeProcedureXml
-- ============================================

USE [main]
GO

-- ============================================
-- TABLES
-- ============================================

-- Approval Authority Master (Employee-wise approver mapping)
IF OBJECT_ID('dbo.approval_authority_master', 'U') IS NULL
BEGIN
	CREATE TABLE dbo.approval_authority_master (
		authority_id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
		employee_id INT NOT NULL,
		approver_employee_id INT NOT NULL,
		approval_level INT NOT NULL DEFAULT (1),
		is_active BIT NOT NULL DEFAULT (1),
		created_at DATETIME2(0) NOT NULL DEFAULT (SYSUTCDATETIME()),
		INDEX IX_employee_id (employee_id),
		INDEX IX_approver_id (approver_employee_id)
	);
END
GO

-- Visit Approval Log
IF OBJECT_ID('dbo.visit_approval_log', 'U') IS NULL
BEGIN
	CREATE TABLE dbo.visit_approval_log (
		approval_log_id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
		prebooking_id INT NOT NULL,
		approval_level INT NOT NULL DEFAULT (1),
		approver_id INT NOT NULL,
		action NVARCHAR(20) NOT NULL DEFAULT ('PENDING'),
		remarks NVARCHAR(500) NULL,
		action_time DATETIME2(0) NULL,
		created_at DATETIME2(0) NOT NULL DEFAULT (SYSUTCDATETIME()),
		INDEX IX_prebooking_id (prebooking_id),
		INDEX IX_approver_id (approver_id),
		INDEX IX_action (action)
	);
END
GO

-- ============================================
-- STORED PROCEDURES (FIXED PARAMETER TYPES)
-- ============================================

-- 1️⃣ GET APPROVAL AUTHORITY
CREATE OR ALTER PROCEDURE dbo.GetApprovalAuthority_SP
	@XMLData NVARCHAR(MAX) = NULL
AS
BEGIN
	SET NOCOUNT ON;

	BEGIN TRY
		DECLARE @xml XML = NULL;
		IF @XMLData IS NOT NULL AND @XMLData != ''
		BEGIN
			SET @xml = CAST(@XMLData AS XML);
		END;

		DECLARE @HostEmployeeId INT = @xml.value('(/ApprovalRequest/HostEmployeeId)[1]', 'INT');

		IF @HostEmployeeId IS NULL
		BEGIN
			SELECT (
				SELECT 'E' AS Success, 'HostEmployeeId is required' AS Message
				FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
			) AS ReturnValue;
			RETURN;
		END;

		-- Check if employee requires approval
		DECLARE @ApprovalRequired BIT;
		SELECT @ApprovalRequired = approval_required
		FROM dbo.employee_master
		WHERE employee_id = @HostEmployeeId AND is_active = 1;

		IF @ApprovalRequired IS NULL
		BEGIN
			SELECT (
				SELECT 'E' AS Success, 'Employee not found' AS Message
				FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
			) AS ReturnValue;
			RETURN;
		END;

		-- If no approval required, return success with NULL approver
		IF @ApprovalRequired = 0
		BEGIN
			SELECT (
				SELECT 'S' AS Success, 'No approval required' AS Message, 
					NULL AS ApproverId, 
					NULL AS ApproverName,
					NULL AS ApproverEmail,
					0 AS ApprovalLevel
				FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
			) AS ReturnValue;
			RETURN;
		END;

		-- Get approver from approval_authority_master
		DECLARE @ApproverId INT;
		DECLARE @ApprovalLevel INT;

		SELECT TOP 1 
			@ApproverId = approver_employee_id,
			@ApprovalLevel = approval_level
		FROM dbo.approval_authority_master
		WHERE employee_id = @HostEmployeeId 
			AND is_active = 1
		ORDER BY approval_level;

		IF @ApproverId IS NOT NULL
		BEGIN
			DECLARE @ApproverName NVARCHAR(120);
			DECLARE @ApproverEmail NVARCHAR(160);

			SELECT 
				@ApproverName = name,
				@ApproverEmail = email
			FROM dbo.employee_master
			WHERE employee_id = @ApproverId AND is_active = 1;

			SELECT (
				SELECT 'S' AS Success, 'Approver found' AS Message,
					@ApproverId AS ApproverId,
					@ApproverName AS ApproverName,
					@ApproverEmail AS ApproverEmail,
					@ApprovalLevel AS ApprovalLevel
				FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
			) AS ReturnValue;
			RETURN;
		END;

		-- No approver configured
		SELECT (
			SELECT 'S' AS Success, 'No approver configured' AS Message,
				NULL AS ApproverId,
				NULL AS ApproverName,
				NULL AS ApproverEmail,
				0 AS ApprovalLevel
			FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
		) AS ReturnValue;

	END TRY
	BEGIN CATCH
		DECLARE @ErrorMessage NVARCHAR(MAX) = ERROR_MESSAGE();
		SELECT (
			SELECT 'E' AS Success, @ErrorMessage AS Message
			FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
		) AS ReturnValue;
	END CATCH;
END
GO

-- 2️⃣ GET PENDING APPROVALS FOR USER
CREATE OR ALTER PROCEDURE dbo.GetPendingApprovals_SP
	@XMLData NVARCHAR(MAX) = NULL
AS
BEGIN
	SET NOCOUNT ON;

	BEGIN TRY
		DECLARE @xml XML = NULL;
		IF @XMLData IS NOT NULL AND @XMLData != ''
		BEGIN
			SET @xml = CAST(@XMLData AS XML);
		END;

		DECLARE @ApproverId INT = @xml.value('(/ApprovalRequest/ApproverId)[1]', 'INT');

		IF @ApproverId IS NULL
		BEGIN
			SELECT (
				SELECT 'E' AS Success, 'ApproverId is required' AS Message
				FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
			) AS ReturnValue;
			RETURN;
		END;

		SELECT (
			SELECT 'S' AS Success, 'Pending approvals fetched' AS Message,
				JSON_QUERY((
					SELECT 
						pal.approval_log_id AS ApprovalLogId,
						pr.prebooking_id AS PrebookingId,
						pr.visitor_name AS VisitorName,
						pr.visitor_email AS VisitorEmail,
						pr.visit_date AS VisitDate,
						em.name AS HostEmployeeName,
						pal.approval_level AS ApprovalLevel,
						pal.action AS Action,
						pal.created_at AS CreatedAt
					FROM dbo.visit_approval_log pal
					INNER JOIN dbo.prebooking_request pr ON pal.prebooking_id = pr.prebooking_id
					INNER JOIN dbo.employee_master em ON pr.host_employee_id = em.employee_id
					WHERE pal.approver_id = @ApproverId 
						AND pal.action = 'PENDING'
					ORDER BY pal.created_at DESC
					FOR JSON PATH
				)) AS ApprovalRequests
			FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
		) AS ReturnValue;

	END TRY
	BEGIN CATCH
		DECLARE @ErrorMessage NVARCHAR(MAX) = ERROR_MESSAGE();
		SELECT (
			SELECT 'E' AS Success, @ErrorMessage AS Message
			FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
		) AS ReturnValue;
	END CATCH;
END
GO

-- 3️⃣ SUBMIT APPROVAL DECISION (MAIN FIX FOR YOUR ERROR)
CREATE OR ALTER PROCEDURE dbo.SubmitApprovalDecision_SP
	@XMLData NVARCHAR(MAX) = NULL
AS
BEGIN
	SET NOCOUNT ON;

	BEGIN TRY
		DECLARE @xml XML = NULL;
		IF @XMLData IS NOT NULL AND @XMLData != ''
		BEGIN
			SET @xml = CAST(@XMLData AS XML);
		END;

		DECLARE @ApprovalLogId INT = @xml.value('(/ApprovalDecision/ApprovalLogId)[1]', 'INT');
		DECLARE @Action NVARCHAR(20) = @xml.value('(/ApprovalDecision/Action)[1]', 'NVARCHAR(20)');
		DECLARE @Remarks NVARCHAR(500) = @xml.value('(/ApprovalDecision/Remarks)[1]', 'NVARCHAR(500)');

		IF @ApprovalLogId IS NULL OR @Action IS NULL
		BEGIN
			SELECT (
				SELECT 'E' AS Success, 'ApprovalLogId and Action are required' AS Message
				FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
			) AS ReturnValue;
			RETURN;
		END

		IF @Action NOT IN ('APPROVED', 'REJECTED')
		BEGIN
			SELECT (
				SELECT 'E' AS Success, 'Action must be APPROVED or REJECTED' AS Message
				FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
			) AS ReturnValue;
			RETURN;
		END

		-- Check if approval record exists
		IF NOT EXISTS (SELECT 1 FROM dbo.visit_approval_log WHERE approval_log_id = @ApprovalLogId)
		BEGIN
			SELECT (
				SELECT 'E' AS Success, 'Approval record not found' AS Message
				FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
			) AS ReturnValue;
			RETURN;
		END

		-- Update approval log
		UPDATE dbo.visit_approval_log
		SET action = @Action,
			remarks = @Remarks,
			action_time = SYSUTCDATETIME()
		WHERE approval_log_id = @ApprovalLogId;

		-- Update prebooking request status
		DECLARE @PrebookingId INT;
		SELECT @PrebookingId = prebooking_id 
		FROM dbo.visit_approval_log 
		WHERE approval_log_id = @ApprovalLogId;

		IF @Action = 'APPROVED'
		BEGIN
			UPDATE dbo.prebooking_request
			SET status = 'APPROVED'
			WHERE prebooking_id = @PrebookingId;
		END
		ELSE
		BEGIN
			UPDATE dbo.prebooking_request
			SET status = 'REJECTED'
			WHERE prebooking_id = @PrebookingId;

			UPDATE dbo.VISIT_TRANSACTION
			SET ApprovalStatus = 'REJECTED',
				VisitStatus = 'REJECTED',
				UpdatedAt = GETDATE()
			WHERE PreBookingID = @PrebookingId;
		END

		SELECT (
			SELECT 'S' AS Success, 'Approval decision submitted' AS Message,
				@ApprovalLogId AS ApprovalLogId,
				@Action AS Action,
				@PrebookingId AS PrebookingId
			FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
		) AS ReturnValue;

	END TRY
	BEGIN CATCH
		DECLARE @ErrorMessage NVARCHAR(MAX) = ERROR_MESSAGE();
		SELECT (
			SELECT 'E' AS Success, @ErrorMessage AS Message
			FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
		) AS ReturnValue;
	END CATCH;
END
GO

-- 4️⃣ GET APPROVAL STATUS
CREATE OR ALTER PROCEDURE dbo.GetApprovalStatus_SP
	@XMLData NVARCHAR(MAX) = NULL
AS
BEGIN
	SET NOCOUNT ON;

	BEGIN TRY
		DECLARE @xml XML = NULL;
		IF @XMLData IS NOT NULL AND @XMLData != ''
		BEGIN
			SET @xml = CAST(@XMLData AS XML);
		END;

		DECLARE @PrebookingId INT = @xml.value('(/ApprovalRequest/PrebookingId)[1]', 'INT');

		IF @PrebookingId IS NULL
		BEGIN
			SELECT (
				SELECT 'E' AS Success, 'PrebookingId is required' AS Message
				FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
			) AS ReturnValue;
			RETURN;
		END;

		SELECT (
			SELECT 'S' AS Success, 'Approval history fetched' AS Message,
				JSON_QUERY((
					SELECT 
						approval_log_id AS ApprovalLogId,
						approval_level AS ApprovalLevel,
						approver_id AS ApproverId,
						(SELECT name FROM dbo.employee_master WHERE employee_id = dbo.visit_approval_log.approver_id) AS ApproverName,
						action AS Action,
						remarks AS Remarks,
						action_time AS ActionTime
					FROM dbo.visit_approval_log
					WHERE prebooking_id = @PrebookingId
					ORDER BY approval_level
					FOR JSON PATH
				)) AS ApprovalHistory
			FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
		) AS ReturnValue;

	END TRY
	BEGIN CATCH
		DECLARE @ErrorMessage NVARCHAR(MAX) = ERROR_MESSAGE();
		SELECT (
			SELECT 'E' AS Success, @ErrorMessage AS Message
			FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
		) AS ReturnValue;
	END CATCH;
END
GO

PRINT 'Approval flow procedures created successfully with fixed parameter types!';
